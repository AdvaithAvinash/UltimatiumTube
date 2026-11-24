'use strict';

// The TV page as YouTube gives it to Samsung's YouTube app: asked with that app's user agent, handed
// back to the loader as it came; anything that is not the page is not handed back.

const http = require('http');
const express = require('express');

const results = [];
const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const upstream = { asked: [], answer: 'page' };
const PAGE = '<!DOCTYPE html><html><head><script>ytcfg.set({"INNERTUBE_CONTEXT":{}});</script></head><body>the app</body></html>';

const youtube = http.createServer((req, res) => {
    upstream.asked.push({ url: req.url, agent: req.headers['user-agent'], language: req.headers['accept-language'] });
    if (upstream.answer === 'page') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    if (upstream.answer === 'consent') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html><body>Before you continue</body></html>'); return; }
    res.writeHead(500); res.end('broken');
});

youtube.listen(0, '127.0.0.1', () => {
    process.env.TUBE_TV_PAGE_URL = `http://127.0.0.1:${youtube.address().port}/tv`;
    const { attach, APP_AGENT } = require('../lib/tvPage.js');
    const app = express();
    attach(app);
    const server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const ask = () => new Promise((resolve, reject) => {
            http.get({ host: '127.0.0.1', port, path: '/__tube/tvpage', headers: { 'Accept-Language': 'de-DE' } }, (res) => {
                const parts = [];
                res.on('data', (c) => parts.push(c));
                res.on('end', () => resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'], body: Buffer.concat(parts).toString() }));
            }).on('error', reject);
        });

        (async () => {
            const page = await ask();
            check('the TV page comes back as YouTube gave it', page.status === 200 && page.body === PAGE, `${page.status} ${page.body.slice(0, 60)}`);
            check('asked as Samsung\'s YouTube app (Cobalt)', /Cobalt\//.test(upstream.asked[0].agent) && upstream.asked[0].agent === APP_AGENT, upstream.asked[0].agent);
            check('in the TV\'s language', upstream.asked[0].language === 'de-DE', upstream.asked[0].language);
            check('readable by the app\'s loader, from wherever it runs', page.cors === '*', page.cors);

            upstream.answer = 'consent';
            const other = await ask();
            check('a page that is not the TV app is not handed back', other.status === 502, other.status);

            upstream.answer = 'broken';
            const broken = await ask();
            check('nor is a failure', broken.status === 502, broken.status);

            server.close();
            youtube.close();
            const failed = results.filter((ok) => !ok).length;
            console.log(`\n${results.length - failed}/${results.length} checks passed.`);
            process.exit(failed ? 1 : 0);
        })().catch((error) => { console.log(`FAIL  ${error.stack}`); process.exit(1); });
    });
});
