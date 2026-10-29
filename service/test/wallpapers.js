'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-wall-'));
fs.writeFileSync(path.join(root, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
fs.writeFileSync(path.join(root, '.hidden.jpg'), 'x');
process.env.TUBE_WALLPAPERS_DIR = root;

const { attach } = require('../lib/wallpapers.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const app = express();
attach(app);
app.all('*', (_, res) => res.status(599).send('fallback'));

const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;

    const get = (p) => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: p }, (res) => {
            const parts = [];
            res.on('data', (c) => parts.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts), headers: res.headers }));
        }).on('error', reject);
    });

    get('/__tube/wallpapers/a.jpg')
        .then((res) => {
            check('a wallpaper is served', res.status === 200 && res.body.length === 7);
            check('as an image', res.headers['content-type'] === 'image/jpeg');
            check('and kept by the engine for a day', /max-age=86400/.test(res.headers['cache-control']), res.headers['cache-control']);
            return get('/__tube/wallpapers/missing.jpg');
        })
        .then((res) => {
            check('a missing one is a 404 of its own, not YouTube\'s answer', res.status === 404 && res.body.toString() === 'not found', String(res.status));
            return get('/__tube/wallpapers/.hidden.jpg');
        })
        .then((res) => {
            check('a hidden file is not offered', res.status === 404);
            return get('/__tube/wallpapers/../index.js');
        })
        .then((res) => {
            check('a path out of the folder is refused', res.status === 403 || res.status === 404, String(res.status));
            return get('/__tube/other');
        })
        .then((res) => {
            check('anything else is left to the rest of the service', res.status === 599);
        })
        .catch((error) => check('the run finished', false, error.message))
        .then(() => {
            server.close();
            const failed = results.filter((ok) => !ok).length;
            console.log(`\n${results.length - failed}/${results.length} checks passed.`);
            process.exit(failed ? 1 : 0);
        });
});
