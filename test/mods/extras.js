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
    location: { hash: '#/', reload: () => undefined }, addEventListener: () => undefined,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
};

const configModule = await import('../../framework/runtime/config.js');
const { configRead } = configModule;
const { noteVideo } = await import('../../mods/channels/index.js');
const { remember, positionFor } = await import('../../mods/resume/index.js');
const { ACTIONS, ACTION_NAMES, start: startKeys } = await import('../../mods/remoteKeys/index.js');
const { bookmarks, clock } = await import('../../mods/bookmarks/index.js');
const { channelQuality } = await import('../../mods/quality/index.js');
const { chaptersOf } = await import('../../mods/sponsorblock/chapters.js');
const { smarten } = await import('../../mods/smartSearch/index.js');
const { reasonToPass } = await import('../../mods/shorts/index.js');
const { SUGGESTED } = await import('../../mods/collections/index.js');
const { isClickbait, plainTitle, rulesOf, verdict } = await import('../../mods/contentIntel/index.js');
const { switchProfile, currentProfile, playbackChoices, PLAYBACK_PROFILES } = await import('../../mods/profiles/index.js');

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

check('a video\'s chapters named Intro, Recap and Credits become segments to skip, up to the next chapter', () => {
    const description = 'Great video!\n0:00 Intro\n0:45 The story\n1:30 Recap of part 1\n2:10 Main part\n9:50 End credits\nThanks';
    const found = chaptersOf(description, 620).map((s) => [s.category, s.segment[0], s.segment[1]]);
    assert.deepStrictEqual(found, [['intro', 0, 45], ['preview', 90, 130], ['outro', 590, 620]]);
});

check('a description that is not a chapter list gives nothing', () => {
    assert.deepStrictEqual(chaptersOf('Intro at 0:30 and more at 1:00', 300), []);
    assert.deepStrictEqual(chaptersOf('0:10 Intro\n1:00 B\n2:00 C', 300), [], 'chapters start at 0:00');
    assert.deepStrictEqual(chaptersOf('0:00 Introduction\n1:00 Opening thoughts? no\n0:30 C', 300), [], 'out of order');
});

check('smart search turns a sentence into the words that find it, and leaves a plain search alone', () => {
    assert.strictEqual(smarten('Find videos explaining how OLED TVs work in simple terms.'), 'how OLED TVs work explained simply');
    assert.strictEqual(smarten('show me some videos about cooking pasta'), 'cooking pasta');
    assert.strictEqual(smarten('can you find tutorials on python for beginners?'), 'python for beginners');
    assert.strictEqual(smarten('minecraft'), 'minecraft');
    assert.strictEqual(smarten('lofi hip hop radio'), 'lofi hip hop radio');
});

check('the Shorts filter passes over by length, and by the hidden channels and words', () => {
    const read = (settings) => (key) => settings[key];
    assert.strictEqual(reasonToPass(58, 'A', 'x', read({ shortsMaxSeconds: 30 })), 'longer than 30 s');
    assert.strictEqual(reasonToPass(20, 'A', 'x', read({ shortsMaxSeconds: 30 })), null);
    assert.strictEqual(reasonToPass(3, 'A', 'x', read({ shortsMinSeconds: 5 })), 'shorter than 5 s');
    assert.strictEqual(reasonToPass(20, 'Loud Channel', 'x', read({ shortsUseHiddenLists: true, blockedChannels: ['loud channel'] })), 'a hidden channel');
    assert.strictEqual(reasonToPass(20, 'A', 'A PRANK gone wrong', read({ shortsUseHiddenLists: true, blockedKeywords: ['prank'] })), 'a hidden word');
    assert.strictEqual(reasonToPass(20, 'A', 'A PRANK', read({ shortsUseHiddenLists: false, blockedKeywords: ['prank'] })), null);
});

check('collections come with Favourites, and offer names that need no typing', () => {
    assert.deepStrictEqual(Object.keys(configRead('channelCollections')), ['Favourites']);
    assert.ok(SUGGESTED.indexOf('Music') !== -1 && SUGGESTED.indexOf('Learning') !== -1);
});

check('clickbait is told from an ordinary title', () => {
    ['YOU WON\'T BELIEVE WHAT HAPPENED NEXT', 'This is insane!!!', 'Wait for it \ud83d\ude31\ud83d\ude31\ud83d\ude31', 'Prank gone wrong']
        .forEach((t) => assert.ok(isClickbait(t), t));
    ['How OLED TVs work', 'Lofi hip hop radio - beats to relax', 'NASA live: Artemis launch'].forEach((t) => assert.ok(!isClickbait(t), t));
});

check('a repost is the same title once the tags are taken off', () => {
    assert.strictEqual(plainTitle('Song Name (Official Video) [4K]'), plainTitle('song name - reupload'));
});

check('your own rules hide by word, by channel and by pattern', () => {
    const read = (settings) => (key) => settings[key];
    const rules = 'spoiler\nchannel: Loud Channel\nregex: ^\\[live\\]';
    assert.strictEqual(rulesOf(rules).length, 3);
    assert.strictEqual(verdict('a', 'Big spoiler inside', 'X', read({ contentRules: rules })), false);
    assert.strictEqual(verdict('b', 'Calm video', 'Loud Channel', read({ contentRules: rules })), false);
    assert.strictEqual(verdict('c', '[LIVE] match', 'X', read({ contentRules: rules })), false);
    assert.strictEqual(verdict('d', 'Calm video', 'Quiet', read({ contentRules: rules })), true);
});

check('with duplicates on, a video shown twice, or reposted by another channel, is kept once', () => {
    const read = (settings) => (key) => settings[key];
    const on = read({ hideDuplicates: true });
    assert.strictEqual(verdict('dup1', 'A long enough title', 'Ch', on), true);
    assert.strictEqual(verdict('dup1', 'A long enough title', 'Ch', on), false);
    assert.strictEqual(verdict('dup2', 'Another song name (Official Video)', 'Owner', on), true);
    assert.strictEqual(verdict('dup3', 'Another song name [HD]', 'Reposter', on), false);
});

check('playback profiles set speed, quality and fit together', () => {
    const learning = playbackChoices().find((c) => c.label === 'Learning').writes
        .reduce((all, w) => Object.assign(all, { [w.key]: w.value }), {});
    assert.deepStrictEqual([learning.defaultPlaybackSpeed, learning.preferredVideoQuality, learning.playbackProfile], [1.5, '1080', 'Learning']);
    assert.deepStrictEqual(PLAYBACK_PROFILES.map((p) => p[0]), ['Cinema', 'Learning', 'Music', 'Sports', 'Standard']);
});

check('a user profile keeps its own settings, and Guest keeps nothing', () => {
    const { configWrite } = configModule;
    configWrite('themeAccent', 'pink');
    assert.strictEqual(currentProfile(), 'Main');
    switchProfile('Person 2', false);
    assert.strictEqual(currentProfile(), 'Person 2');
    assert.strictEqual(configRead('themeAccent'), 'blue', 'a new person starts as the app came');
    configWrite('themeAccent', 'green');
    switchProfile('Main', false);
    assert.strictEqual(configRead('themeAccent'), 'pink', 'Main is back as it was');
    switchProfile('Guest', false);
    assert.strictEqual(configRead('enableSmartResume'), false);
    switchProfile('Person 2', false);
    assert.strictEqual(configRead('themeAccent'), 'green');
    switchProfile('Main', false);
});

check('Shorts: words of your own, and only from your collections', () => {
    const read = (settings) => (key) => settings[key];
    assert.strictEqual(reasonToPass(20, 'A', 'Fortnite clip', read({ shortsBlockedWords: 'fortnite' })), 'a word you hid for Shorts');
    assert.strictEqual(reasonToPass(20, 'Stranger', 'x', read({ shortsOnlyCollections: true, channelCollections: { Fav: ['Friend'] } })), 'not in your collections');
    assert.strictEqual(reasonToPass(20, 'Friend', 'x', read({ shortsOnlyCollections: true, channelCollections: { Fav: ['Friend'] } })), null);
});

finish();
