'use strict';

// The policy on every page keeps navigations on this service, and what it refuses is logged.

const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 18911;
const LOG = path.join(os.tmpdir(), `tube-nav-${process.pid}.log`);
const results = [];
const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const service = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
    env: Object.assign({}, process.env, { TUBE_PROXY_PORT: String(PORT), TUBE_LOG: LOG, TUBE_SHARE: os.tmpdir() }),
    stdio: 'ignore'
});

const ask = (method, p, body) => new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { 'content-type': 'application/csp-report' } }, (res) => {
        const parts = [];
        res.on('data', (c) => parts.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(parts).toString() }));
    });
    req.on('error', () => resolve(null));
    req.end(body || '');
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const up = await [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].reduce((p) => p.then(async (got) => got || (await wait(300), ask('GET', '/__tube/state'))), Promise.resolve(null));
    check('the service answers', !!up && up.status === 200);

    const policy = String(up && up.headers['content-security-policy']);
    check('navigation is kept to this service', /h5vcc-location-src 'self' http:\/\/127\.0\.0\.1:18911(;|$)/.test(policy), policy);
    check('YouTube itself is not named for navigation', !/h5vcc-location-src[^;]*\*/.test(policy) && !/h5vcc-location-src[^;]*youtube/.test(policy), policy);
    check('what is refused is reported here', /report-uri \/__tube\/csp/.test(policy), policy);

    const posted = await ask('POST', '/__tube/csp', JSON.stringify({ 'csp-report': { 'blocked-uri': 'https://www.youtube.com', 'violated-directive': "h5vcc-location-src 'self'" } }));
    check('a report is taken', posted && posted.status === 204, posted && posted.status);
    await wait(300);
    const log = await ask('GET', '/__tube/log');
    check('and is in the log', log && /policy: refused https:\/\/www\.youtube\.com/.test(log.text), log && log.text.slice(-300));

    service.kill();
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})();
