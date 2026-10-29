'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-ani-'));
fs.mkdirSync(path.join(root, 'sub'));
fs.writeFileSync(path.join(root, 'index.html'), '<!DOCTYPE html><html><head><title>ani</title></head><body>home</body></html>');
fs.writeFileSync(path.join(root, 'main.js'), 'var x = 1;');
fs.writeFileSync(path.join(root, 'sub', 'a.css'), 'body{}');
fs.writeFileSync(path.join(root, 'VERSION.txt'), 'commit 51c9588dc35289c6da0f85f9672fa03e15fd5bec\n');
process.env.TUBE_ANI_DIR = root;

const { attach, withBridge } = require('../lib/aniultimatium.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const app = express();
app.get('/tv', (_, res) => res.send('youtube'));
attach(app);
app.all('*', (_, res) => res.status(599).send('fallback'));

const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;

    const get = (p) => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: p }, (res) => {
            const parts = [];
            res.on('data', (c) => parts.push(c));
            res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString(), headers: res.headers }));
        }).on('error', reject);
    });

    get('/aniultimatium/index.html')
        .then((res) => {
            check('the entry page is served', res.status === 200 && res.text.indexOf('<title>ani</title>') !== -1);
            check('as html, and never cached', /html/.test(res.headers['content-type']) && res.headers['cache-control'] === 'no-store');
            check('the bridge comes right after the head tag, before the app\'s own scripts',
                res.text.indexOf('<head><script>window.AniNative=') === 0 + res.text.indexOf('<head>'));
            check('it names the commit it was bundled from', res.text.indexOf('return "51c9588"') !== -1);
            check('and exit() goes home to YouTube', res.text.indexOf('window.location.replace("/tv")') !== -1);
            check('the rest of the page is as bundled', res.text.indexOf('</head><body>home</body>') !== -1);
            return get('/aniultimatium/');
        })
        .then((res) => {
            check('the folder address serves the same page', res.status === 200 && res.text.indexOf('window.AniNative=') !== -1);
            return get('/aniultimatium');
        })
        .then((res) => {
            check('the bare address redirects to it', res.status === 302 && res.headers.location === '/aniultimatium/index.html');
            return get('/aniultimatium/main.js');
        })
        .then((res) => {
            check('other files are served untouched', res.status === 200 && res.text === 'var x = 1;');
            return get('/aniultimatium/sub/a.css');
        })
        .then((res) => {
            check('including those in folders', res.status === 200 && res.text === 'body{}');
            return get('/aniultimatium/missing.js');
        })
        .then((res) => {
            check('a missing file is a 404 of its own, not YouTube\'s answer', res.status === 404 && res.text.indexOf('fallback') === -1, String(res.status));
            return get('/aniultimatium/../index.js');
        })
        .then((res) => {
            check('a path out of the folder is refused', res.status !== 200 || res.text.indexOf('fallback') === -1);
            return get('/tv');
        })
        .then((res) => {
            check('YouTube\'s own page is not touched', res.status === 200 && res.text === 'youtube');
            check('a page without a head still gets the bridge', withBridge('<body>x</body>').indexOf('<script>window.AniNative=') === 0);
        })
        .catch((error) => check('the run finished', false, error.message))
        .then(() => {
            server.close();
            const failed = results.filter((ok) => !ok).length;
            console.log(`\n${results.length - failed}/${results.length} checks passed.`);
            process.exit(failed ? 1 : 0);
        });
});
