'use strict';

// The Stremio page, bundled in the widget and served by this service: a page of
// the service, opened from the YouTube settings, with Back going home to YouTube. Its files are
// written for this engine, so they are served as they are.

const path = require('path');
const express = require('express');

// Two levels under the widget's root, like config.xml; the same from the source tree.
const DIR = process.env.TUBE_STREMIO_DIR || path.join(__dirname, '..', '..', 'stremio');

const attach = (app) => {
    // Express treats /stremio and /stremio/ as one route, so the trailing slash is read here.
    app.get('/stremio', (_, res) => {
        return res.redirect(302, '/stremio/index.html');
    });

    // Beyond the files nothing is touched. What is missing ends here as a plain answer: falling on
    // to the proxy would ask YouTube for it.
    const files = express.Router();
    files.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-cache');
        next();
    });
    files.use(express.static(DIR, { index: false }));
    files.use((req, res) => res.status(404).type('text/plain').send('not found'));
    files.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        return res.status(error.status === 403 ? 403 : 404).type('text/plain').send('not found');
    });

    app.use('/stremio', files);
};

module.exports = { attach, DIR };
