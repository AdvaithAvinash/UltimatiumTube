'use strict';

const http = require('http');
const express = require('express');

const { attach } = require('../lib/pluginFetch.js');

const asJson = (raw) => {
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
};

const results = [];
const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

// The site a plugin reads, stood in for.
const site = http.createServer((req, res) => {
    const parts = [];
    req.on('data', (chunk) => parts.push(chunk));
    req.on('end', () => {
        if (req.url === '/old') { res.statusCode = 302; res.setHeader('Location', '/new'); return res.end(); }
        if (req.url === '/gone') { res.statusCode = 404; return res.end('nothing here'); }
        res.setHeader('Set-Cookie', ['a=1', 'b=2']);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ url: req.url, method: req.method, ua: req.headers['user-agent'], cookie: req.headers.cookie || '', referer: req.headers.referer || '', body: Buffer.concat(parts).toString() }));
    });
});

site.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${site.address().port}`;
    const app = express();
    attach(app);

    const server = app.listen(0, '127.0.0.1', () => {
        const ask = (body, headers) => new Promise((resolve, reject) => {
            const text = typeof body === 'string' ? body : JSON.stringify(body);
            const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/__tube/fetch', method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) }, headers) }, (res) => {
                const parts = [];
                res.on('data', (c) => parts.push(c));
                res.on('end', () => {
                    const raw = Buffer.concat(parts).toString();
                    resolve({ status: res.statusCode, json: asJson(raw) });
                });
            });
            req.on('error', reject);
            req.end(text);
        });
        const ours = { 'X-Tube': '1' };

        ask({ url: `${base}/x`, headers: { 'User-Agent': 'Plugin/1', Cookie: 'k=v', Referer: 'https://r.example/' } }, ours).then((r) => {
            const inner = JSON.parse(r.json.body);
            check('a plain request gets the site\'s answer', r.status === 200 && r.json.status === 200 && inner.url === '/x');
            check('the headers a page may not set arrive', inner.ua === 'Plugin/1' && inner.cookie === 'k=v' && inner.referer === 'https://r.example/', JSON.stringify(inner));
            check('the answer carries every header, repeated ones as a list', r.json.headers['set-cookie'].length === 2);
            return ask({ url: `${base}/p`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"q":1}' }, ours);
        }).then((r) => {
            const inner = JSON.parse(r.json.body);
            check('a body is sent with a POST', inner.method === 'POST' && inner.body === '{"q":1}', r.json.body);
            return ask({ url: `${base}/q` }, ours);
        }).then((r) => {
            check('with no User-Agent given, one is sent', /Mozilla/.test(JSON.parse(r.json.body).ua));
            return ask({ url: `${base}/old` }, ours);
        }).then((r) => {
            check('a redirect is followed and the final address told', r.json.status === 200 && /\/new$/.test(r.json.url), JSON.stringify(r.json).slice(0, 120));
            return ask({ url: `${base}/gone` }, ours);
        }).then((r) => {
            check('an error status is handed back, not hidden', r.status === 200 && r.json.status === 404 && r.json.body === 'nothing here');
            return ask({ url: `${base}/x` }, {});
        }).then((r) => {
            check('without the x-tube header it is refused', r.status === 403);
            return ask({ url: 'file:///etc/passwd' }, ours);
        }).then((r) => {
            check('only http and https addresses are made', r.status === 400);
            return ask('not json', ours);
        }).then((r) => {
            check('a body that is not json is refused', r.status === 400);
            return ask({ url: 'http://127.0.0.1:1/never' }, ours);
        }).then((r) => {
            check('a site that cannot be reached is a 502 with a reason', r.status === 502 && /failed/.test(r.json.error), JSON.stringify(r));
        }).catch((e) => check('requests', false, e.message)).then(() => {
            server.close();
            site.close();
            const failed = results.filter((ok) => !ok).length;
            console.log(`\n${results.length - failed}/${results.length} checks passed.`);
            process.exit(failed ? 1 : 0);
        });
    });
});
