'use strict';

// Aniultimatium, bundled in the widget and served by this service. A Samsung widget's own pages are
// never shown (the TV starts the YouTube container in their place), so the mode is a page of this
// service, opened from the YouTube settings, and Back goes home to YouTube again.
//
// The bundled files are Aniultimatium's own and are served as they are. The one thing added is a
// small AniNative object, the same shape its Android app gives it, so that the app's own Back
// handling ends with exit() and exit() returns to YouTube.

const fs = require('fs');
const path = require('path');
const express = require('express');

// Two levels under the widget's root, like config.xml; the same from the source tree.
const DIR = process.env.TUBE_ANI_DIR || path.join(__dirname, '..', '..', 'aniultimatium');

const HEAD = /<head[^>]*>/i;

const versionOf = () => {
    try {
        const found = /^commit (\w{7})/m.exec(fs.readFileSync(path.join(DIR, 'VERSION.txt'), 'utf8'));
        return found ? found[1] : '1';
    } catch (e) {
        return '1';
    }
};

const bridge = () => `<script>window.AniNative={version:function(){return ${JSON.stringify(versionOf())};},`
    + 'sdk:function(){return 0;},exit:function(){window.location.replace("/tv");}};</script>';

const withBridge = (html) => (HEAD.test(html)
    ? html.replace(HEAD, (open) => open + bridge())
    : bridge() + html);

const attach = (app) => {
    const entry = (req, res) => {
        fs.readFile(path.join(DIR, 'index.html'), 'utf8', (error, html) => {
            if (error) return res.status(404).type('text/plain').send('Aniultimatium is not bundled in this build.');

            res.setHeader('Cache-Control', 'no-store');
            return res.type('html').send(withBridge(html));
        });
    };

    // Express treats /aniultimatium and /aniultimatium/ as one route, so the trailing slash is read here.
    app.get('/aniultimatium', (req, res) => {
        const path = String(req.originalUrl).split('?')[0];
        return path.slice(-1) === '/' ? entry(req, res) : res.redirect(302, '/aniultimatium/index.html');
    });
    app.get('/aniultimatium/index.html', entry);

    // Beyond the entry page nothing is touched. What is missing or refused ends here as a plain
    // answer: falling on to the proxy would ask YouTube for it.
    const files = express.Router();
    files.use(express.static(DIR, { index: false }));
    files.use((req, res) => res.status(404).type('text/plain').send('not found'));
    files.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        return res.status(error.status === 403 ? 403 : 404).type('text/plain').send('not found');
    });

    app.use('/aniultimatium', files);
};

module.exports = { attach, withBridge, DIR };
