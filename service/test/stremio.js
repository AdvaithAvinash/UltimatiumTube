'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-sx-'));
fs.writeFileSync(path.join(root, 'index.html'), '<!DOCTYPE html><title>sx</title>');
fs.writeFileSync(path.join(root, 'ui.js'), 'var x = 1;');
process.env.TUBE_STREMIO_DIR = root;

const { attach } = require('../lib/stremio.js');

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
            res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString(), headers: res.headers }));
        }).on('error', reject);
    });

    get('/stremio').then((r) => {
        check('/stremio goes to its page', r.status === 302 && r.headers.location === '/stremio/index.html', `${r.status} ${r.headers.location}`);
        return get('/stremio/index.html');
    }).then((r) => {
        check('the page is served', r.status === 200 && /sx/.test(r.text));
        check('and is never kept, so an update is seen', /no-cache/.test(String(r.headers['cache-control'])));
        return get('/stremio/ui.js');
    }).then((r) => {
        check('its script is served', r.status === 200 && /var x/.test(r.text));
        return get('/stremio/missing.js');
    }).then((r) => {
        check('a missing file is a plain 404, not YouTube\'s', r.status === 404, String(r.status));
        return get('/stremio/..%2f..%2fetc/passwd');
    }).then((r) => {
        check('a path out of the folder is refused', r.status === 404 || r.status === 403, String(r.status));
        return get('/elsewhere');
    }).then((r) => {
        check('other paths are left to the rest of the service', r.status === 599);
    }).catch((e) => check('requests', false, e.message)).then(() => {
        server.close();
        const failed = results.filter((ok) => !ok).length;
        console.log(`\n${results.length - failed}/${results.length} checks passed.`);
        process.exit(failed ? 1 : 0);
    });
});
