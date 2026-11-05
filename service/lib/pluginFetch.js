'use strict';

// Requests made for the Stremio page's Grayjay plugins. A plugin sets headers a page may not (User-Agent,
// Cookie, Referer) and reads whatever site it names, so the request is made here and the answer handed
// back as JSON: status, address after redirects, headers and the body as text.

const { PassThrough } = require('stream');

const { send } = require('./sending.js');

const LIMIT = 1024 * 1024;
const BODY_LIMIT = 6 * 1024 * 1024;
const MOST_REDIRECTS = 5;
const AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BODIED = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Only what a plugin has any business asking for: no one else's cookies, no address of this TV's.
const refused = (name) => /^(host|content-length|connection|transfer-encoding|proxy-)/i.test(name);

const requestFor = (method, body) => {
    const stream = new PassThrough();
    stream.method = method;
    if (BODIED.indexOf(method) !== -1 && body !== undefined && body !== null && body !== '') stream.end(Buffer.from(String(body), 'utf8'));
    else stream.end();
    return stream;
};

const SAFE = /^https?:\/\//i;

// Follows redirects itself, as a browser would, so the plugin sees where it ended up.
const follow = (url, method, headers, body, left) => {
    const sent = {};
    Object.keys(headers).forEach((name) => { if (!refused(name)) sent[name.toLowerCase()] = String(headers[name]); });
    if (!sent['user-agent']) sent['user-agent'] = AGENT;
    if (!sent.accept) sent.accept = '*/*';
    sent['accept-encoding'] = 'gzip, deflate';

    const req = requestFor(method, body);

    return send(url, method === 'GET' || method === 'HEAD' ? Object.assign(req, { method }) : req, sent).then((response) => {
        const location = response.headers.get('location');

        if (response.status >= 300 && response.status < 400 && location && left > 0) {
            const next = SAFE.test(location) ? location : new (require('url').URL)(location, url).toString();
            const again = response.status === 307 || response.status === 308;
            return follow(next, again ? method : 'GET', headers, again ? body : undefined, left - 1);
        }

        return response.buffer().then((buffer) => ({ response, buffer, url }));
    });
};

const parseBody = (buffer) => {
    try {
        return JSON.parse(buffer.toString('utf8'));
    } catch (e) {
        return null;
    }
};

const attach = (app) => {
    app.post('/__tube/fetch', (req, res) => {
        // A page on another site can send a form post but not a custom header.
        if (!req.get('x-tube')) return res.status(403).json({ error: 'missing x-tube header' });

        const parts = [];
        const seen = { size: 0, over: false };

        req.on('data', (chunk) => {
            seen.size += chunk.length;
            if (seen.size > LIMIT) { seen.over = true; return; }
            parts.push(chunk);
        });

        return req.on('end', () => {
            if (seen.over) return res.status(413).json({ error: 'too large' });

            const parsed = parseBody(Buffer.concat(parts));
            if (!parsed || typeof parsed !== 'object') return res.status(400).json({ error: 'not json' });

            const ask = parsed;

            const method = String(ask.method || 'GET').toUpperCase();
            if (!ask || !SAFE.test(String(ask.url || '')) || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].indexOf(method) === -1) {
                return res.status(400).json({ error: 'bad request' });
            }

            res.setHeader('Cache-Control', 'no-store');

            return follow(String(ask.url), method, ask.headers && typeof ask.headers === 'object' ? ask.headers : {}, ask.body, MOST_REDIRECTS)
                .then((got) => {
                    const headers = got.response.headers.raw();
                    const body = got.buffer.length > BODY_LIMIT ? '' : got.buffer.toString('utf8');
                    return res.json({ status: got.response.status, url: got.url, headers, body });
                })
                .catch((error) => res.status(502).json({ error: `the request failed: ${error.message}` }));
        });
    });
};

module.exports = { attach };
