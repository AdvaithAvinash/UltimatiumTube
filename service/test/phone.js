'use strict';

const http = require('http');
const express = require('express');

const phoneSettings = require('../lib/phoneSettings.js');
const { page } = require('../lib/phonePage.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const app = express();
phoneSettings.attach(app);

const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;

    const call = (method, path, body, headers) => new Promise((resolve, reject) => {
        const text = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            host: '127.0.0.1', port, path, method,
            headers: Object.assign(text ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } : {}, headers)
        }, (res) => {
            const parts = [];
            res.on('data', (chunk) => parts.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(parts).toString('utf8');
                const parsed = { json: null };
                try { parsed.json = JSON.parse(raw); } catch (e) { /* html */ }
                resolve({ status: res.statusCode, json: parsed.json, raw, headers: res.headers });
            });
        });
        req.on('error', reject);
        if (text) req.write(text);
        req.end();
    });

    const OURS = { 'X-Tube': '1' };
    const config = { enableAdBlock: true, blockedKeywords: [], sponsorBlockMinDuration: 0, startupPage: '' };
    const schema = [{ id: 'g', title: 'G', items: [{ key: 'enableAdBlock', kind: 'switch', title: 'Block ads' }] }];

    call('GET', '/settings')
        .then((res) => {
            check('the page is served', res.status === 200 && res.raw.indexOf('<!DOCTYPE html>') === 0);
            check('it fits a phone', res.raw.indexOf('width=device-width') !== -1);
            check('it is the same page the module builds', res.raw === page());
            return call('GET', '/api/settings');
        })
        .then((res) => {
            check('before a TV connects it says so', res.json.online === false && res.json.schema === null);
            return call('POST', '/api/settings', { changes: { enableAdBlock: false } }, OURS);
        })
        .then((res) => {
            check('a change is refused until the TV has connected', res.status === 409, res.raw);
            return call('POST', '/__tube/phone/sync', { seq: 0, config, schema });
        })
        .then((res) => {
            check('a post without the x-tube header is refused', res.status === 403, res.raw);
            return call('POST', '/__tube/phone/sync', { seq: 0, config, schema }, OURS);
        })
        .then((res) => {
            check('the TV connecting gets an empty answer', res.status === 200 && res.json.changes.length === 0 && res.json.seq === 0);
            check('which asks for nothing more, having sent its schema', res.json.needSchema === false);
            check('and is told the address of the page', /^http:\/\/.+:\d+\/settings$/.test(res.json.address), res.json.address);
            return call('GET', '/api/settings');
        })
        .then((res) => {
            check('the page now sees the TV', res.json.online === true && res.json.schema[0].id === 'g');
            check('and its settings', res.json.config.enableAdBlock === true);
            return call('POST', '/api/settings', { changes: { enableAdBlock: false, blockedKeywords: ['spoiler'] } }, OURS);
        })
        .then((res) => {
            check('a change from the phone is taken', res.status === 200 && res.json.taken === 2 && res.json.seq === 2, res.raw);
            return call('POST', '/api/settings', { changes: { enableAdBlock: 'no', nonsense: 1, sponsorBlockMinDuration: 5 } }, OURS);
        })
        .then((res) => {
            check('a value of the wrong shape is dropped, an unknown key too, a good one kept', res.json.taken === 1 && res.json.seq === 3, res.raw);
            return call('POST', '/__tube/phone/sync', { seq: 0, config }, OURS);
        })
        .then((res) => {
            const keys = res.json.changes.map((change) => change.key);
            check('the TV is given every change it has not seen', keys.join() === 'enableAdBlock,blockedKeywords,sponsorBlockMinDuration', keys.join());
            check('with the seq to remember', res.json.seq === 3);
            return call('GET', '/api/settings');
        })
        .then((res) => {
            check('a stale snapshot does not undo the change in the page\'s view',
                res.json.config.enableAdBlock === false && res.json.config.blockedKeywords[0] === 'spoiler');
            return call('POST', '/__tube/phone/sync', { seq: 3, config }, OURS);
        })
        .then((res) => {
            check('a TV that is up to date is given nothing', res.json.changes.length === 0);
            return call('POST', '/api/settings', { changes: [] }, OURS);
        })
        .then((res) => {
            check('a body that is not a set of changes takes nothing', res.status === 200 && res.json.taken === 0);
        })
        .catch((error) => check('the run finished', false, error.message))
        .then(() => {
            server.close();
            const failed = results.filter((ok) => !ok).length;
            console.log(`\n${results.length - failed}/${results.length} checks passed.`);
            process.exit(failed ? 1 : 0);
        });
});
