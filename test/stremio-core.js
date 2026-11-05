// The protocol side of the Stremio page (stremio/core.js), which is plain browser script.
import assert from 'assert';
import { createRequire } from 'module';
import { check, finish } from './harness.js';

const SX = createRequire(import.meta.url)('../stremio/core.js');

const cinemeta = SX.cleanManifest({
    id: 'org.cinemeta', name: 'Cinemeta', version: '3', resources: ['catalog', 'meta'], types: ['movie', 'series'], idPrefixes: ['tt'],
    catalogs: [
        { type: 'movie', id: 'top', extra: [{ name: 'skip' }] },
        { type: 'movie', id: 'search', extra: [{ name: 'search', isRequired: true }] },
        { type: 'series', id: 'genre', extra: [{ name: 'genre', isRequired: true }, { name: 'search' }] }
    ]
});

const streams = SX.cleanManifest({
    id: 'org.s', name: 'S', resources: [{ name: 'stream', types: ['movie'], idPrefixes: ['tt', 'kitsu:'] }, 'meta'], types: ['movie', 'series'], catalogs: []
});

check('an address is read from stremio:// and from a bare one, and ends at its manifest', () => {
    assert.strictEqual(SX.manifestUrl('stremio://x.example/a/b/'), 'https://x.example/a/b/manifest.json');
    assert.strictEqual(SX.manifestUrl('https://x.example/manifest.json'), 'https://x.example/manifest.json');
    assert.strictEqual(SX.manifestUrl('  '), null);
    assert.strictEqual(SX.manifestUrl('javascript:alert(1)'), null);
    assert.strictEqual(SX.manifestUrl('not a url'), null);
});

check('a list is read one to a line, without repeats', () => {
    const list = SX.parseList('https://a.example/manifest.json\n\nstremio://b.example\nhttps://a.example/manifest.json, junk');
    assert.deepStrictEqual(list, ['https://a.example/manifest.json', 'https://b.example/manifest.json']);
});

check('requests are built the way addons expect, with the id and extras encoded', () => {
    const addon = { url: 'https://x.example/cfg/manifest.json' };
    assert.strictEqual(SX.url(addon, 'stream', 'series', 'tt1:1:2'), 'https://x.example/cfg/stream/series/tt1%3A1%3A2.json');
    assert.strictEqual(SX.url(addon, 'catalog', 'movie', 'top', { search: 'a b', skip: 20 }), 'https://x.example/cfg/catalog/movie/top/search=a%20b&skip=20.json');
});

check('a catalog shows on the home screen unless something must be asked of it first', () => {
    assert.deepStrictEqual(SX.homeCatalogs(cinemeta).map((c) => c.id), ['top']);
});

check('search finds the catalogs that take a search, and not ones that need a genre too', () => {
    assert.deepStrictEqual(SX.searchCatalogs(cinemeta).map((c) => c.id), ['search']);
});

check('paging is offered only by a catalog that takes skip', () => {
    assert.strictEqual(SX.pages(cinemeta.catalogs[0]), true);
    assert.strictEqual(SX.pages(cinemeta.catalogs[1]), false);
});

check('an addon is asked only for the types and ids it declared', () => {
    assert.strictEqual(SX.supports(streams, 'stream', 'movie', 'tt123'), true);
    assert.strictEqual(SX.supports(streams, 'stream', 'movie', 'kitsu:1'), true);
    assert.strictEqual(SX.supports(streams, 'stream', 'series', 'tt123'), false);
    assert.strictEqual(SX.supports(streams, 'stream', 'movie', 'yt:abc'), false);
    assert.strictEqual(SX.supports(cinemeta, 'stream', 'movie', 'tt1'), false);
    // A resource named as a plain string takes the addon's own types and prefixes.
    assert.strictEqual(SX.supports(cinemeta, 'meta', 'series', 'tt9'), true);
    assert.strictEqual(SX.supports(cinemeta, 'meta', 'series', 'xx9'), false);
});

check('streams are told apart by how a TV can play them, and the playable come first', () => {
    const list = [
        { infoHash: 'abc' }, { url: 'https://v.example/a.mp4', behaviorHints: { notWebReady: true } },
        { ytId: 'x' }, { url: 'https://v.example/b.mp4' }, { externalUrl: 'https://e.example' }
    ].map((s) => SX.stream(s, { url: 'u', manifest: { name: 'A' } }));

    assert.deepStrictEqual(list.map((s) => s.kind), ['torrent', 'direct', 'youtube', 'direct', 'external']);
    const sorted = SX.sortStreams(list);
    assert.deepStrictEqual(sorted.map((s) => s.kind), ['direct', 'direct', 'youtube', 'torrent', 'external']);
    assert.strictEqual(sorted[0].url, 'https://v.example/b.mp4', 'one built for a browser first');
});

check('the clock is written the way a player shows it', () => {
    assert.strictEqual(SX.format(65), '1:05');
    assert.strictEqual(SX.format(3725), '1:02:05');
    assert.strictEqual(SX.format(NaN), '0:00');
});

check('a manifest without an id or a name is not an addon', () => {
    assert.strictEqual(SX.cleanManifest({ name: 'x' }), null);
    assert.strictEqual(SX.cleanManifest(null), null);
});

finish();
