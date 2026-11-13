import { every, stop, warn } from '../../framework/index.js';
import { realOrigin } from './pageOrigin.js';

// Keeps the TV signed in when the TV's network address changes.
//
// The page keeps everything (YouTube's sign-in, this app's settings, bookmarks) in its storage, and
// that storage belongs to the address the page was opened at. On a Tizen 5.5+ set that is the set's
// own address on the home network: when the router hands it another one, the page opens at the new
// address with empty storage and every account reads as signed out.
//
// So a copy of the storage is kept by the service on the TV, with the address it came from. Opened
// at a new address, the page puts the copy back and loads once more, signed in as before. Opened at
// the same address, nothing is put back: a sign-out made on purpose stays made.

const ROUTE = '/__tube/keep';
const SAVE = 'keep sign-in';
const ASK = 'keep sign-in read';

const SAVE_EVERY = 30000;
const ASK_EVERY = 5000;
const ASK_AT_MOST = 12;

// A value bigger than this is a cache, not a sign-in, and is left out of the copy.
const BIGGEST = 512 * 1024;
const MOST = 5 * 1024 * 1024;

// Set for the load that follows a move, so a move that does not take is not tried in a loop.
const MOVED = 'tube.keep.moved';

const state = { answered: false, sent: '', asked: 0 };

/** @returns {Storage | null} */
const storageOf = (name) => {
    try {
        return name === 'sessionStorage' ? window.sessionStorage || null : window.localStorage || null;
    } catch (error) {
        return null;
    }
};

const keysOf = (store) => Array.from({ length: store.length }, (_, i) => store.key(i)).filter((key) => typeof key === 'string');

// What the page holds now, without the values too big to be worth carrying.
const snapshot = (store) => keysOf(store).reduce((items, key) => {
    const value = store.getItem(key);
    if (typeof value === 'string' && value.length <= BIGGEST) items[key] = value;
    return items;
}, {});

const request = (method, body) => fetch(ROUTE, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json', 'X-Tube': '1' } : { 'X-Tube': '1' },
    body
}).then((response) => {
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
});

const save = () => {
    const store = storageOf('localStorage');
    if (!store) return;

    const text = JSON.stringify({ origin: realOrigin(), items: snapshot(store) });
    if (text === state.sent || text.length > MOST) return;

    request('POST', text)
        .then(() => { state.sent = text; })
        .catch((error) => warn('keep sign-in', `the copy was not kept: ${error && error.message}`));
};

const startSaving = () => {
    save();
    every(SAVE, SAVE_EVERY, save);
};

// The page's storage made the same as the copy: what the copy holds put in, what it does not taken
// out (what YouTube wrote while it found itself signed out at the new address).
const putBack = (store, items) => {
    keysOf(store).filter((key) => !Object.prototype.hasOwnProperty.call(items, key)
        && (store.getItem(key) || '').length <= BIGGEST).forEach((key) => store.removeItem(key));

    return Object.keys(items).filter((key) => {
        try {
            store.setItem(key, items[key]);
            return true;
        } catch (error) {
            return false;
        }
    }).length;
};

// Answers whether the page is loading again.
const restore = (copy) => {
    const store = storageOf('localStorage');
    const session = storageOf('sessionStorage');
    const here = realOrigin();

    if (!store || !copy || !copy.origin || !copy.items || copy.origin === here) return false;

    const moved = session && session.getItem(MOVED);
    if (moved === here) {
        warn('keep sign-in', `the storage of ${copy.origin} was already brought to ${here}; not again`);
        return false;
    }

    const count = putBack(store, copy.items);
    warn('keep sign-in', `the TV's address changed from ${copy.origin} to ${here}: ${count} stored items `
        + 'brought over, sign-in included; loading again');

    if (session) session.setItem(MOVED, here);

    // The copy is marked as this address's before loading again, so the next load finds nothing to move.
    const text = JSON.stringify({ origin: here, items: snapshot(store) });
    const reload = () => window.location.reload();
    request('POST', text).then(reload, reload);
    return true;
};

const ask = () => {
    if (state.answered) return;
    state.asked += 1;
    if (state.asked > ASK_AT_MOST) {
        stop(ASK);
        return;
    }

    request('GET')
        .then((copy) => {
            if (state.answered) return;
            state.answered = true;
            stop(ASK);
            if (!restore(copy)) startSaving();
        })
        .catch((error) => {
            // No such route: an older service, or the Android app, where the address never changes.
            if (/status 40[34]/.test(String(error && error.message))) stop(ASK);
        });
};

const start = () => {
    // Only a page served by the service over the home network has an address that can change.
    if (!/^http:\/\//.test(realOrigin()) || !storageOf('localStorage') || typeof fetch !== 'function') return;

    ask();
    every(ASK, ASK_EVERY, ask);
};

export { start, snapshot, putBack, restore, MOVED };
