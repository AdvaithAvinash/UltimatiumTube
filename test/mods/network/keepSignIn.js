// The page's storage carried over when the TV's network address changes, so the TV stays signed in.

const memory = (seed) => {
    const data = Object.assign({}, seed);
    return {
        data,
        get length() { return Object.keys(data).length; },
        key: (i) => Object.keys(data)[i],
        getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; }
    };
};

const page = { reloads: 0, posts: [], copy: {}, origin: 'http://192.168.1.51:8189' };

global.window = {
    location: { get origin() { return page.origin; }, protocol: 'http:', reload: () => { page.reloads += 1; } },
    localStorage: memory({}),
    sessionStorage: memory({})
};
global.document = { addEventListener: () => undefined };
global.fetch = (route, options) => {
    if (options.method === 'POST') page.posts.push(JSON.parse(options.body));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(options.method === 'POST' ? { ok: true } : page.copy) });
};
window.fetch = global.fetch;

const { snapshot, putBack, restore, MOVED } = await import('../../../mods/network/keepSignIn.js');

const results = [];
const check = (name, ok, detail) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  <- ${detail}`}`);
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const big = 'x'.repeat(600 * 1024);
const taken = snapshot(memory({ 'yt.leanback.default::auth': 'token', cache: big }));
check('a snapshot holds the sign-in', taken['yt.leanback.default::auth'] === 'token', JSON.stringify(Object.keys(taken)));
check('and leaves out a value too big to be anything but a cache', !('cache' in taken), Object.keys(taken).join());

const store = memory({ 'yt.leanback.default::signed-out': '1', huge: big });
putBack(store, { 'yt.leanback.default::auth': 'token', 'tube.settings': '{"a":1}' });
check('putting back writes what the copy holds', store.data['yt.leanback.default::auth'] === 'token'
    && store.data['tube.settings'] === '{"a":1}', JSON.stringify(Object.keys(store.data)));
check('and takes out what the page wrote while signed out', !('yt.leanback.default::signed-out' in store.data));
check('but never a value too big to have been copied', store.data.huge === big);

const OLD = 'http://192.168.1.50:8189';
const copy = { origin: OLD, items: { 'yt.leanback.default::auth': 'token' } };

check('at the same address nothing is put back (a sign-out on purpose stays)',
    restore({ origin: page.origin, items: copy.items }) === false && !window.localStorage.getItem('yt.leanback.default::auth'));

check('at a new address the copy is put back', restore(copy) === true
    && window.localStorage.getItem('yt.leanback.default::auth') === 'token');
await settle();
check('the copy is marked as the new address\'s', page.posts.length === 1 && page.posts[0].origin === page.origin,
    JSON.stringify(page.posts.map((p) => p.origin)));
check('and the page loads once more, signed in', page.reloads === 1, page.reloads);
check('the move is remembered for this load', window.sessionStorage.getItem(MOVED) === page.origin);

check('a move that did not take is not tried again in a loop', restore(copy) === false);
await settle();
check('so the page does not load again', page.reloads === 1, page.reloads);

check('nothing kept yet: nothing to put back', restore({}) === false);
check('a copy without items is not put back', restore({ origin: OLD }) === false);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
