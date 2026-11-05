'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-aniapi-'));
fs.writeFileSync(path.join(root, 'main.js'), 'const VERCEL_API_URL = "https://moved.example.workers.dev";\n(function(){})();');
process.env.TUBE_ANI_DIR = root;

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

// The real server, stood in for.
const seen = [];

const upstream = http.createServer((req, res) => {
    const parts = [];
    req.on('data', (chunk) => parts.push(chunk));
    req.on('end', () => {
        seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(parts).toString() });

        if (req.url.indexOf('action=media') !== -1) {
            const whole = Buffer.from('0123456789');
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Accept-Ranges', 'bytes');

            if (req.headers.range) {
                res.statusCode = 206;
                res.setHeader('Content-Range', 'bytes 2-5/10');
                return res.end(whole.slice(2, 6));
            }

            return res.end(whole);
        }

        if (req.url.indexOf('action=teapot') !== -1) {
            res.statusCode = 418;
            res.setHeader('Content-Type', 'application/json');
            return res.end('{"error":"I am a teapot"}');
        }

        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ rows: [{ title: 'Trending Now', items: [{ id: 1 }] }] }));
    });
});

upstream.listen(0, '127.0.0.1', () => {
    process.env.TUBE_ANI_API = `http://127.0.0.1:${upstream.address().port}`;

    const { attach, serverOf } = require('../lib/aniApi.js');

    const app = express();
    attach(app);
    app.all('*', (_, res) => res.status(599).send('fallback'));

    const server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;

        const call = (method, p, body, headers) => new Promise((resolve, reject) => {
            const req = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
                const parts = [];
                res.on('data', (chunk) => parts.push(chunk));
                res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString(), headers: res.headers }));
            });

            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        });

        call('GET', '/api?action=home&via=auto&q=one%20piece', null, { Authorization: 'Bearer abc', Cookie: 'SID=youtube-secret', Referer: 'http://tv/' })
            .then((res) => {
                check('an Aniultimatium call is passed on, and its answer comes back', res.status === 200 && JSON.parse(res.text).rows[0].title === 'Trending Now', res.text);
                check('with the query exactly as the page wrote it', seen[0].url === '/api?action=home&via=auto&q=one%20piece', seen[0].url);
                check('and its sign-in, which the server asks for', seen[0].headers.authorization === 'Bearer abc');
                check('but not YouTube\'s cookies, nor where the page was', !seen[0].headers.cookie && !seen[0].headers.referer, JSON.stringify(seen[0].headers));
                check('the answer is JSON, and may be read by the page', /json/.test(res.headers['content-type']) && res.headers['access-control-allow-origin'] === '*');
                return call('POST', '/api?action=sync_put', '{"list":[1,2]}', { 'Content-Type': 'application/json', 'Content-Length': 14 });
            })
            .then((res) => {
                const last = seen[seen.length - 1];
                check('a post goes on with its body', last.method === 'POST' && last.body === '{"list":[1,2]}' && /json/.test(last.headers['content-type']), JSON.stringify(last));
                check('and is answered', res.status === 200);
                return call('GET', '/api?action=teapot');
            })
            .then((res) => {
                check('an error from the server is the page\'s error, with its words', res.status === 418 && JSON.parse(res.text).error === 'I am a teapot', res.text);
                return call('GET', '/api?action=media&url=x', null, { Range: 'bytes=2-5' });
            })
            .then((res) => {
                check('a range is passed on and the part comes back', res.status === 206 && res.text === '2345' && res.headers['content-range'] === 'bytes 2-5/10', `${res.status} ${res.text}`);
                return call('GET', '/api');
            })
            .then((res) => {
                check('/api with no action is not Aniultimatium\'s, and is left to the rest of the service', res.status === 599);
                return call('GET', '/api/jnn/v1/GenerateIT?action=x');
            })
            .then((res) => {
                check('nor is anything below /api, which YouTube uses', res.status === 599);
                check('the server is the one the bundled app names, unless one is given', serverOf() === process.env.TUBE_ANI_API);
                delete process.env.TUBE_ANI_API;
                check('the bundled app\'s own server is read from its first line', serverOf() === 'https://moved.example.workers.dev', serverOf());
                fs.writeFileSync(path.join(root, 'main.js'), 'nothing useful');
                check('and with nothing to read, the one it has always had', serverOf() === 'https://aniultimatium.advaithavinash404.workers.dev');
                process.env.TUBE_ANI_API = 'http://127.0.0.1:1';
                return call('GET', '/api?action=home');
            })
            .then((res) => {
                check('a server that does not answer is a 502 the page can show', res.status === 502 && /did not answer/.test(JSON.parse(res.text).error), res.text);
            })
            .catch((error) => check('the run finished', false, error.message))
            .then(() => {
                server.close();
                upstream.close();
                const failed = results.filter((ok) => !ok).length;
                console.log(`\n${results.length - failed}/${results.length} checks passed.`);
                process.exit(failed ? 1 : 0);
            });
    });
});
