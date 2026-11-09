'use strict';

const http = require('http');
const express = require('express');

const calls = { info: [], launched: [] };

// What the TV's runtime offers the service; each test sets how it answers.
const behaviour = { installed: true, launch: 'ok' };

global.tizen = {
    application: {
        getAppInfo: (id) => {
            calls.info.push(id);
            if (!behaviour.installed) throw new Error('NotFoundError');
            return { id };
        },
        launch: (id, ok, failed) => {
            calls.launched.push(id);
            if (behaviour.launch === 'ok') ok();
            else if (behaviour.launch === 'refused') failed({ message: 'refused by the platform' });
            else if (behaviour.launch === 'throws') throw new Error('threw');
        }
    }
};

const { attach } = require('../lib/launchApp.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const app = express();
attach(app);

const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;

    const post = (path, ours) => new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: ours ? { 'X-Tube': '1' } : {} }, (res) => {
            const parts = [];
            res.on('data', (c) => parts.push(c));
            res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(parts).toString() || 'null') }));
        });
        req.on('error', reject);
        req.end();
    });

    const ANI = '/__tube/launch?app=oXabc12345.EnglishAnime';

    post(ANI, false)
        .then((res) => {
            check('a post without the x-tube header is refused, and starts nothing', res.status === 403 && calls.launched.length === 0);
            return post('/__tube/launch?app=not-an-id', true);
        })
        .then((res) => {
            check('something that is not an app id is refused', res.status === 400 && res.json.ok === false && calls.launched.length === 0);
            return post('/__tube/launch?app=oXabc12345.x%20y', true);
        })
        .then((res) => {
            check('so is an id with anything odd in it', res.status === 400);
            return post(ANI, true);
        })
        .then((res) => {
            check('an installed app is started', res.status === 200 && res.json.ok === true && calls.launched[0] === 'oXabc12345.EnglishAnime');
            behaviour.installed = false;
            calls.launched.length = 0;
            return post(ANI, true);
        })
        .then((res) => {
            check('one that is not installed is reported, and not started', res.json.ok === false && res.json.reason === 'not installed' && calls.launched.length === 0);
            behaviour.installed = true;
            behaviour.launch = 'refused';
            return post(ANI, true);
        })
        .then((res) => {
            check('a launch the platform refuses is reported with its reason', res.json.ok === false && res.json.reason === 'refused by the platform');
            behaviour.launch = 'throws';
            return post(ANI, true);
        })
        .then((res) => {
            check('one that throws is answered, not left hanging', res.json.ok === false && res.json.reason === 'threw');
            delete global.tizen;
            return post(ANI, true);
        })
        .then((res) => {
            check('off a television it says so', res.json.ok === false && res.json.reason === 'not a television');
        })
        .catch((error) => check('the run finished', false, error.message))
        .then(() => {
            server.close();
            const failed = results.filter((ok) => !ok).length;
            console.log(`\n${results.length - failed}/${results.length} checks passed.`);
            process.exit(failed ? 1 : 0);
        });
});
