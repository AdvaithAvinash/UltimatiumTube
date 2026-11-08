// In its own file because it takes over the process's JSON.

import assert from 'assert';

global.window = { localStorage: { 'tube.settings': '{}' }, addEventListener: () => undefined };
global.window.JSON = JSON;
global.location = { hash: '#/' };
global.fetch = () => new Promise(() => { });

const { configRead, configWrite } = await import('../../framework/runtime/config.js');
const { interceptJson } = await import('../../framework/registries/json.js');
const { flushAdStats, adSummary } = await import('../../mods/adblock/index.js');

interceptJson();

const results = [];

const check = (name, run) => {
    try {
        run();
        results.push(true);
        console.log(`PASS  ${name}`);
    } catch (failure) {
        results.push(false);
        console.log(`FAIL  ${name}\n      ${String(failure.message).split('\n').slice(0, 5).join('\n      ')}`);
    }
};

const withConfig = (settings, run) => {
    const before = Object.keys(settings).map((key) => [key, configRead(key)]);
    Object.keys(settings).forEach((key) => configWrite(key, settings[key]));
    try {
        run();
    } finally {
        before.forEach((entry) => configWrite(entry[0], entry[1]));
    }
};

const sent = () => JSON.parse(JSON.stringify({
    playbackContext: { contentPlaybackContext: { referer: 'x' } }
}));

check('with adverts blocked, the request claims an advert-free playback', () => {
    withConfig({ enableAdBlock: true }, () => {
        assert.strictEqual(sent().playbackContext.contentPlaybackContext.isInlinePlaybackNoAd, true);
    });
});

check('with adverts allowed, the request is left alone', () => {
    withConfig({ enableAdBlock: false }, () => {
        const body = sent().playbackContext.contentPlaybackContext;
        assert.strictEqual(body.isInlinePlaybackNoAd, undefined,
            'the suppression still went out, so the setting does nothing');
        assert.strictEqual(body.referer, 'x', 'the rest of the context was disturbed');
    });
});

check('a body carrying no playback context is untouched either way', () => {
    withConfig({ enableAdBlock: true }, () => {
        const out = JSON.parse(JSON.stringify({ somethingElse: 1 }));
        assert.deepStrictEqual(out, { somethingElse: 1 });
    });
});

// --- the sweep, through the same JSON.parse the app uses

const through = (value) => JSON.parse(JSON.stringify(value));

const ad = () => ({ adSlotRenderer: { enablePacfLoggingWeb: true } });
const video = (id) => ({ tileRenderer: { contentId: id } });

check('an advert slot in a surface nothing walks is removed, wherever it is', () => {
    withConfig({ enableAdBlock: true }, () => {
        const out = through({ contents: { someNewSurface: { rows: [{ items: [video('a'), ad(), video('b')] }] } } });
        assert.deepStrictEqual(out.contents.someNewSurface.rows[0].items.map((item) => item.tileRenderer.contentId), ['a', 'b']);
    });
});

check('so is a placement, and several of them, at several depths', () => {
    withConfig({ enableAdBlock: true }, () => {
        const out = through({ continuationContents: { a: [ad(), { adPlacementRenderer: {} }, { b: { c: [ad(), video('x')] } }] } });
        assert.deepStrictEqual(out, { continuationContents: { a: [{ b: { c: [video('x')] } }] } });
    });
});

check('with adverts allowed, they are left in', () => {
    withConfig({ enableAdBlock: false }, () => {
        const out = through({ contents: { rows: [video('a'), ad()] } });
        assert.strictEqual(out.contents.rows.length, 2);
    });
});

check('a response with nothing to remove comes out as it went in', () => {
    withConfig({ enableAdBlock: true }, () => {
        const body = { contents: { rows: [video('a'), { shelfRenderer: { title: 'x' } }], n: 3, s: 'text', z: null } };
        assert.deepStrictEqual(through(body), body);
    });
});

check('a very deep response is not walked past a limit', () => {
    withConfig({ enableAdBlock: true }, () => {
        const deep = Array.from({ length: 40 }).reduce((inner) => ({ inner }), { rows: [ad()] });
        assert.doesNotThrow(() => through({ contents: deep }));
    });
});

check('removed adverts and ad-free playback requests are counted for the statistics', () => {
    flushAdStats();
    const before = configRead('adsBlockedCount') || 0;
    const requests = configRead('adRequestsBlocked') || 0;
    JSON.parse(JSON.stringify({ adPlacements: [{}, {}, {}], playerAds: [{}], adSlots: [{}] }));
    JSON.stringify({ playbackContext: { contentPlaybackContext: {} } });
    flushAdStats();
    assert.strictEqual(configRead('adsBlockedCount') - before, 5);
    assert.strictEqual(configRead('adRequestsBlocked') - requests, 1);
    assert.ok(/adverts removed/.test(adSummary()));
});

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
