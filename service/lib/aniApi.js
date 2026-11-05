'use strict';

// Aniultimatium's own server, as the page served here sees it.
//
// Aniultimatium decides where its data comes from by where it was served from: on a home-network
// address (like this TV's) it takes that address for a local server of its own and asks it for
// everything, at <address>/api?action=... A widget is on no such address and asks its real server.
// Here that address is this service, which has no such thing, so every row, search and source came
// back empty. This answers those calls by passing them on to the real one.

const fs = require('fs');
const path = require('path');

const { send } = require('./sending.js');
const { DIR } = require('./aniultimatium.js');

const FALLBACK = 'https://aniultimatium.advaithavinash404.workers.dev';

// Read from the bundled app, so a newer Aniultimatium that moves its server is followed.
const SERVER = /^\s*(?:const|var|let)\s+VERCEL_API_URL\s*=\s*["']([^"']+)["']/;

const serverOf = () => {
    if (process.env.TUBE_ANI_API) return process.env.TUBE_ANI_API.replace(/\/+$/, '');

    try {
        const first = fs.readFileSync(path.join(DIR, 'main.js'), 'utf8').split('\n')[0];
        const found = SERVER.exec(first);
        if (found && /^https:\/\//.test(found[1])) return found[1].replace(/\/+$/, '');
    } catch (error) {
        // Not bundled, or unreadable: the one it has always had.
    }

    return FALLBACK;
};

// What the page says to the server, and nothing else: no cookies of YouTube's, no address of ours.
const PASSED = ['authorization', 'content-type', 'accept', 'accept-language', 'range', 'if-none-match', 'if-modified-since'];
const COMES_BACK = ['content-type', 'cache-control', 'etag', 'last-modified', 'content-range', 'accept-ranges', 'location', 'retry-after'];

// Readable.destroy arrived in node 8.
const release = (stream) => (typeof stream.destroy === 'function' ? stream.destroy() : stream.unpipe().resume());

const attach = (app) => app.all('/api', (req, res, next) => {
    // /api with no action is not Aniultimatium's.
    if (typeof req.query.action !== 'string') return next();

    const base = serverOf();
    const headers = {};

    PASSED.forEach((name) => {
        if (req.headers[name]) headers[name] = req.headers[name];
    });

    headers.host = base.replace(/^https?:\/\//, '');
    headers['user-agent'] = req.headers['user-agent'] || 'UltimatiumTube';
    headers['accept-encoding'] = 'gzip, deflate';

    // An unhandled 'error' on the response socket is an uncaught exception.
    res.on('error', () => res.destroy());

    return send(`${base}${req.originalUrl}`, req, headers)
        .then((response) => {
            res.status(response.status);

            COMES_BACK.forEach((name) => {
                const value = response.headers.get(name);
                if (value) res.setHeader(name, value);
            });

            res.setHeader('Access-Control-Allow-Origin', '*');

            if (!response.body) return res.end();

            const dropped = { yes: false };
            res.on('close', () => {
                dropped.yes = true;
                release(response.body);
            });
            response.body.on('error', () => {
                if (!dropped.yes) res.destroy();
            });

            return response.body.pipe(res);
        })
        .catch((error) => {
            if (res.headersSent) return res.destroy();

            return res.status(502).json({ error: `Aniultimatium's server did not answer: ${error && error.message}` });
        });
});

module.exports = { attach, serverOf };
