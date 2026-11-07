'use strict';

// Two instances of the service on one port: the newer asks the older to give it up.

const http = require('http');
const express = require('express');

const { attach, takeover, ask } = require('../lib/handoff.js');
const { create } = require('../lib/listener.js');

const results = [];
const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const notes = [];
const note = (what, text) => notes.push(`${what}: ${text}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const instance = (port, appId) => {
    const app = express();
    const box = { listener: null };

    attach(app, { appId: () => appId, listener: { yieldPort: () => box.listener.yieldPort() }, note, addresses: () => ['127.0.0.1'] });
    app.get('/who', (_, res) => res.send(`${appId}:${port}`));

    box.listener = create({
        app, port, bind: '127.0.0.1', addresses: () => ['127.0.0.1'], note, noteRarely: note, retryAfter: 300,
        busy: takeover({ port, appId: () => appId, note })
    });

    return box.listener;
};

const get = (port, path) => new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
        const parts = [];
        res.on('data', (c) => parts.push(c));
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString() }));
    }).on('error', () => resolve(null));
});

const post = (port, headers, body) => new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/__tube/yield', method: 'POST', headers: Object.assign({ 'Content-Length': Buffer.byteLength(body) }, headers) }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(0));
    req.end(body);
});

(async () => {
    const PORT = 18640;
    const first = instance(PORT, 'Pkg.Service');
    first.start();
    await wait(300);
    check('the first instance serves', (await get(PORT, '/who')).text === 'Pkg.Service:18640');

    check('a request without the x-tube header is refused', await post(PORT, {}, '{"appId":"Pkg.Service"}') === 403);
    check('a request from another package is refused', await post(PORT, { 'X-Tube': '1' }, '{"appId":"Other.Service"}') === 409);
    check('a body that is not json is refused', await post(PORT, { 'X-Tube': '1' }, 'nope') === 409);
    check('the first instance is still serving after those', (await get(PORT, '/who')).text === 'Pkg.Service:18640');

    // A different package on the same port is not touched, and just waits.
    const stranger = instance(PORT, 'Other.Service');
    stranger.start();
    await wait(1500);
    check('another package does not take the port', (await get(PORT, '/who')).text === 'Pkg.Service:18640');
    stranger.yieldPort();

    // A newer instance of the same package takes it.
    const second = instance(PORT, 'Pkg.Service');
    second.start();
    await wait(2500);
    const served = await get(PORT, '/who');
    check('a newer instance of the same package is given the port', served && served.text === 'Pkg.Service:18640' && second.current.server !== null, JSON.stringify(served));
    check('and the older one stopped listening', first.current.server === null && first.current.yielded === true);

    await wait(1200);
    check('the older one does not try again, so the two do not trade the port', first.current.server === null);
    check('the handoff is in the log', notes.some((n) => /giving the port to a newer instance/.test(n)) && notes.some((n) => /agreed to give it up/.test(n)), notes.join(' | ').slice(0, 300));

    check('asking a port nobody holds says no', (await ask('127.0.0.1', 18641, 'Pkg.Service')) === false);

    second.yieldPort();
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})();
