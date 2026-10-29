'use strict';

// The pictures offered as wallpapers, served at /__tube/wallpapers/<file>: relative to the page, so
// the same address works on whichever address the TV has. Only files in the folder are reachable.

const path = require('path');
const express = require('express');

// Two levels under the widget's root, like config.xml; the same from the source tree.
const DIR = process.env.TUBE_WALLPAPERS_DIR || path.join(__dirname, '..', '..', 'wallpapers');

const attach = (app) => {
    const files = express.Router();

    files.use(express.static(DIR, { index: false, maxAge: '1d', dotfiles: 'ignore' }));
    files.use((req, res) => res.status(404).type('text/plain').send('not found'));
    files.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        return res.status(error.status === 403 ? 403 : 404).type('text/plain').send('not found');
    });

    app.use('/__tube/wallpapers', files);
};

module.exports = { attach, DIR };
