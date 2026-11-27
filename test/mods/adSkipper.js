// Adverts YouTube stitches into the video itself, with nothing in its answers to take out: while the
// player says one is showing, it is muted and run at the fastest speed, Skip is pressed when offered,
// and the sound and speed come back as they were. And answers read with Response.json() reach the
// readers, which take out every advert YouTube does list.

import assert from 'assert';
import { check, finish } from '../harness.js';

const page = { skip: null, labels: [] };
const video = { muted: false, _rate: 1.5 };
Object.defineProperty(video, 'playbackRate', { get() { return this._rate; }, set(v) { this._rate = v; } });

global.window = global.window || {};
window.getComputedStyle = () => ({ visibility: 'visible' });
window.addEventListener = () => undefined;
global.document = {
    querySelector: (selector) => (selector === 'video' ? video : null),
    querySelectorAll: (selector) => (/skip/i.test(selector) && page.skip ? [page.skip] : (/ad-attribution/.test(selector) ? page.labels : [])),
    addEventListener: () => undefined,
    getElementById: () => null
};

const { advertShowing, look, held } = await import('../../mods/adblock/skipper.js');
const player = { classList: { contains: (name) => page.classes.indexOf(name) !== -1 } };
page.classes = [];
held.player = player;

check('no advert: nothing is touched', () => {
    look();
    assert.strictEqual(video.muted, false);
    assert.strictEqual(video.playbackRate, 1.5);
});

check('the player says an advert is showing (ad-showing): muted, at the fastest speed', () => {
    page.classes = ['ad-showing'];
    assert.ok(advertShowing(player));
    look();
    assert.strictEqual(video.muted, true);
    assert.strictEqual(video.playbackRate, 16);
});

check('Skip offered: it is pressed', () => {
    const pressed = { n: 0 };
    page.skip = { getBoundingClientRect: () => ({ width: 100, height: 40 }), click: () => { pressed.n += 1; } };
    look();
    assert.strictEqual(pressed.n, 1);
    page.skip = null;
});

check('the advert over: the sound and speed are as they were', () => {
    page.classes = [];
    look();
    assert.strictEqual(video.muted, false);
    assert.strictEqual(video.playbackRate, 1.5);
});

check('an advert’s own label on the screen counts too, a hidden or empty one does not', () => {
    page.labels = [{ textContent: 'Ad · 0:12', getBoundingClientRect: () => ({ width: 80, height: 20 }) }];
    assert.ok(advertShowing(player));
    page.labels = [{ textContent: '', getBoundingClientRect: () => ({ width: 80, height: 20 }) }];
    assert.ok(!advertShowing(player));
    page.labels = [{ textContent: 'Ad', getBoundingClientRect: () => ({ width: 0, height: 0 }) }];
    assert.ok(!advertShowing(player));
    page.labels = [];
});

finish();
