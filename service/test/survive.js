'use strict';

// A service that ends on an error is not started again on a TV. These start a real process, throw in
// it, and see that it goes on.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-survive-'));

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const run = (script, name) => {
    const log = path.join(root, `${name}.log`);
    const answer = { code: 0, out: '' };

    try {
        answer.out = execFileSync(process.execPath, ['-e', script], {
            env: Object.assign({}, process.env, { TUBE_LOG: log, TUBE_SHARE: root }),
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8',
            timeout: 20000
        });
    } catch (error) {
        answer.code = error.status;
        answer.out = String(error.stdout || '');
    }

    answer.log = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
    return answer;
};

const PRELUDE = "const postmortem = require('./lib/postmortem.js'); postmortem.watch();";

const one = run(`${PRELUDE}
    setTimeout(() => { throw new Error('boom'); }, 20);
    setTimeout(() => { console.log('still alive'); process.exit(0); }, 400);`, 'one');

check('an error nothing caught no longer ends the process', one.out.indexOf('still alive') !== -1 && one.code === 0,
    `exit ${one.code}: ${one.out}`);
check('it is written down, and says the service went on', /survived: Error: boom/.test(one.log) && one.log.indexOf('kept running') !== -1, one.log);
check('and not as how the run ended, which is what the boot screen reports', !/ {2}uncaught:/.test(one.log), one.log);

const dropped = run(`${PRELUDE}
    const net = require('net');
    const server = net.createServer((socket) => { socket.on('error', () => {}); socket.destroy(); }).listen(0, '127.0.0.1', () => {
        const socket = net.connect(server.address().port, '127.0.0.1');
        // An error event nobody listens to is an uncaught exception.
        socket.on('connect', () => socket.destroy(new Error('the TV dropped the connection')));
        setTimeout(() => { console.log('still alive'); process.exit(0); }, 400);
    });`, 'dropped');

check('a socket the other end dropped, with nobody listening, is survived too', dropped.out.indexOf('still alive') !== -1 && dropped.code === 0,
    `exit ${dropped.code}: ${dropped.out}`);

const storm = run(`${PRELUDE}
    Array.from({ length: 60 }).forEach((_, n) => setTimeout(() => { throw new Error('storm ' + n); }, 10 + n));
    setTimeout(() => { console.log('still alive ' + postmortem.survivedCount()); process.exit(0); }, 600);`, 'storm');

check('sixty errors in a row are survived, and counted', storm.out.indexOf('still alive 60') !== -1 && storm.code === 0, `exit ${storm.code}: ${storm.out}`);
check('the first few are written in full', (storm.log.match(/survived: Error: storm/g) || []).length === 5, String((storm.log.match(/survived: Error: storm/g) || []).length));
check('the rest are counted, not copied into the log', storm.log.indexOf('counting them, not writing them') !== -1
    && (storm.log.match(/survived/g) || []).length === 6, String((storm.log.match(/survived/g) || []).length));

const ended = run(`${PRELUDE} setTimeout(() => process.exit(3), 50);`, 'ended');

check('leaving on purpose still leaves, and is written', ended.code === 3 && /exit: code 3/.test(ended.log), `exit ${ended.code}: ${ended.log}`);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
