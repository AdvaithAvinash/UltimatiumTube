'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');

const SHARE = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-keep-'));
process.env.TUBE_SHARE = SHARE;

const { attach, read } = require('../lib/keep.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const app = express();
attach(app);

const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;

    const ask = (method, body, ours) => new Promise((resolve, reject) => {
        const headers = ours ? { 'X-Tube': '1' } : {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const req = http.request({ host: '127.0.0.1', port, path: '/__tube/keep', method, headers }, (res) => {
            const parts = [];
            res.on('data', (c) => parts.push(c));
            res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(parts).toString() || 'null') }));
        });
        req.on('error', reject);
        if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });

    const copy = { origin: 'http://192.168.1.50:8189', items: { 'yt.leanback.default::auth': '{"token":"t"}', 'tube.settings': '{}' } };

    (async () => {
        const empty = await ask('GET', undefined, true);
        check('with nothing kept yet, an empty answer', empty.status === 200 && Object.keys(empty.json).length === 0, JSON.stringify(empty));

        const bare = await ask('POST', copy, false);
        check('a post without the header is refused', bare.status === 403, bare.status);
        check('and nothing is written', read() === null);

        const nosy = await ask('GET', undefined, false);
        check('a read without the header is refused', nosy.status === 403, nosy.status);

        const bad = await ask('POST', { origin: 'x', items: { a: 1 } }, true);
        check('a copy with a value that is not text is refused', bad.status === 400, bad.status);

        const broken = await ask('POST', '{not json', true);
        check('a body that is not JSON is refused', broken.status === 400, broken.status);

        const kept = await ask('POST', copy, true);
        check('the page storage is taken', kept.status === 200 && kept.json.ok === true, JSON.stringify(kept));

        const back = await ask('GET', undefined, true);
        check('and given back whole', back.json.origin === copy.origin
            && back.json.items['yt.leanback.default::auth'] === '{"token":"t"}' && back.json.at > 0, JSON.stringify(back.json));
        check('kept in the app folder, where it outlives the service', fs.existsSync(path.join(SHARE, 'keep.json')));
        check('with no half-written copy left beside it', !fs.existsSync(path.join(SHARE, 'keep.json.new')));

        fs.writeFileSync(path.join(SHARE, 'keep.json'), '{"origin": 5');
        const torn = await ask('GET', undefined, true);
        check('a damaged copy reads as none', torn.status === 200 && !torn.json.origin, JSON.stringify(torn.json));

        server.close();
        const failed = results.filter((ok) => !ok).length;
        console.log(`\n${results.length - failed}/${results.length} checks passed.`);
        process.exit(failed ? 1 : 0);
    })().catch((error) => {
        console.log(`FAIL  ${error.stack}`);
        process.exit(1);
    });
});
