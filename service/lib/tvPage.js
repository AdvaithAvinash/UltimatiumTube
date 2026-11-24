'use strict';

// YouTube's TV page as YouTube gives it to Samsung's own YouTube app. YouTube decides from the first
// load of /tv which TV app it serves: to Samsung's YouTube engine (Cobalt) the full one, with Shorts in
// the Shorts player (a sequence of Shorts with each) and search as in the app; to a TV's web browser a
// cut-down one. The app's loader runs in that browser, which cannot say it is anything else, so it
// asks here, and this asks YouTube as Samsung's YouTube app does. Nothing else depends on it: a loader
// that gets no answer loads YouTube itself.

const { PassThrough } = require('stream');

const { send } = require('./sending.js');

const ROUTE = '/__tube/tvpage';

// Samsung's YouTube app, as YouTube sees it (a 2023 set's Cobalt 25).
const APP_AGENT = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 8.0) AppleWebKit/537.36 (KHTML, like Gecko) 120.0.6099.5/8.0 TV Safari/537.36 '
    + 'Cobalt/25.lts.30.1034943-gold (unlike Gecko) v8/8.8.278.17-jit gles Evergreen-Full';

const pageUrl = () => process.env.TUBE_TV_PAGE_URL || 'https://www.youtube.com/tv';

const get = () => {
    const req = new PassThrough();
    req.method = 'GET';
    req.end();
    return req;
};

const looksRight = (text) => /<html/i.test(text) && /ytcfg|INNERTUBE_CONTEXT|kabuki/.test(text);

const attach = (app) => app.get(ROUTE, (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');

    const headers = {
        'user-agent': APP_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': String(req.get('accept-language') || 'en-US,en;q=0.9').slice(0, 200),
        'accept-encoding': 'gzip, deflate'
    };

    send(pageUrl(), get(), headers)
        .then((response) => response.text().then((text) => ({ status: response.status, text })))
        .then((answer) => {
            if (answer.status !== 200 || !looksRight(answer.text)) {
                res.status(502).type('text/plain').send(`YouTube answered ${answer.status}`);
                return;
            }
            res.status(200).type('text/html').send(answer.text);
        })
        .catch((error) => res.status(502).type('text/plain').send(String((error && (error.code || error.message)) || 'no answer')));
});

module.exports = { attach, ROUTE, APP_AGENT, looksRight };
