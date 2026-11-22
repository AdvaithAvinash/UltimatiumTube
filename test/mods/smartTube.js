// The SmartTube UI reads YouTube's TV answers (here a real one, cut short) into rows of cards.

import assert from 'assert';
import { readFileSync } from 'fs';
import { check, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined, getElementById: () => null };

const { pageOf } = await import('../../mods/smartTube/data.js');
const answer = JSON.parse(readFileSync(new URL('../fixtures/smarttube-gaming.json', import.meta.url), 'utf8'));

check('each shelf of the answer is a row, with its title', () => {
    const page = pageOf(answer);
    assert.strictEqual(page.rows.length, 2);
    assert.ok(page.rows.every((row) => row.title.length > 2), JSON.stringify(page.rows.map((row) => row.title)));
    assert.ok(page.rows.every((row) => row.cards.length === 3));
});

const allCards = () => pageOf(answer).rows.reduce((all, row) => all.concat(row.cards), []);

check('a card has its title, picture and the lines under it', () => {
    const card = allCards().filter((one) => one.kind === 'video')[0];
    assert.ok(card.title.length > 3, card.title);
    assert.ok(/^https:\/\/i\.ytimg\.com\//.test(card.picture), card.picture);
    assert.ok(card.lines.length >= 1, JSON.stringify(card.lines));
    assert.strictEqual(card.kind, 'video');
});

check('and keeps YouTube’s own command to open it: a video plays, anything else is browsed to', () => {
    allCards().forEach((card) => assert.ok(card.kind === 'video'
        ? card.command.watchEndpoint && card.command.watchEndpoint.videoId === card.id
        : !!(card.command.browseEndpoint || card.command.watchEndpoint), card.title));
});

check('the parts of a line (views, age) have a dot between them, and YouTube\u2019s own dots are not doubled', () => {
    const line = (parts) => ({ lineRenderer: { items: parts.map((part) => ({ lineItemRenderer: { text: { simpleText: part } } })) } });
    const card = pageOf({ contents: { tileRenderer: { contentId: 'x', onSelectCommand: { watchEndpoint: { videoId: 'x' } },
        metadata: { tileMetadataRenderer: { title: { simpleText: 'A video' }, lines: [line(['Channel']), line(['15M', '18h ago']), line(['1K views', '\u2022', '2 days ago'])] } } } } });
    assert.ok(card.rows.length === 0);
    const tile = { tileRenderer: { contentId: 'x', onSelectCommand: { watchEndpoint: { videoId: 'x' } },
        metadata: { tileMetadataRenderer: { title: { simpleText: 'A video' }, lines: [line(['Channel']), line(['15M', '18h ago']), line(['1K views', '\u2022', '2 days ago'])] } } } };
    const rows = pageOf({ shelfRenderer: { title: { simpleText: 'Row' }, content: { horizontalListRenderer: { items: [tile] } } } }).rows;
    assert.deepStrictEqual(rows[0].cards[0].lines, ['Channel', '15M \u2022 18h ago', '1K views \u2022 2 days ago']);
});

check('where YouTube offers more rows, the way to ask for them is kept', () => {
    assert.strictEqual(pageOf(answer).more, 'NEXT-PAGE-TOKEN');
});

check('a grid (subscriptions, history) is cut into rows of five', () => {
    const tile = answer.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents[0]
        .shelfRenderer.content.horizontalListRenderer.items[0];
    const grid = { gridRenderer: { items: Array.from({ length: 12 }, () => tile) } };
    const rows = pageOf({ contents: grid }).rows;
    assert.deepStrictEqual(rows.map((row) => row.cards.length), [5, 5, 2]);
});

check('an answer with nothing in it is no rows, not a failure', () => {
    assert.deepStrictEqual(pageOf({ contents: {} }), { rows: [], more: null });
});

finish();
