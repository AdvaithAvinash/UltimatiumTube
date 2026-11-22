// The app as a Samsung TV's own web engine runs it: the widget unpacked, its index.html opened with
// the TV's API (tizen) in every window and the web engine's relaxed rules for an app that may reach
// any origin, and a stand-in for www.youtube.com. It checks that the loader fetches YouTube's TV page,
// writes it into the app's window with UltimatiumTube's script on top, that the page reads as
// www.youtube.com, that YouTube writing a page of its own is caught and written again, that it waits
// and tries again while YouTube cannot be reached, and that Exit leaves the app.
//
//   node test/tv/loader.cjs release/UltimatiumTubetizen5.5.wgt
//
// Needs Playwright with Chromium, openssl, and port 443 (root).
'use strict';

const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const WGT = path.resolve(process.argv[2] || 'release/UltimatiumTubetizen5.5.wgt');
const AGENT = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.5) AppleWebKit/537.36 (KHTML, like Gecko) 69.0.3497.106/5.5 TV Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (label, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <- ${detail || ''}`}`); results.push(!!ok); };

const youtube = { up: false, asked: [] };

const stand = (key, cert) => new Promise((resolve, reject) => {
    const server = https.createServer({ key, cert }, (req, res) => {
        youtube.asked.push(req.url);
        if (!youtube.up) { req.socket.destroy(); return; }
        if (req.url.split('?')[0] === '/tv') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' });
            res.end('<!DOCTYPE html><html><head><title>YouTube</title><script>window.__ytHeadRan = location.href;</script></head><body>'
                + '<div id="yt">stand-in youtube tv</div><script>window._yttv = {}; window.__ytBodySaw = location.href;</script></body></html>');
            return;
        }
        res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
        res.end('{}');
    });
    server.on('error', reject);
    server.listen(443, '127.0.0.1', () => resolve(server));
});

// What the TV's engine gives every window of the app.
const TIZEN = `(() => {
  window.__tubeKeys = window.__tubeKeys || [];
  window.tizen = {
    tvinputdevice: { registerKey: (name) => { (window.opener && window.opener.__tubeKeys || window.__tubeKeys).push(name); } },
    application: { getCurrentApplication: () => ({ exit: () => { window.__tubeExited = true; } }) }
  };
})();`;

(async () => {
    const keys = fs.mkdtempSync(path.join(os.tmpdir(), 'loaderkeys-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(keys, 'key.pem'), '-out', path.join(keys, 'cert.pem'),
        '-days', '2', '-subj', '/CN=www.youtube.com'], { stdio: 'ignore' });
    const server = await stand(fs.readFileSync(path.join(keys, 'key.pem')), fs.readFileSync(path.join(keys, 'cert.pem')));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loaderwgt-'));
    execFileSync('unzip', ['-q', WGT, '-d', dir]);
    const config = fs.readFileSync(path.join(dir, 'config.xml'), 'utf8');
    check('the widget claims no Cobalt container', !/nativeID|native\.userdata/.test(config));
    check('and opens the loader', /<content src="index\.html"\/>/.test(config) && fs.existsSync(path.join(dir, 'loader.js')) && fs.existsSync(path.join(dir, 'userScript.js')));

    // Straight to the stand-in: no proxy of this machine's in between.
    const env = Object.assign({}, process.env);
    ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'].forEach((name) => delete env[name]);
    const browser = await chromium.launch({
        env,
        args: ['--host-resolver-rules=MAP www.youtube.com 127.0.0.1', '--ignore-certificate-errors', '--disable-web-security',
            '--allow-file-access-from-files', '--disable-popup-blocking', '--no-proxy-server',
            '--disable-features=IsolateOrigins,site-per-process']
    });
    const context = await browser.newContext({ userAgent: AGENT, viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
    await context.addInitScript(TIZEN);
    const errors = [];
    context.on('page', (p) => p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200))));

    const loaderPage = await context.newPage();
    loaderPage.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    const popup = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
    await loaderPage.goto('file://' + path.join(dir, 'index.html'));

    // YouTube is out of reach at first.
    await sleep(2500);
    const waiting = await loaderPage.evaluate(() => document.body.innerText);
    check('while YouTube cannot be reached, the loader says so and tries again', /Cannot reach YouTube/.test(waiting) && /Trying again/.test(waiting), waiting.slice(0, 120));

    youtube.up = true;
    const app = await popup;
    check('the app opens a window for YouTube', !!app);
    if (!app) throw new Error('no window');

    const until = async (test, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const ok = await test().catch(() => false); if (ok) return true; await sleep(300); } return false; };
    check('YouTube\'s TV page is written into it once YouTube answers', await until(() => app.evaluate(() => /stand-in youtube tv/.test(document.body.innerText)), 15000));

    const seen = await app.evaluate(() => ({ head: window.__ytHeadRan, body: window.__ytBodySaw, host: window.__tubeHost, service: window.__tubeService,
        ours: typeof window.queuedVideos !== 'undefined' || !!document.getElementById('tube-glass') || typeof window.tubeRemote !== 'undefined', values: typeof Object.values }));
    check('the page reads as www.youtube.com/tv before YouTube\'s own scripts run', /^https:\/\/www\.youtube\.com\/tv#\//.test(seen.head || '') && /^https:\/\/www\.youtube\.com\/tv/.test(seen.body || ''), JSON.stringify(seen));
    check('it is told it runs in the TV\'s engine, and where the app\'s service is', seen.host === 'wrt' && seen.service === 'http://127.0.0.1:8189', JSON.stringify(seen));
    check('UltimatiumTube\'s script ran in it', seen.ours, JSON.stringify(seen));
    const keysSeen = await loaderPage.evaluate(() => window.__tubeKeys);
    check('the remote\'s media and colour keys are asked for', ['MediaPlayPause', 'ColorF0Red', 'ColorF3Blue'].every((k) => keysSeen.indexOf(k) !== -1), JSON.stringify(keysSeen));

    // YouTube writes a page of its own (a sign-in, a reload): our script is gone, and it is written again.
    // YouTube loads a page of its own (after a sign-in, say): our script is not in it.
    await app.goto('https://www.youtube.com/tv?signed=in').catch(() => undefined);
    const ourWindow = async () => {
        const pages = context.pages().filter((p) => p !== loaderPage && !p.isClosed());
        const marks = await Promise.all(pages.map((p) => p.evaluate(() => window.__tubeHost === 'wrt'
            && /stand-in youtube tv/.test(document.body.innerText)).catch(() => false)));
        return pages[marks.indexOf(true)] || null;
    };
    check('a page YouTube loaded by itself is caught and YouTube is written again, with our script', await until(async () => !!(await ourWindow()), 15000));
    await sleep(4000);
    const writes = youtube.asked.filter((url) => url.split('?')[0] === '/tv').length;
    await sleep(4000);
    check('and only once: nothing is written over and over', youtube.asked.filter((url) => url.split('?')[0] === '/tv').length === writes,
        `${youtube.asked.length} asks`);
    const shown = await ourWindow();

    const before = errors.length;
    // The message the Exit key sends (Chromium ignores keyCode in a made-up key event).
    await (shown || app).evaluate(() => window.opener.postMessage({ tube: 'exit' }, '*')).catch(() => undefined);
    check('Exit leaves the app', await until(() => loaderPage.evaluate(() => window.__tubeExited === true), 5000));
    check('no script errors on the way', errors.length === 0 && before === 0, JSON.stringify(errors.slice(0, 3)));

    await browser.close();
    server.close();
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})().catch((error) => { console.log(`FAIL  ${error.stack}`); process.exit(1); });
