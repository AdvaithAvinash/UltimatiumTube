'use strict';

// A playlist made of any videos, for the Control Center's smart playlists: YouTube turns a list of
// video ids into a temporary playlist at /watch_videos and answers with a redirect naming it (list=).
// The page then opens the first video in that list, and YouTube plays the rest one after another.

const { send } = require('./sending.js');
const { PassThrough } = require('stream');

const ID = /^[A-Za-z0-9_-]{11}$/;
const MOST = 50;

const get = () => {
    const req = new PassThrough();
    req.method = 'GET';
    req.end();
    return req;
};

const listIn = (location) => {
    const found = /[?&]list=([A-Za-z0-9_-]+)/.exec(String(location || ''));
    return found ? found[1] : null;
};

const attach = (app) => app.get('/__tube/playlist', (req, res) => {
    const ids = String(req.query.ids || '').split(',').filter((id) => ID.test(id)).slice(0, MOST);
    if (!ids.length) return res.status(400).json({ error: 'no video ids' });

    res.setHeader('Cache-Control', 'no-store');

    return send(`https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`, get(), {
        host: 'www.youtube.com',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept-encoding': 'gzip, deflate'
    }).then((response) => {
        const list = listIn(response.headers.get('location'));
        if (response.body && response.body.resume) response.body.resume();
        res.json({ ids, list });
    }).catch((error) => res.status(502).json({ ids, list: null, error: error.message }));
});

module.exports = { attach, listIn };
