'use strict';

// Two instances of this service can meet on one TV: after an update or a reinstall (the one the
// install started while the one before it is still running, or no longer has its files), or a package
// installed twice. Only one can hold the port, and the TV then showed a connection error until it was
// switched off and on. The newer one now asks the one holding the port to give it up, and, where the
// platform allows, ends any other process of its own service.
//
// An instance that gives the port up does not exit (the platform would start it again, and the two
// would trade the port for ever): it stops listening and stays idle until the platform ends it.
// Only a request from the same package is honoured, so a different Tube widget is never touched.

const http = require('http');

const PATH = '/__tube/yield';

const isOwnAddress = (address, own) => {
    const from = String(address || '').replace(/^::ffff:/, '');
    return from === '127.0.0.1' || from === '::1' || /^127\./.test(from) || own().indexOf(from) !== -1;
};

const parseAsk = (buffer) => {
    try {
        return JSON.parse(buffer.toString('utf8'));
    } catch (e) {
        return null;
    }
};

// The route the instance holding the port answers on.
const attach = (app, options) => {
    const { appId, listener, note, addresses } = options;

    app.post(PATH, (req, res) => {
        // A page on another site can send a form post but not a custom header, and a request from
        // another machine is not ours.
        if (!req.get('x-tube') || !isOwnAddress(req.socket.remoteAddress, addresses)) return res.status(403).json({ error: 'not allowed' });

        const parts = [];
        req.on('data', (chunk) => { if (parts.length < 64) parts.push(chunk); });

        return req.on('end', () => {
            const asked = parseAsk(Buffer.concat(parts));
            const mine = appId();
            if (!asked || !mine || asked.appId !== mine) return res.status(409).json({ error: 'another package' });

            note('handoff', `giving the port to a newer instance of ${mine}`);
            res.json({ ok: true });

            // After the answer has gone, since closing the server ends the connection it is on.
            return setTimeout(() => listener.yieldPort(), 200);
        });
    });
};

// Asks whoever holds the port to give it up. Answers true if something of ours said it would.
const ask = (address, port, appId) => new Promise((resolve) => {
    const body = JSON.stringify({ appId });
    const req = http.request({
        host: address, port, path: PATH, method: 'POST', timeout: 3000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Tube': '1' }
    }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(body);
});

// Other processes of this package's service, ended through the platform. What cannot be ended is
// left: the request above is the way for instances that have this route.
const endOthers = (note) => new Promise((resolve) => {
    if (typeof tizen === 'undefined') return resolve(0);

    try {
        const me = tizen.application.getCurrentApplication();
        const serviceId = me.appInfo.id;

        return tizen.application.getAppsContext((contexts) => {
            const others = contexts.filter((context) => context.appId === serviceId && context.id !== me.contextId);
            if (!others.length) return resolve(0);

            const left = { count: others.length };
            const done = () => { left.count -= 1; if (left.count <= 0) resolve(others.length); };

            return others.forEach((context) => {
                note('handoff', `ending another ${serviceId} (${context.id})`);
                try {
                    tizen.application.kill(context.id, done, (error) => { note('handoff', `could not end it: ${error && error.message}`); done(); });
                } catch (e) {
                    note('handoff', `could not end it: ${e && e.message}`);
                    done();
                }
            });
        }, () => resolve(0));
    } catch (e) {
        note('handoff', `could not look for another instance: ${e && e.message}`);
        return resolve(0);
    }
});

// What the listener calls when the port is busy: ask, end, and say when it may try again.
const takeover = (options) => (address, done) => {
    const { port, appId, note } = options;
    const mine = appId();

    return Promise.all([mine ? ask(address, port, mine) : false, endOthers(note)]).then((answers) => {
        note('handoff', `${address}:${port} is held: ${answers[0] ? 'the holder agreed to give it up' : 'the holder did not answer to a request'}${answers[1] ? `; ended ${answers[1]} other process(es)` : ''}`);
        done(!!(answers[0] || answers[1]));
    });
};

module.exports = { attach, takeover, ask, endOthers, PATH };
