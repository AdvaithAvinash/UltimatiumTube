'use strict';

// A copy of what the TV page keeps in its storage (YouTube's sign-in among it), held in this app's
// own folder on the TV. The page's storage belongs to the address the page was opened at, and on a
// Tizen 5.5+ set that is the set's own network address: when the router hands the set another one,
// the page opens at the new address with empty storage, and every account reads as signed out.
// The page posts its storage here now and then and, finding itself at a new address, takes it back.
//
// Sign-in tokens are in it, so only the TV itself is answered: never another device on the network.

const fs = require('fs');
const path = require('path');

const { lanAddresses } = require('./serviceAddress.js');

const ROUTE = '/__tube/keep';
const LIMIT = 6 * 1024 * 1024;

const fileOf = () => path.join(process.env.TUBE_SHARE || '/home/owner/share/ultimatiumtube', 'keep.json');

const addressOf = (req) => String((req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');

const fromThisSet = (req) => {
    const address = addressOf(req);
    return /^127\./.test(address) || address === '::1' || lanAddresses().indexOf(address) !== -1;
};

// A page on another site can send a form post but not a custom header.
const allowed = (req, res) => {
    if (!fromThisSet(req)) {
        res.status(403).json({ ok: false, reason: 'only the TV itself' });
        return false;
    }

    if (!req.get('x-tube')) {
        res.status(403).json({ ok: false, reason: 'missing x-tube header' });
        return false;
    }

    return true;
};

const valid = (body) => !!body && typeof body === 'object' && typeof body.origin === 'string'
    && !!body.items && typeof body.items === 'object' && !Array.isArray(body.items)
    && Object.keys(body.items).every((key) => typeof body.items[key] === 'string');

const read = () => {
    try {
        const held = JSON.parse(fs.readFileSync(fileOf(), 'utf8'));
        return valid(held) ? held : null;
    } catch (error) {
        return null;
    }
};

const parse = (text) => {
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
};

// Written beside and moved over, so a power cut mid-write leaves the last copy whole.
const write = (body) => {
    const file = fileOf();
    const passing = `${file}.new`;

    try {
        fs.mkdirSync(path.dirname(file));
    } catch (error) {
        // There already, as a rule.
    }

    fs.writeFileSync(passing, JSON.stringify({ origin: body.origin, at: Date.now(), items: body.items }));
    fs.renameSync(passing, file);
};

const attach = (app) => {
    app.get(ROUTE, (req, res) => {
        if (!allowed(req, res)) return;

        res.set('Cache-Control', 'no-store');
        res.json(read() || {});
    });

    app.post(ROUTE, (req, res) => {
        if (!allowed(req, res)) return;

        const parts = [];
        const seen = { size: 0, over: false };

        req.on('data', (chunk) => {
            seen.size += chunk.length;
            if (seen.size > LIMIT) seen.over = true;
            else parts.push(chunk);
        });

        req.on('end', () => {
            if (seen.over) return res.status(413).json({ ok: false, reason: 'too large' });

            const body = parse(Buffer.concat(parts).toString('utf8'));

            if (!valid(body)) return res.status(400).json({ ok: false, reason: 'not a copy of the page storage' });

            try {
                write(body);
            } catch (error) {
                return res.status(500).json({ ok: false, reason: error.code || error.message });
            }

            return res.json({ ok: true });
        });
    });
};

module.exports = { attach, ROUTE, read };
