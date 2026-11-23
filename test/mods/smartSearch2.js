// The SmartTube UI's own search: typing on its keyboard, moving about it, YouTube's suggestions.

import assert from 'assert';
import { check, finish } from '../harness.js';

const { KEYBOARD, COLUMNS, typed, step, suggestionsOf, suggestUrl } = await import('../../mods/smartTube/search.js');

check('the keyboard has every letter and digit, space, delete, clear and Search', () => {
    'abcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach((letter) => assert.ok(KEYBOARD.indexOf(letter) !== -1, letter));
    ['delete', 'clear', 'search', ' '].forEach((key) => assert.ok(KEYBOARD.indexOf(key) !== -1, key));
});

check('typing: letters add, space once, delete takes one back, clear empties', () => {
    assert.strictEqual(typed('mine', 'c'), 'minec');
    assert.strictEqual(typed('mine', ' '), 'mine ');
    assert.strictEqual(typed('mine ', ' '), 'mine ');
    assert.strictEqual(typed('', ' '), '');
    assert.strictEqual(typed('mine', 'delete'), 'min');
    assert.strictEqual(typed('mine', 'clear'), '');
    assert.strictEqual(typed('mine', 'search'), 'mine');
});

check('moving about the keyboard stays on it, and says when an edge is left', () => {
    assert.strictEqual(step(0, 39), 1);
    assert.strictEqual(step(0, 40), COLUMNS);
    assert.strictEqual(step(0, 37), -1);
    assert.strictEqual(step(0, 38), -1);
    assert.strictEqual(step(COLUMNS - 1, 39), -1);
    assert.strictEqual(step(KEYBOARD.length - 1, 39), -1);
    // From a row above the last that the last does not reach, Down lands on the last key.
    const lastRow = Math.floor((KEYBOARD.length - 1) / COLUMNS);
    const above = (lastRow - 1) * COLUMNS + (COLUMNS - 1);
    assert.strictEqual(step(above, 40), KEYBOARD.length - 1);
    assert.strictEqual(step(KEYBOARD.length - 1, 40), -1);
});

check('YouTube’s suggestion answer (a real one) is read into the suggestions', () => {
    const answer = ')]}\'\n["minecr",[["minecraft",0,[512]],["minecraft 100 days",0,[512,433,131]],["minecraft horror",0,[512,433,131]]],{"k":1}]';
    assert.deepStrictEqual(suggestionsOf(answer), ['minecraft', 'minecraft 100 days', 'minecraft horror']);
    assert.deepStrictEqual(suggestionsOf('not an answer'), []);
});

check('suggestions are asked where YouTube’s own TV app asks, on YouTube’s own address', () => {
    const url = suggestUrl('cat videos', 'en');
    assert.ok(/^\/complete\/search\?client=youtube-lr&ds=yt/.test(url) && /q=cat%20videos/.test(url), url);
});

finish();
