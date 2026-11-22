// The packaged app against the real www.youtube.com/tv (needs the network): the loader opens YouTube
// with UltimatiumTube on it, the welcome panel offers the two interfaces, and choosing one loads
// YouTube afresh in it. SmartTube style must show: the focused button turns SmartTube red.
//
//   node test/tv/realyoutube.cjs release/UltimatiumTubetizen5.5.wgt
'use strict';

const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WGT = path.resolve(process.argv[2] || 'release/UltimatiumTubetizen5.5.wgt');
const AGENT = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (label, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <- ${detail || ''}`}`); results.push(!!ok); };
const TIZEN = `window.tizen = { tvinputdevice: { registerKey: () => undefined }, application: { getCurrentApplication: () => ({ exit: () => { window.__tubeExited = true; } }) } };`;

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realwgt-'));
    execFileSync('unzip', ['-q', WGT, '-d', dir]);
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const browser = await chromium.launch(Object.assign({
        args: ['--disable-web-security', '--allow-file-access-from-files', '--disable-popup-blocking', '--ignore-certificate-errors',
            '--disable-features=IsolateOrigins,site-per-process']
    }, proxy ? { proxy: { server: proxy } } : {}));
    const context = await browser.newContext({ userAgent: AGENT, viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
    await context.addInitScript(TIZEN);
    const loaderPage = await context.newPage();

    const until = async (test, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const ok = await test().catch(() => false); if (ok) return ok; await sleep(500); } return false; };
    const youtubeWindow = async () => {
        const pages = context.pages().filter((p) => p !== loaderPage && !p.isClosed());
        const marks = await Promise.all(pages.map((p) => p.evaluate(() => window.__tubeHost === 'wrt' && window.__tubeStarted === true
            && !!document.querySelector('ytlr-app')).catch(() => false)));
        return pages[marks.indexOf(true)] || null;
    };

    await loaderPage.goto('file://' + path.join(dir, 'index.html'));
    const first = await until(youtubeWindow, 60000);
    check('real YouTube opens with UltimatiumTube on it', !!first);
    if (!first) throw new Error('YouTube did not open');

    const panel = await until(() => first.evaluate(() => {
        const glass = document.getElementById('tube-glass');
        return glass && /Welcome to UltimatiumTube/.test(glass.innerText) && /Stock YouTube UI/.test(glass.innerText) && /SmartTube UI/.test(glass.innerText);
    }), 40000);
    check('the welcome panel offers Stock YouTube UI and SmartTube UI', !!panel);

    await first.bringToFront();
    await first.keyboard.press('ArrowRight');
    await sleep(400);
    await first.keyboard.press('Enter');

    const fresh = await until(async () => {
        const win = await youtubeWindow();
        return win && win !== first ? win : false;
    }, 60000);
    check('choosing SmartTube UI loads YouTube afresh, in a new window', !!fresh);
    const mode = await loaderPage.evaluate(() => JSON.parse(localStorage.getItem('tube.settings') || '{}').uiMode);
    check('and SmartTube is the mode kept', mode === 'smarttube', String(mode));

    if (fresh) {
        const red = await until(() => fresh.evaluate(() => {
            const focused = Array.from(document.querySelectorAll('ytlr-button.zylon-focus, yt-button-container.zylon-focus'))
                .filter((e) => !e.querySelector('.zylon-focus'));
            return focused.length && focused.every((b) => getComputedStyle(b).backgroundColor === 'rgb(229, 57, 53)')
                ? getComputedStyle(document.body).backgroundColor : false;
        }), 40000);
        check('SmartTube style shows: the focused button is SmartTube red, on dark grey', red === 'rgb(18, 18, 18)', String(red));
        await fresh.screenshot({ path: path.join(os.tmpdir(), 'smarttube.png') });

        // Back to Stock YouTube UI: YouTube's own look again.
        const panelAgain = await until(() => fresh.evaluate(() => !!document.getElementById('tube-glass')), 40000);
        if (panelAgain) {
            await fresh.bringToFront();
            await fresh.keyboard.press('ArrowLeft');
            await sleep(400);
            await fresh.keyboard.press('Enter');
        }
        const stock = await until(async () => {
            const win = await youtubeWindow();
            return win && win !== fresh ? win : false;
        }, 60000);
        check('choosing Stock YouTube UI loads YouTube afresh too', !!stock);
        if (stock) {
            const plain = await until(() => stock.evaluate(() => {
                const focused = Array.from(document.querySelectorAll('ytlr-button.zylon-focus, yt-button-container.zylon-focus'))
                    .filter((e) => !e.querySelector('.zylon-focus'));
                return focused.length ? getComputedStyle(focused[0]).backgroundColor : false;
            }), 40000);
            check('and YouTube’s own look is back: the focused button is YouTube’s light grey', plain === 'rgb(241, 241, 241)', String(plain));
        }
    }

    await browser.close();
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})().catch((error) => { console.log(`FAIL  ${error.stack}`); process.exit(1); });
