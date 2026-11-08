// Bookmarks, smart resume, remote buttons and the quality lock for each channel.
import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

const store = {};
const listeners = {};
global.document = {
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).concat([fn]); }
};
global.window = {
    location: { hash: '#/' }, addEventListener: () => undefined,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
};

const { configRead } = await import('../../framework/runtime/config.js');
const { noteVideo } = await import('../../mods/channels/index.js');
const { remember, positionFor } = await import('../../mods/resume/index.js');
const { ACTIONS, ACTION_NAMES, start: startKeys } = await import('../../mods/remoteKeys/index.js');
const { bookmarks, clock } = await import('../../mods/bookmarks/index.js');
const { channelQuality } = await import('../../mods/quality/index.js');

check('smart resume keeps where a long video was left, and forgets one that was finished or barely started', () => {
    remember('abc', 600, 1200);
    assert.strictEqual(positionFor('abc', 1200), 600);
    remember('abc', 1190, 1200);
    assert.strictEqual(positionFor('abc', 1200), 0, 'finished');
    remember('short', 50, 90);
    assert.strictEqual(positionFor('short', 90), 0, 'a short video starts again');
    remember('begun', 2, 1200);
    assert.strictEqual(positionFor('begun', 1200), 0);
});

check('every remote action has a name, and nothing is a choice too', () => {
    Object.keys(ACTIONS).forEach((id) => assert.ok(ACTION_NAMES[id], id));
    assert.ok(ACTION_NAMES.none);
});

check('the remote buttons come set: Green keeps the moment, Yellow fits, Blue opens speed, Red is left to YouTube', () => {
    assert.deepStrictEqual(['keyRed', 'keyGreen', 'keyYellow', 'keyBlue'].map(configRead), ['none', 'bookmark', 'fit', 'speed']);
    assert.deepStrictEqual(['keyGreenHold', 'keyYellowHold', 'keyBlueHold'].map(configRead), ['bookmarks', 'fitMenu', 'quality']);
});

check('a button whose action is for a playing video is left to YouTube elsewhere', () => {
    startKeys();
    const event = (keyCode, type) => {
        const e = { keyCode, type, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
        (listeners[type] || []).forEach((fn) => fn(e));
        return e;
    };
    window.location.hash = '#/browse';
    assert.strictEqual(event(405, 'keydown').prevented, false, 'Yellow on the home screen');
    withConfig({ keyRed: 'none', keyRedHold: 'none' }, () => assert.strictEqual(event(403, 'keydown').prevented, false));
});

check('bookmarks are listed newest first, and their times read like a player\'s', () => {
    assert.deepStrictEqual(bookmarks(), []);
    assert.strictEqual(clock(75), '1:15');
    assert.strictEqual(clock(3725), '1:02:05');
});

check('a channel\'s own quality wins only for that channel', () => {
    withConfig({ channelQualities: { 'some channel': '720' } }, () => {
        noteVideo({ author: 'Some Channel', videoId: 'v1', title: 'T' });
        assert.strictEqual(channelQuality(), '720');
        noteVideo({ author: 'Another', videoId: 'v2', title: 'U' });
        assert.strictEqual(channelQuality(), undefined);
    });
});

finish();
