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

const { flatten } = require('./flattenCss.js');

const HEAD = /<head[^>]*>/i;

// Aniultimatium's own colour, which its settings change from script.
const ACCENT = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/;
const DEFAULT_ACCENT = '255,61,127';

const versionOf = () => {
    try {
        const found = /^commit (\w{7})/m.exec(fs.readFileSync(path.join(DIR, 'VERSION.txt'), 'utf8'));
        return found ? found[1] : '1';
    } catch (e) {
        return '1';
    }
};

// The first time, Aniultimatium is set to its Classic, low-end look, which its own start-up offers
// for devices like this one; the viewer can change it in its settings. Its own keys, written in the
// form its own code writes them, and only where it has not been set.
const SEED = 'try{var s=window.localStorage;'
    + 'if(s.getItem("ea_ui")===null)s.setItem("ea_ui",\'"classic"\');'
    + 'if(s.getItem("ea_lite")===null)s.setItem("ea_lite","true");}catch(e){}';

// Aniultimatium is written for a widget that may call any address and for an engine that has custom
// properties. Neither is true here, so a small script, placed before its own, makes up for both:
//  - an address on another site is asked for through the service's /cors-bypass/, which answers with
//    the access the page expects (Aniultimatium's own server answers for itself and is left alone);
//  - when the page sets its accent colour, the stylesheet is asked for again with that colour in it.
const SHIM = '(function(){'
    + 'var origin=location.origin,via=origin+"/cors-bypass/",own=/^https?:\\/\\/aniultimatium\\.advaithavinash404\\.workers\\.dev(\\/|$)/i;'
    + 'function route(u){if(typeof u!=="string"||!/^https?:\\/\\//i.test(u)||u.indexOf(origin+"/")===0||u===origin||own.test(u))return u;return via+u;}'
    + 'if(window.fetch){var f=window.fetch;window.fetch=function(input,init){'
    + 'if(typeof input==="string")input=route(input);'
    + 'else if(input&&typeof input.url==="string"&&window.Request){var r=route(input.url);if(r!==input.url)input=new Request(r,input);}'
    + 'return f.call(this,input,init);};}'
    + 'if(window.XMLHttpRequest){var o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){'
    + 'var a=Array.prototype.slice.call(arguments);a[1]=route(String(u));return o.apply(this,a);};}'
    + 'var P=window.CSSStyleDeclaration&&CSSStyleDeclaration.prototype;'
    + 'if(P&&P.setProperty){var set=P.setProperty,last="' + DEFAULT_ACCENT + '";'
    + 'P.setProperty=function(name,value){'
    + 'try{var v=String(value).replace(/\\s+/g,"");'
    + 'if(name==="--accent-rgb"&&v!==last&&/^\\d{1,3},\\d{1,3},\\d{1,3}$/.test(v)){last=v;'
    + 'var links=document.getElementsByTagName("link"),old=null;'
    + 'for(var i=0;i<links.length;i++){if(/styles\\.css/.test(links[i].getAttribute("href")||"")&&links[i].rel==="stylesheet"){old=links[i];break;}}'
    + 'if(old){var fresh=document.createElement("link");fresh.rel="stylesheet";fresh.href="styles.css?accent="+v;'
    + 'fresh.onload=function(){if(old.parentNode)old.parentNode.removeChild(old);};old.parentNode.insertBefore(fresh,old.nextSibling);}}}catch(e){}'
    + 'try{return set.apply(this,arguments);}catch(e){}};}'
    + '})();';

const bridge = () => `<script>${SEED}${SHIM}window.AniNative={version:function(){return ${JSON.stringify(versionOf())};},`
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

    // The stylesheet with its variables filled in, which is what the TV's engine can read. The
    // colour the page chose for itself, if it has, is in it.
    app.get('/aniultimatium/styles.css', (req, res) => {
        fs.readFile(path.join(DIR, 'styles.css'), 'utf8', (error, css) => {
            if (error) return res.status(404).type('text/plain').send('not found');

            const chosen = ACCENT.exec(String(req.query.accent || ''));
            const valid = chosen && [chosen[1], chosen[2], chosen[3]].every((part) => Number(part) <= 255);
            const overrides = valid ? { '--accent-rgb': chosen[0], '--accent': `rgb(${chosen[0]})` } : undefined;

            res.setHeader('Cache-Control', 'no-cache');
            return res.type('text/css').send(flatten(css, overrides));
        });
    });

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

module.exports = { attach, withBridge, DIR, SHIM };
