'use strict';

const http = require('http');
const net = require('net');
const express = require('express');

const { create } = require('../lib/listener.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const freePort = () => new Promise((resolve) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
        const { port } = probe.address();
        probe.close(() => resolve(port));
    });
});

const get = (port) => new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/ok', timeout: 1500 }, (res) => {
        const parts = [];
        res.on('data', (chunk) => parts.push(chunk));
        res.on('end', () => resolve(Buffer.concat(parts).toString()));
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
});

const app = express();
app.get('/ok', (_, res) => res.send('ok'));

const notes = [];

const make = (port, list, extra) => create(Object.assign({
    app,
    port,
    bind: '0.0.0.0',
    addresses: () => list.slice(),
    note: (what, text) => notes.push(`${what}: ${text}`),
    noteRarely: (what, text) => notes.push(`${what}: ${text}`),
    retryAfter: 60,
    checkEvery: 100000
}, extra));

const until = async (test, ms) => {
    const end = Date.now() + ms;
    const found = { yes: await test() };

    while (!found.yes && Date.now() < end) {
        await sleep(25);
        found.yes = await test();
    }

    return found.yes;
};

(async () => {
    const port = await freePort();
    const list = ['127.0.0.1'];
    const live = make(port, list);
    live.start();

    check('it listens and answers', await until(async () => (await get(port)) === 'ok', 2000));
    check('and says where', notes.some((n) => n === `listening: 127.0.0.1:${port}`), notes.join('|'));

    // closed from outside
    live.current.server.close();
    check('a server closed from outside is listening again', await until(async () => (await get(port)) === 'ok', 3000), notes.join('|'));

    // the address it chose is no longer the set's
    list[0] = '0.0.0.0';
    live.check();
    check('an address that is no longer the set\'s is given up for the set\'s own', await until(() => live.current.address === '0.0.0.0', 3000), String(live.current.address));
    check('and it still answers there', await until(async () => (await get(port)) === 'ok', 3000));

    // nothing changed: nothing happens
    const before = live.current.server;
    live.check();
    await sleep(100);
    check('when nothing has changed, the watch leaves it alone', live.current.server === before);

    live.current.server.close();
    await sleep(300);

    // a port that is busy for a while
    const busy = net.createServer().listen(0, '127.0.0.1');
    await new Promise((resolve) => busy.on('listening', resolve));
    const taken = busy.address().port;
    const waiting = make(taken, ['127.0.0.1']);
    waiting.start();

    await sleep(300);
    check('a busy port is tried again, not given up', waiting.current.server === null && notes.some((n) => /EADDRINUSE|already holds that port/.test(n)));

    await new Promise((resolve) => busy.close(resolve));
    check('and is taken once it is free', await until(async () => (await get(taken)) === 'ok', 3000), notes.slice(-3).join('|'));

    // a server that is up but whose socket was closed without the close event reaching us
    const quiet = make(await freePort(), ['127.0.0.1']);
    quiet.start();
    await until(() => quiet.current.server !== null, 2000);
    const silent = quiet.current.server;
    silent.removeAllListeners('close');
    silent.close();
    await sleep(100);
    quiet.check();
    check('the watch finds a server that is no longer listening, though no event said so',
        await until(async () => quiet.current.server !== null && quiet.current.server !== silent && !!quiet.current.server.address(), 3000));

    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})();
