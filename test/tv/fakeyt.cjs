'use strict';

// A stand-in for www.youtube.com, on this machine's port 443, for the TV simulation: the TV page,
// the address the service checks the network with, and an empty answer for everything else.

const https = require('https');
const fs = require('fs');

const start = (key, cert, log) => new Promise((resolve, reject) => {
    const server = https.createServer({ key, cert }, (req, res) => {
        fs.appendFileSync(log, `${req.method} ${req.headers.host}${req.url}\n`);

        if (req.url.indexOf('/generate_204') === 0) {
            res.writeHead(204);
            return res.end();
        }

        if (req.url.split('?')[0] === '/tv') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end('<!DOCTYPE html><html><head><title>YouTube</title></head><body>'
                + '<div id="yt">stand-in youtube tv</div><script>window._yttv = {};</script></body></html>');
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end('{}');
    });

    server.on('error', reject);
    server.listen(443, '127.0.0.1', () => resolve(server));
});

module.exports = { start };
