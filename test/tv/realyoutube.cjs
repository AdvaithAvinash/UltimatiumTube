// The packaged app against the real www.youtube.com/tv (needs the network): the loader opens YouTube
// with UltimatiumTube on it, the welcome panel offers the two interfaces, and choosing one loads
// YouTube afresh in it. SmartTube UI is UltimatiumTube's own home screen: a section of real videos,
// one opened in YouTube's player, Back home again.
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
        const home = await until(() => fresh.evaluate(() => {
            const root = document.getElementById('tube-smart');
            if (!root || root.style.display === 'none') return false;
            const rect = root.getBoundingClientRect();
            return rect.width > 1000 && /UltimatiumTube/.test(root.querySelector('.ust-logo').innerText.replace(/\s+/g, ''))
                && root.querySelectorAll('.ust-item').length >= 10;
        }), 40000);
        check('SmartTube UI: UltimatiumTube\u2019s own home screen, its name where SmartTube\u2019s would be, a side menu', !!home);
        await sleep(3000);
        await fresh.screenshot({ path: path.join(os.tmpdir(), 'smarttube-home.png') });

        // The welcome panel opens over it every time; Back keeps the interface there is.
        await fresh.bringToFront();
        await until(() => fresh.evaluate(() => !!document.getElementById('tube-glass')), 20000);
        await fresh.keyboard.press('Escape');
        await sleep(600);
        check('Back on the welcome panel leaves the UltimatiumTube home screen there', await fresh.evaluate(() => !document.getElementById('tube-glass')
            && document.getElementById('tube-smart').style.display !== 'none'));

        // Down the side menu to Gaming, which YouTube fills even without an account, and open it.
        for (let i = 0; i < 5; i += 1) { await fresh.keyboard.press('ArrowDown'); await sleep(250); }
        await fresh.keyboard.press('Enter');
        const rows = await until(() => fresh.evaluate(() => {
            const cards = document.querySelectorAll('#tube-smart .ust-card');
            const title = document.querySelector('#tube-smart .ust-title');
            return cards.length >= 5 && title && title.textContent === 'Gaming' ? cards.length : false;
        }), 30000);
        check('a section fills with rows of YouTube\u2019s own videos', !!rows, String(rows));

        const readable = await fresh.evaluate(() => {
            const focused = document.querySelector('#tube-smart .ust-card.ust-focus');
            const label = document.querySelector('#tube-smart .ust-card-title');
            const item = document.querySelector('#tube-smart .ust-item.ust-current .ust-label');
            const lum = (rgb) => { const m = /(\d+), (\d+), (\d+)/.exec(rgb) || [0, 0, 0, 0]; return (+m[1] + +m[2] + +m[3]) / 3; };
            return { focused: !!focused, ring: focused ? getComputedStyle(focused.querySelector('.ust-thumb')).boxShadow : '',
                title: label ? lum(getComputedStyle(label).color) : 0, item: item ? lum(getComputedStyle(item).color) : 0 };
        });
        check('everything is readable: light text on the dark screen, the focused card ringed in red', readable.focused
            && /229, 57, 53/.test(readable.ring) && readable.title > 180 && readable.item > 180, JSON.stringify(readable));
        await sleep(2500);
        await fresh.screenshot({ path: path.join(os.tmpdir(), 'smarttube-rows.png') });

        // Down into a row of videos and open one: YouTube's own player, the home screen out of the way.
        let video = false;
        for (let tries = 0; tries < 4 && !video; tries += 1) {
            video = await fresh.evaluate(() => {
                const row = document.querySelector('#tube-smart .ust-row.ust-row-on');
                return !!row && !/CHANNEL|PLAYLIST/.test(row.innerText.slice(0, 400));
            });
            if (!video) { await fresh.keyboard.press('ArrowDown'); await sleep(500); }
        }
        await fresh.keyboard.press('Enter');
        const playing = await until(() => fresh.evaluate(() => {
            const root = document.getElementById('tube-smart');
            return /watch|browse\?c=UC/.test(window.location.hash) && (!root || root.style.display === 'none') ? window.location.hash.slice(0, 40) : false;
        }), 20000);
        check('OK on a card opens it with YouTube\u2019s own command, in YouTube\u2019s own player', !!playing, String(playing));

        await fresh.keyboard.press('Escape');
        await sleep(1500);
        await fresh.keyboard.press('Escape');
        const back = await until(() => fresh.evaluate(() => {
            const root = document.getElementById('tube-smart');
            return !!root && root.style.display !== 'none';
        }), 20000);
        check('Back from the player comes back to the UltimatiumTube home screen', !!back);

        // Search, the SmartTube UI's own: its keyboard, YouTube's suggestions as you type, results as rows.
        // Settled, and nothing asked: the exit question from a Back too many is answered Stay.
        await sleep(1500);
        if (await fresh.evaluate(() => !!document.getElementById('tube-glass'))) {
            await fresh.keyboard.press('Escape');
            await sleep(600);
        }
        // To the side menu: Back from the rows (Back on the menu itself asks whether to leave).
        if (await fresh.evaluate(() => document.getElementById('tube-smart').className !== 'ust-in-rail')) {
            await fresh.keyboard.press('Escape');
            await sleep(400);
        }
        const railAt = await fresh.evaluate(() => Array.prototype.findIndex.call(document.querySelectorAll('#tube-smart .ust-item'), (item) => /ust-focus/.test(item.className)));
        const searchAt = await fresh.evaluate(() => Array.prototype.findIndex.call(document.querySelectorAll('#tube-smart .ust-item'), (item) => /Search/.test(item.innerText)));
        for (let i = railAt; i < searchAt; i += 1) { await fresh.keyboard.press('ArrowDown'); await sleep(150); }
        await fresh.keyboard.press('Enter');
        const keysShown = await until(() => fresh.evaluate(() => getComputedStyle(document.querySelector('#tube-smart .ust-search')).display !== 'none'
            && document.querySelectorAll('#tube-smart .ust-key').length >= 40 && /ust-focus/.test(document.querySelector('#tube-smart .ust-key').className)), 4000);
        check('Search opens the UltimatiumTube keyboard', keysShown, await fresh.evaluate(() => JSON.stringify({
            title: document.querySelector('#tube-smart .ust-title').textContent, cls: document.getElementById('tube-smart').className,
            shown: document.getElementById('tube-smart').style.display, focus: (document.querySelector('#tube-smart .ust-item.ust-focus') || {}).textContent,
            hash: location.hash, glass: !!document.getElementById('tube-glass') })).catch((e) => e.message));

        // c (2), a (0), t (19): Right Right OK, Left Left OK, Down Down Right x5 OK.
        const typeKeys = ['ArrowRight', 'ArrowRight', 'Enter', 'ArrowLeft', 'ArrowLeft', 'Enter', 'ArrowDown', 'ArrowDown',
            'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter'];
        for (const key of typeKeys) { await fresh.keyboard.press(key); await sleep(200); }
        const typedAt = Date.now();
        const hints = await until(() => fresh.evaluate(() => {
            const query = document.querySelector('#tube-smart .ust-query').textContent;
            const shown = document.querySelectorAll('#tube-smart .ust-hint').length;
            return /^cat/.test(query) && shown >= 3 ? shown : false;
        }), 10000);
        check(`typing shows YouTube\u2019s suggestions at once (${Date.now() - typedAt} ms)`, !!hints && Date.now() - typedAt < 5000, String(hints));

        await fresh.keyboard.press('ArrowRight');
        await sleep(150);
        await fresh.keyboard.press('ArrowRight');
        await sleep(150);
        const chosen = await fresh.evaluate(() => (document.querySelector('#tube-smart .ust-hint.ust-focus') || {}).textContent || '');
        const askedAt = Date.now();
        await fresh.keyboard.press('Enter');
        const results = await until(() => fresh.evaluate(() => {
            const cards = document.querySelectorAll('#tube-smart .ust-card').length;
            const title = document.querySelector('#tube-smart .ust-row-title');
            return cards >= 5 && document.querySelector('#tube-smart .ust-title').textContent === 'Search'
                && !/Searching/.test(document.querySelector('#tube-smart .ust-message').textContent) ? `${cards} cards, first row \u201c${title && title.textContent}\u201d` : false;
        }), 15000);
        check(`a suggestion searches YouTube, and the results come as rows of cards (${Date.now() - askedAt} ms, \u201c${chosen}\u201d)`, !!results, String(results));
        await sleep(2000);
        await fresh.screenshot({ path: path.join(os.tmpdir(), 'smarttube-search.png') });

        // A Short from the results opens in YouTube's own Shorts player, as in YouTube's own TV app.
        const shortsRow = await fresh.evaluate(() => Array.prototype.findIndex.call(document.querySelectorAll('#tube-smart .ust-row'),
            (row) => /SHORT/.test(row.innerText)));
        if (shortsRow > 0) {
            for (let i = 0; i < shortsRow; i += 1) { await fresh.keyboard.press('ArrowDown'); await sleep(250); }
            const onShort = await fresh.evaluate(() => /SHORT/.test((document.querySelector('#tube-smart .ust-card.ust-focus') || {}).innerText || ''));
            await fresh.keyboard.press('Enter');
            const reel = await until(() => fresh.evaluate(() => !!document.querySelector('ytlr-shorts-page')
                && (!document.getElementById('tube-smart') || document.getElementById('tube-smart').style.display === 'none')), 20000);
            check('a Short opens in YouTube\u2019s own Shorts player, with nothing of ours over it', onShort && !!reel);
            await fresh.keyboard.press('Escape');
            await sleep(1500);
            await until(() => fresh.evaluate(() => document.getElementById('tube-smart').style.display !== 'none'), 15000);
        } else {
            check('a Short opens in YouTube\u2019s own Shorts player, with nothing of ours over it', false, 'no row of Shorts in the results');
        }

        // Back to Stock YouTube UI, from the welcome panel the next time; here from the settings it writes.
        await loaderPage.evaluate(() => {
            const kept = JSON.parse(localStorage.getItem('tube.settings') || '{}');
            kept.uiMode = 'stock';
            localStorage.setItem('tube.settings', JSON.stringify(kept));
            window.postMessage({ tube: 'reload', hash: '/' }, '*');
        });
        const stock = await until(async () => {
            const win = await youtubeWindow();
            return win && win !== fresh ? win : false;
        }, 60000);
        check('Stock YouTube UI loads YouTube afresh', !!stock);
        if (stock) {
            const plain = await until(() => stock.evaluate(() => {
                const root = document.getElementById('tube-smart');
                const focused = Array.from(document.querySelectorAll('.zylon-focus')).filter((e) => !e.querySelector('.zylon-focus'));
                const red = focused.some((e) => getComputedStyle(e).backgroundColor === 'rgb(229, 57, 53)');
                return (!root || root.style.display === 'none') && focused.length && !red ? 'YouTube\u2019s own' : false;
            }), 40000);
            check('with YouTube\u2019s own screens and look: no UltimatiumTube home or colours over them', !!plain, String(plain));
        }
    }

    await browser.close();
    const failed = results.filter((ok) => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})().catch((error) => { console.log(`FAIL  ${error.stack}`); process.exit(1); });
