// The Grayjay plugin runtime of the Stremio page (stremio/grayjay.js): a plugin written for blocking
// requests, run in a page where they cannot block.
import assert from 'assert';
import { createRequire } from 'module';

const queue = [];
const check = (name, run) => queue.push({ name, run });

const require = createRequire(import.meta.url);
const SX = require('../stremio/core.js');
global.SX = SX;
const GJ = require('../stremio/grayjay.js');

const asked = [];
const site = {
    'https://api.example/token': { token: 'T1' },
    'https://api.example/home?t=T1': { list: [1, 2, 3] },
    'https://api.example/home?t=T1&page=2': { list: [4, 5] },
    'https://api.example/video/7': { title: 'Seven', src: 'https://cdn.example/7.mp4', hls: 'https://cdn.example/7.m3u8' },
    'https://api.example/a': { v: 'A' },
    'https://api.example/b': { v: 'B' }
};

SX.rawFetch = (req) => {
    asked.push(`${req.method} ${req.url}`);
    const found = site[req.url];
    return Promise.resolve(found
        ? { status: 200, url: req.url, headers: { 'Content-Type': 'application/json', 'Set-Cookie': ['a=1', 'b=2'] }, body: JSON.stringify(found) }
        : { status: 404, url: req.url, headers: {}, body: 'no' });
};

const config = { name: 'Test', id: 'x', scriptUrl: './s.js', allowUrls: ['api.example'], settings: [{ variable: 'quality', default: 'high' }] };

const script = `
var state = {};
source.enable = function (conf, settings) {
  state.settings = settings;
  state.token = JSON.parse(http.GET('https://api.example/token', {}).body).token;
};
class HomePager extends VideoPager {
  constructor(items, more, page) { super(items, more, { page: page }); }
  nextPage() {
    var r = JSON.parse(http.GET('https://api.example/home?t=' + state.token + '&page=2', {}).body);
    return new HomePager(r.list.map(make), false, 2);
  }
}
function make(n) {
  return new PlatformVideo({
    id: new PlatformID('Test', String(n), plugin.config.id), name: 'Video ' + n, url: 'https://t.example/v/' + n,
    thumbnails: new Thumbnails([new Thumbnail('https://img.example/s' + n + '.jpg', 1), new Thumbnail('https://img.example/b' + n + '.jpg', 9)]),
    author: new PlatformAuthorLink(new PlatformID('Test', 'a', plugin.config.id), 'Author', 'https://t.example/a'),
    uploadDate: 1700000000, duration: 125, viewCount: 1500000, isLive: false
  });
}
source.getHome = function () {
  var r = JSON.parse(http.GET('https://api.example/home?t=' + state.token, {}).body);
  return new HomePager(r.list.map(make), true, 1);
};
source.search = function (q) { return new VideoPager([make(9)], false, {}); };
source.getContentDetails = function (url) {
  var batch = http.batch().GET('https://api.example/a', {}).GET('https://api.example/b', {}).execute();
  var v = JSON.parse(http.GET('https://api.example/video/7', {}).body);
  return new PlatformVideoDetails({
    id: new PlatformID('Test', '7', plugin.config.id), name: v.title + batch[0].isOk, url: url, description: 'About',
    thumbnails: new Thumbnails([new Thumbnail('https://img.example/d.jpg', 5)]),
    author: new PlatformAuthorLink(new PlatformID('Test', 'a', plugin.config.id), 'Author', 'u'),
    uploadDate: 1700000000, duration: 3725, viewCount: 12, isLive: false,
    video: new VideoSourceDescriptor([
      new VideoUrlSource({ name: '720p', url: v.src, width: 1280, height: 720, container: 'video/mp4', codec: 'avc1', bitrate: 2000000 }),
      new VideoUrlSource({ name: '1080p', url: v.src + '?hd', width: 1920, height: 1080, container: 'video/mp4', codec: 'avc1', bitrate: 4000000 }),
      new HLSSource({ name: 'Auto', url: v.hls }),
      new DashSource({ name: 'DASH', url: 'https://cdn.example/7.mpd' })
    ])
  });
};
source.getCaught = function () {
  try { http.GET('https://api.example/a', {}); } catch (e) { return 'swallowed'; }
  return 'done';
};
source.getBlocked = function () { return http.GET('https://evil.example/steal', {}).isOk; };
source.getLeak = function () { return [typeof window, typeof document, typeof localStorage, typeof fetch, typeof XMLHttpRequest]; };
`;

const loaded = GJ.make(config, script, 'https://plugins.example/Test/TestConfig.json');

check('a plugin is loaded, and its enable (which asks for a token) has run', async () => {
    const plugin = await loaded;
    assert.ok(plugin.ready);
    assert.deepStrictEqual(asked, ['GET https://api.example/token']);
});

check('the home feed is read, as items of the page, after the plugin asked for what it needed', async () => {
    const plugin = await loaded;
    const page = await GJ.home(plugin);
    assert.strictEqual(page.items.length, 3);
    assert.strictEqual(page.items[0].name, 'Video 1');
    assert.strictEqual(page.items[0].type, 'gjvideo');
    assert.strictEqual(page.items[0].poster, 'https://img.example/b1.jpg', 'the biggest thumbnail');
    assert.strictEqual(page.items[0].runtime, '2:05');
    assert.strictEqual(page.items[0].views, '1.5M');
    assert.strictEqual(page.items[0].year, '2023-11-14');
    assert.strictEqual(page.items[0].genres[0], 'Author');
    assert.ok(page.more, 'there is a next page');
});

check('the next page is asked for when wanted, not before', async () => {
    const plugin = await loaded;
    const before = asked.length;
    const page = await GJ.home(plugin);
    const homeAsks = asked.length - before;
    assert.strictEqual(homeAsks, 1, `home asked ${homeAsks} times`);
    const more = await page.more();
    assert.deepStrictEqual(more.items.map((i) => i.name), ['Video 4', 'Video 5']);
    assert.strictEqual(more.more, null);
});

check('search returns videos too', async () => {
    const plugin = await loaded;
    const page = await GJ.search(plugin, 'x');
    assert.strictEqual(page.items[0].name, 'Video 9');
});

check('details come with sources: the sharpest file first, then the playlist, and DASH marked as unplayable', async () => {
    const plugin = await loaded;
    const page = await GJ.home(plugin);
    asked.length = 0;
    const full = await GJ.details(plugin, page.items[0]);

    assert.deepStrictEqual(asked.sort(), ['GET https://api.example/a', 'GET https://api.example/b', 'GET https://api.example/video/7'].sort(),
        'a batch is asked for at once and nothing is asked twice');
    assert.strictEqual(full.name, 'Seventrue');
    assert.strictEqual(full.description, 'About');
    assert.deepStrictEqual(full.sources.map((s) => [s.kind, s.name]), [['direct', '1080p'], ['direct', '720p'], ['direct', 'Auto'], ['unknown', 'DASH']]);
});

check('a plugin that catches the pause and goes on still gets the real answer', async () => {
    const plugin = await loaded;
    const out = await GJ.run(plugin, () => plugin.source.getCaught());
    // The first run caught the stop; its result was thrown away and the run was repeated with the answer.
    assert.strictEqual(out, 'done');
});

check('a site the plugin did not list is not asked, and the plugin is told it failed', async () => {
    const plugin = await loaded;
    asked.length = 0;
    const ok = await GJ.run(plugin, () => plugin.source.getBlocked());
    assert.strictEqual(ok, false);
    assert.deepStrictEqual(asked, []);
});

check('the page\'s own objects are hidden from the plugin', async () => {
    global.window = { x: 1 };
    const plugin = await GJ.make(config, script, 'https://plugins.example/Test/TestConfig.json');
    const out = await GJ.run(plugin, () => plugin.source.getLeak());
    delete global.window;
    assert.deepStrictEqual(out, ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
});

check('a relative script address is read against the configuration\'s', () => {
    assert.strictEqual(GJ.resolve('./S.js', 'https://p.example/A/AConfig.json'), 'https://p.example/A/S.js');
    assert.strictEqual(GJ.resolve('../S.js', 'https://p.example/A/AConfig.json'), 'https://p.example/S.js');
    assert.strictEqual(GJ.resolve('/S.js', 'https://p.example/A/AConfig.json'), 'https://p.example/S.js');
    assert.strictEqual(GJ.resolve('https://o.example/S.js', 'https://p.example/A/AConfig.json'), 'https://o.example/S.js');
});

check('a plugin that never stops asking is stopped', async () => {
    const forever = GJ.make(config, 'source.enable = function(){}; source.getHome = function(){ var i = 0; while (true) { i += 1; http.GET("https://api.example/a?i=" + i, {}); } };', 'https://plugins.example/F.json');
    const plugin = await forever;
    await assert.rejects(GJ.run(plugin, () => plugin.source.getHome()), /too many/);
});

check('an install link and a plain address are both accepted for a plugin', () => {
    assert.strictEqual(SX.pluginUrl('grayjay://plugin/https://plugins.grayjay.app/Odysee/OdyseeConfig.json'), 'https://plugins.grayjay.app/Odysee/OdyseeConfig.json');
    assert.strictEqual(SX.pluginUrl('javascript:1'), null);
    assert.deepStrictEqual(SX.parsePlugins('https://a.example/c.json\nhttps://a.example/c.json;junk'), ['https://a.example/c.json']);
});

const tally = { ok: 0, bad: 0 };

for (const one of queue) {
    try {
        await one.run();
        tally.ok += 1;
        console.log(`PASS  ${one.name}`);
    } catch (failure) {
        tally.bad += 1;
        console.log(`FAIL  ${one.name}\n      ${String(failure.message).split('\n').slice(0, 5).join('\n      ')}`);
    }
}

console.log(`\n${tally.ok}/${tally.ok + tally.bad} checks passed.`);
process.exit(tally.bad ? 1 : 0);
