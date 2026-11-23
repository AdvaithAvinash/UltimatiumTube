// Shorts in the Shorts player: YouTube gives a TV browser each Short as a plain video (watchEndpoint);
// they are given the Shorts player's command (reelWatchEndpoint), as Samsung's YouTube engine gets.
// The fixture is a real search answer for a TV browser, cut short.

import assert from 'assert';
import { readFileSync } from 'fs';
import { check, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined, getElementById: () => null };
global.btoa = global.btoa || ((text) => Buffer.from(text, 'binary').toString('base64'));

const { toShortsPlayer, sequenceFor } = await import('../../mods/shorts/reel.js');
const { pageOf } = await import('../../mods/smartTube/data.js');

const fresh = () => JSON.parse(readFileSync(new URL('../fixtures/search-lockups.json', import.meta.url), 'utf8'));
const itemsOf = (answer) => answer.contents.sectionListRenderer.contents[0].shelfRenderer.content.horizontalListRenderer.items;
const commandOf = (item) => item.lockupViewModel.rendererContext.commandContext.onTap.innertubeCommand;

check('the browser’s answer carries Shorts as plain videos (the fault this fixes)', () => {
    const shorts = itemsOf(fresh()).filter((item) => item.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_SHORT');
    assert.ok(shorts.length >= 1);
    assert.ok(shorts.every((item) => commandOf(item).watchEndpoint && !commandOf(item).reelWatchEndpoint));
});

check('each Short is given the Shorts player’s command, with a sequence starting at it', () => {
    const items = itemsOf(fresh());
    items.forEach(toShortsPlayer);
    items.filter((item) => item.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_SHORT').forEach((item) => {
        const command = commandOf(item);
        assert.ok(!command.watchEndpoint, 'the plain video command is gone');
        const reel = command.reelWatchEndpoint;
        assert.ok(reel && reel.videoId === item.lockupViewModel.contentId);
        assert.strictEqual(reel.sequenceProvider, 'REEL_WATCH_SEQUENCE_PROVIDER_RPC');
        assert.strictEqual(reel.overlay.reelPlayerOverlayRenderer.style, 'REEL_PLAYER_OVERLAY_STYLE_SHORTS');
        const decoded = Buffer.from(decodeURIComponent(reel.sequenceParams), 'base64').toString('binary');
        assert.strictEqual(decoded.charCodeAt(0), 0x0a);
        assert.strictEqual(decoded.slice(2), reel.videoId);
    });
});

check('an ordinary video keeps its own command', () => {
    const items = itemsOf(fresh());
    items.forEach(toShortsPlayer);
    items.filter((item) => item.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO').forEach((item) => {
        assert.ok(commandOf(item).watchEndpoint && !commandOf(item).reelWatchEndpoint);
    });
});

check('a Short already in the Shorts player’s command is left as it is', () => {
    const item = { lockupViewModel: { contentType: 'LOCKUP_CONTENT_TYPE_SHORT', rendererContext: { commandContext: { onTap: {
        innertubeCommand: { reelWatchEndpoint: { videoId: 'abcdefghijk', sequenceParams: 'kept' } } } } } } };
    toShortsPlayer(item);
    assert.strictEqual(commandOf(item).reelWatchEndpoint.sequenceParams, 'kept');
});

check('the sequence for a Short is its id as YouTube’s own links carry it', () => {
    assert.strictEqual(sequenceFor('KId3r5dVwGk'), encodeURIComponent(Buffer.from([0x0a, 11].concat(Array.from(Buffer.from('KId3r5dVwGk')))).toString('base64')));
});

check('the SmartTube UI reads YouTube’s newer cards too: title, picture, length, lines', () => {
    const cards = pageOf(fresh()).rows[0].cards;
    assert.strictEqual(cards.length, itemsOf(fresh()).length);
    const video = cards.filter((card) => card.kind === 'video')[0];
    assert.ok(video.title.length > 3 && /^https:\/\/i\.ytimg\.com\//.test(video.picture) && /\d/.test(video.badge) && video.lines.length >= 1,
        JSON.stringify(video).slice(0, 300));
    assert.ok(cards.some((card) => card.kind === 'short'));
});

finish();
