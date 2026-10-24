'use strict';

// The meeting point between the TV's userscript and a phone's browser. The userscript posts the
// settings it holds every few seconds and takes back whatever the phone changed; nothing here
// outlives the service, because the settings themselves live in the page.

const { page } = require('./phonePage.js');
const ports = require('./ports.js');
const { lanAddresses } = require('./serviceAddress.js');

const LIMIT = 256 * 1024;
const FRESH = 15000;
const KEPT = 300;

const state = { seq: 0, changes: [], config: null, schema: null, seen: 0 };

const kindOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

// A value is taken only in the shape the TV already holds, so a stray file cannot store nonsense.
const fits = (key, value) => !!state.config
    && Object.prototype.hasOwnProperty.call(state.config, key)
    && kindOf(state.config[key]) === kindOf(value);

const addressFor = (host) => {
    const named = host ? String(host).replace(/:\d+$/, '') : '';
    return `http://${named || lanAddresses()[0] || 'tv-address'}:${ports.PROXY}/settings`;
};

const readJson = (req, res, done) => {
    const parts = [];
    const seen = { size: 0, over: false };

    req.on('data', (chunk) => {
        seen.size += chunk.length;
        if (seen.size > LIMIT) {
            seen.over = true;
            return;
        }

        parts.push(chunk);
    });

    req.on('end', () => {
        if (seen.over) return res.status(413).json({ error: 'too large' });

        try {
            return done(JSON.parse(Buffer.concat(parts).toString('utf8')));
        } catch (e) {
            return res.status(400).json({ error: 'not json' });
        }
    });
};

// A page on another site can send a form post but not a custom header, so this keeps one from
// changing the TV's settings.
const asOurs = (req, res) => {
    if (req.get('x-tube')) return true;

    res.status(403).json({ error: 'missing x-tube header' });
    return false;
};

const apply = (incoming) => {
    const taken = [];

    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return taken;

    Object.keys(incoming).forEach((key) => {
        if (!fits(key, incoming[key])) return;

        state.seq += 1;
        state.changes.push({ seq: state.seq, key, value: incoming[key] });
        state.config[key] = incoming[key];
        taken.push(key);
    });

    state.changes = state.changes.slice(-KEPT);
    return taken;
};

const attach = (app) => {
    app.get('/settings', (_, res) => {
        res.removeHeader('Content-Security-Policy');
        res.type('html').send(page());
    });

    app.get('/api/settings', (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            online: Date.now() - state.seen < FRESH,
            schema: state.schema,
            config: state.config || {},
            address: addressFor(req.headers.host)
        });
    });

    app.post('/api/settings', (req, res) => {
        if (!asOurs(req, res)) return;

        readJson(req, res, (body) => {
            if (!state.config) return res.status(409).json({ error: 'the TV has not connected yet' });

            const taken = apply(body && body.changes);
            return res.json({ ok: true, taken: taken.length, seq: state.seq });
        });
    });

    // From the userscript, through the container's proxy.
    app.post('/__tube/phone/sync', (req, res) => {
        if (!asOurs(req, res)) return;

        readJson(req, res, (body) => {
            const heldSeq = Number(body && body.seq) || 0;

            if (body && body.config && typeof body.config === 'object') {
                state.config = body.config;
                // What the phone changed since this snapshot was taken is still pending, and a
                // stale snapshot must not undo it in the phone's view.
                state.changes.filter((change) => change.seq > heldSeq)
                    .forEach((change) => { state.config[change.key] = change.value; });
            }

            if (body && body.schema) state.schema = body.schema;
            state.seen = Date.now();

            res.json({
                seq: state.seq,
                changes: state.changes.filter((change) => change.seq > heldSeq),
                needSchema: !state.schema,
                // The userscript reaches us through the container's proxy, so its Host header names
                // YouTube; the address a phone needs is the TV's own.
                address: addressFor(null)
            });
        });
    });
};

// For the tests: a service starts with nothing and a TV's first post fills it in.
const reset = () => {
    state.seq = 0;
    state.changes = [];
    state.config = null;
    state.schema = null;
    state.seen = 0;
};

module.exports = { attach, reset };
