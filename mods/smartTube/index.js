import {
    configChangeEmitter, configRead, every, onKey, onRequest, report, resolve
} from '../../framework/index.js';
import { glass } from '../notice/index.js';
import { leaveConfirmed } from '../exitConfirm/index.js';
import { openStremio } from '../stremio/index.js';
import { pageOf } from './data.js';
import { COLUMNS, KEYBOARD, SEARCH, labelOf, step, suggestUrl, suggestionsOf, typed } from './search.js';
import { CSS, ICONS, LOGO } from './look.js';

// SmartTube UI: a home screen of UltimatiumTube's own, in the manner of SmartTube on Android TV, drawn
// over YouTube's home whenever the interface mode is SmartTube. A side menu with UltimatiumTube's name
// at the top, sections of rows of video cards, a clock. The rows are YouTube's own answers for each
// section, asked as YouTube asks for them (with its sign-in), so they are the account's; a card opens
// with YouTube's own command for it, in YouTube's own player. Away from YouTube's home (a video, a
// search, a channel, the settings) YouTube's own screens show as they are.

const ID = 'tube-smart';
const BACK_KEYS = [8, 27, 461, 10009];
const KEYS = [13, 37, 38, 39, 40].concat(BACK_KEYS);

const SECTIONS = [
    { label: 'Home', browse: 'default', icon: 'home' },
    { label: 'Subscriptions', browse: 'FEsubscriptions', icon: 'subs' },
    { label: 'Library', browse: 'FElibrary', icon: 'library' },
    { label: 'History', browse: 'FEhistory', icon: 'history' },
    { label: 'Music', browse: 'FEtopics_music', icon: 'music' },
    { label: 'Gaming', browse: 'FEtopics_gaming', icon: 'game' },
    { label: 'News', browse: 'FEtopics_news', icon: 'news' },
    { label: 'Sports', browse: 'FEtopics_sports', icon: 'trophy' },
    { label: 'Live', browse: 'FEtopics_live', icon: 'live' },
    { label: 'Podcasts', browse: 'FEtopics_podcasts', icon: 'mic' },
    { label: 'Movies & TV', browse: 'FEtopics_movies', icon: 'film' },
    { label: 'Search', search: true, icon: 'search' },
    { label: 'Stremio & Grayjay', action: 'stremio', icon: 'stremio' },
    { label: 'Classic YouTube', action: 'classic', icon: 'yt' },
    { label: 'Settings', action: 'settings', icon: 'gear' }
];

// The card's size and the gap between cards, on the 1920 x 1080 the screen is drawn at.
const CARD = 352;
const GAP = 30;
const ROW = 412;
const SEEN_WIDTH = 1920 - 360 - 70 - 28;

const state = {
    root: null, shown: false, suppressed: false, zone: 'rail', rail: 0, section: 0,
    rows: [], row: 0, cards: {}, more: null, loading: false, asked: 0, message: '',
    headers: {}, context: null,
    // The search screen: what is typed, the key and suggestion in focus, YouTube's suggestions.
    query: '', key: 0, hint: 0, hints: [], hinted: 0
};

const searching = () => !!SECTIONS[state.section].search;

const wanted = () => configRead('uiMode') === 'smarttube';

// --- YouTube's own way of asking: its sign-in headers and its client context, as it sends them.

const HEADER = /^(authorization|x-goog-authuser|x-goog-visitor-id|x-youtube-client-name|x-youtube-client-version|x-goog-pageid)$/i;
const OURS = /\/youtubei\/v1\//;

const note = (url, name, value) => {
    if (OURS.test(String(url || '')) && HEADER.test(String(name)) && value) state.headers[String(name).toLowerCase()] = String(value);
};

const watchRequests = () => {
    /** @type {any} */
    const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (proto && !proto.__tubeSmartWatched) {
        proto.__tubeSmartWatched = true;
        const open = proto.open;
        const set = proto.setRequestHeader;
        proto.open = function tubeOpen(method, url) {
            this.__tubeUrl = url;
            return open.apply(this, arguments);
        };
        proto.setRequestHeader = function tubeHeader(name, value) {
            note(this.__tubeUrl, name, value);
            return set.apply(this, arguments);
        };
    }

    /** @type {any} */
    const real = window.fetch;
    if (typeof real === 'function' && !real.__tubeSmartWatched) {
        /** @type {any} */
        const watched = function tubeFetch(input, init) {
            try {
                const url = typeof input === 'string' ? input : input && input.url;
                const headers = init && init.headers;
                if (headers && typeof headers.forEach === 'function') headers.forEach((value, name) => note(url, name, value));
                else if (headers) Object.keys(headers).forEach((name) => note(url, name, headers[name]));
            } catch (error) {
                // Only noted.
            }
            return real.apply(this, arguments);
        };
        watched.__tubeSmartWatched = true;
        window.fetch = watched;
    }
};

// From the start, before YouTube's own scripts keep a hold of fetch.
watchRequests();

onRequest('smarttube context', ['context'], (body) => {
    if (body && body.context && body.context.client) state.context = body.context;
    return body;
});

const contextNow = () => state.context
    || (window.yt && window.yt.config_ && window.yt.config_.INNERTUBE_CONTEXT)
    || { client: { clientName: 'TVHTML5', clientVersion: '7.20250101.00.00', hl: 'en' } };

const ask = (endpoint, body) => window.fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    credentials: 'include',
    headers: Object.assign({ 'Content-Type': 'application/json' }, state.headers),
    body: JSON.stringify(Object.assign({ context: contextNow() }, body))
}).then((response) => {
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
});

const browse = (body) => ask('browse', body);

// --- drawing

const element = (tag, className, text) => {
    const made = document.createElement(tag);
    if (className) made.className = className;
    if (text !== undefined) made.textContent = text;
    return made;
};

const icon = (name) => {
    const holder = element('span', 'ust-icon');
    holder.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="${ICONS[name] || ICONS.home}"/></svg>`;
    return holder;
};

const part = (selector) => (state.root ? state.root.querySelector(selector) : null);

const clock = () => {
    const now = new Date();
    const time = part('.ust-clock');
    if (time) time.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const fit = () => {
    if (!state.root) return;
    const stage = part('.ust-stage');
    const scale = Math.min((window.innerWidth || 1920) / 1920, (window.innerHeight || 1080) / 1080);
    stage.style.transform = `scale(${scale})`;
    stage.style.left = `${Math.round(((window.innerWidth || 1920) - 1920 * scale) / 2)}px`;
    stage.style.top = `${Math.round(((window.innerHeight || 1080) - 1080 * scale) / 2)}px`;
};

const build = () => {
    if (state.root) return state.root;
    const style = element('style');
    style.id = `${ID}-style`;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    const root = element('div');
    root.id = ID;
    const stage = element('div', 'ust-stage');
    const rail = element('div', 'ust-rail');
    const logo = element('div', 'ust-logo');
    logo.innerHTML = LOGO;
    const name = element('div', 'ust-name');
    name.appendChild(element('span', 'ust-name-a', 'Ultimatium'));
    name.appendChild(element('span', 'ust-name-b', 'Tube'));
    logo.appendChild(name);
    rail.appendChild(logo);

    const items = element('div', 'ust-items');
    SECTIONS.forEach((section, at) => {
        const item = element('div', 'ust-item');
        item.setAttribute('data-at', String(at));
        item.appendChild(icon(section.icon));
        item.appendChild(element('span', 'ust-label', section.label));
        items.appendChild(item);
    });
    rail.appendChild(items);

    const main = element('div', 'ust-main');
    const top = element('div', 'ust-top');
    top.appendChild(element('div', 'ust-title', ''));
    top.appendChild(element('div', 'ust-clock', ''));
    main.appendChild(top);
    const finder = element('div', 'ust-search');
    finder.appendChild(element('div', 'ust-query', ''));
    const pad = element('div', 'ust-keys');
    KEYBOARD.forEach((key) => pad.appendChild(element('div', key === SEARCH ? 'ust-key ust-key-go' : 'ust-key', labelOf(key))));
    finder.appendChild(pad);
    finder.appendChild(element('div', 'ust-hints'));
    main.appendChild(finder);
    const view = element('div', 'ust-view');
    view.appendChild(element('div', 'ust-rows'));
    view.appendChild(element('div', 'ust-message', ''));
    main.appendChild(view);

    stage.appendChild(rail);
    stage.appendChild(main);
    root.appendChild(stage);
    (document.body || document.documentElement).appendChild(root);
    state.root = root;
    fit();
    clock();
    return root;
};

const cardElement = (card) => {
    const box = element('div', 'ust-card');
    const thumb = element('div', 'ust-thumb');
    const picture = element('img', 'ust-picture');
    picture.setAttribute('data-src', card.picture || '');
    picture.alt = '';
    thumb.appendChild(picture);
    if (card.badge) thumb.appendChild(element('span', card.badge === 'LIVE' ? 'ust-badge ust-live' : 'ust-badge', card.badge));
    if (card.kind !== 'video') thumb.appendChild(element('span', 'ust-kind', card.kind === 'playlist' ? 'PLAYLIST' : card.kind === 'channel' ? 'CHANNEL' : 'SHORT'));
    box.appendChild(thumb);
    box.appendChild(element('div', 'ust-card-title', card.title));
    box.appendChild(element('div', 'ust-card-meta', card.lines.join(' · ')));
    return box;
};

const rowElement = (row) => {
    const box = element('div', 'ust-row');
    box.appendChild(element('div', 'ust-row-title', row.title || ''));
    const strip = element('div', 'ust-strip');
    row.cards.forEach((card) => strip.appendChild(cardElement(card)));
    box.appendChild(strip);
    return box;
};

const showPictures = () => {
    const rows = state.root ? state.root.querySelectorAll('.ust-row') : [];
    Array.prototype.forEach.call(rows, (row, at) => {
        if (Math.abs(at - state.row) > 2) return;
        Array.prototype.forEach.call(row.querySelectorAll('img[data-src]'), (picture) => {
            const source = picture.getAttribute('data-src');
            picture.removeAttribute('data-src');
            if (source) picture.src = source;
        });
    });
};

const paintSearch = () => {
    const finder = part('.ust-search');
    const on = searching() && state.zone !== 'rows';
    finder.style.display = on ? 'block' : 'none';
    part('.ust-view').className = on ? 'ust-view ust-below' : 'ust-view';
    if (!on) return;
    part('.ust-query').textContent = state.query ? `${state.query}\u2502` : 'Type to search YouTube\u2026';
    part('.ust-query').className = state.query ? 'ust-query' : 'ust-query ust-empty';
    Array.prototype.forEach.call(finder.querySelectorAll('.ust-key'), (key, at) => {
        key.className = `ust-key${KEYBOARD[at] === SEARCH ? ' ust-key-go' : ''}${state.zone === 'keys' && at === state.key ? ' ust-focus' : ''}`;
    });
    const hints = part('.ust-hints');
    hints.innerHTML = '';
    state.hints.forEach((hint, at) => hints.appendChild(element('div', `ust-hint${state.zone === 'hints' && at === state.hint ? ' ust-focus' : ''}`, hint)));
};

// What is focused and where everything sits, drawn from the state.
const paint = () => {
    if (!state.root) return;
    Array.prototype.forEach.call(state.root.querySelectorAll('.ust-item'), (item, at) => {
        item.className = `ust-item${at === state.section ? ' ust-current' : ''}${state.zone === 'rail' && at === state.rail ? ' ust-focus' : ''}`;
    });
    state.root.className = state.zone === 'rail' ? 'ust-in-rail' : 'ust-in-rows';

    const rows = state.root.querySelectorAll('.ust-row');
    Array.prototype.forEach.call(rows, (rowBox, at) => {
        const chosen = state.cards[at] || 0;
        const count = (state.rows[at] && state.rows[at].cards.length) || 0;
        const most = Math.max(0, count * (CARD + GAP) - GAP - SEEN_WIDTH);
        const shift = Math.min(most, Math.max(0, (chosen - 1) * (CARD + GAP)));
        rowBox.querySelector('.ust-strip').style.transform = `translateX(${-shift}px)`;
        rowBox.className = `ust-row${at === state.row ? ' ust-row-on' : ''}`;
        Array.prototype.forEach.call(rowBox.querySelectorAll('.ust-card'), (box, index) => {
            box.className = `ust-card${state.zone === 'rows' && at === state.row && index === chosen ? ' ust-focus' : ''}`;
        });
    });
    part('.ust-rows').style.transform = `translateY(${-state.row * ROW}px)`;
    part('.ust-message').textContent = state.message;
    part('.ust-message').style.display = state.message ? 'block' : 'none';
    part('.ust-title').textContent = SECTIONS[state.section].label;
    paintSearch();
    showPictures();
};

// --- sections

const addRows = (rows) => {
    const holder = part('.ust-rows');
    rows.forEach((row) => holder.appendChild(rowElement(row)));
    state.rows = state.rows.concat(rows);
};

const EMPTY = 'Nothing here yet. Sign in to YouTube to see your own: choose Classic YouTube in the menu, sign in, '
    + 'and come back with Back.';

const load = (at) => {
    const section = SECTIONS[at];
    state.section = at;
    state.rows = [];
    state.row = 0;
    state.cards = {};
    state.more = null;
    state.asked += 1;
    const asked = state.asked;
    part('.ust-rows').innerHTML = '';
    state.message = 'Loading…';
    paint();

    browse({ browseId: section.browse }).then((answer) => {
        if (asked !== state.asked) return;
        const page = pageOf(answer);
        state.more = page.more;
        addRows(page.rows);
        state.message = page.rows.length ? '' : EMPTY;
        paint();
    }).catch((error) => {
        if (asked !== state.asked) return;
        state.message = /status 40[13]/.test(String(error && error.message)) ? EMPTY : 'YouTube did not answer. Press OK to try again.';
        paint();
    });
};

// More rows as the end comes near.
const loadMore = () => {
    if (!state.more || state.loading || state.row < state.rows.length - 3) return;
    state.loading = true;
    const asked = state.asked;
    browse({ continuation: state.more }).then((answer) => {
        state.loading = false;
        if (asked !== state.asked) return;
        const page = pageOf(answer);
        state.more = page.more;
        addRows(page.rows);
        paint();
    }).catch(() => {
        state.loading = false;
        state.more = null;
    });
};

// --- searching

const language = () => (contextNow().client && contextNow().client.hl) || 'en';

const suggest = () => {
    state.hinted += 1;
    const asked = state.hinted;
    const query = state.query.trim();
    if (!query) {
        state.hints = [];
        paint();
        return;
    }
    setTimeout(() => {
        if (asked !== state.hinted) return;
        window.fetch(suggestUrl(query, language()), { credentials: 'include' })
            .then((response) => response.text())
            .then((text) => {
                if (asked !== state.hinted) return;
                state.hints = suggestionsOf(text);
                state.hint = Math.min(state.hint, Math.max(0, state.hints.length - 1));
                paint();
            })
            .catch(() => undefined);
    }, 150);
};

const runSearch = (query) => {
    const words = String(query || '').trim();
    if (!words) return;
    state.query = words;
    state.rows = [];
    state.row = 0;
    state.cards = {};
    state.more = null;
    state.asked += 1;
    const asked = state.asked;
    part('.ust-rows').innerHTML = '';
    state.message = 'Searching\u2026';
    state.zone = 'rows';
    paint();
    ask('search', { query: words }).then((answer) => {
        if (asked !== state.asked) return;
        const page = pageOf(answer);
        state.more = null;
        addRows(page.rows.map((row) => ({ title: row.title || `Results for \u201c${words}\u201d`, cards: row.cards })));
        state.message = page.rows.length ? '' : `Nothing found for \u201c${words}\u201d.`;
        if (!page.rows.length) state.zone = 'keys';
        paint();
    }).catch(() => {
        if (asked !== state.asked) return;
        state.message = 'YouTube did not answer. Press OK to try again.';
        state.zone = 'keys';
        paint();
    });
};

const enterSearch = (at) => {
    state.section = at;
    state.zone = 'keys';
    state.rows = [];
    state.row = 0;
    state.message = '';
    part('.ust-rows').innerHTML = '';
    paint();
};

const pressKey = () => {
    const key = KEYBOARD[state.key];
    if (key === SEARCH) {
        runSearch(state.query);
        return;
    }
    state.query = typed(state.query, key);
    paint();
    suggest();
};

const moveInSearch = (code) => {
    if (state.zone === 'keys') {
        const next = step(state.key, code);
        if (next !== -1) state.key = next;
        else if (code === 37) {
            state.zone = 'rail';
            state.rail = state.section;
        } else if (code === 39 && state.hints.length) state.zone = 'hints';
        else if (code === 40 && state.rows.length) state.zone = 'rows';
        paint();
        return true;
    }
    if (state.zone === 'hints') {
        if (code === 38) state.hint = Math.max(0, state.hint - 1);
        if (code === 40) state.hint = Math.min(state.hints.length - 1, state.hint + 1);
        if (code === 37) {
            state.zone = 'keys';
            state.key = Math.min(KEYBOARD.length - 1, Math.floor(state.key / COLUMNS) * COLUMNS + COLUMNS - 1);
        }
        paint();
        return true;
    }
    // In the results: Up from the first row goes back to the keyboard.
    if (state.zone === 'rows' && code === 38 && state.row === 0) {
        state.zone = 'keys';
        paint();
        return true;
    }
    return false;
};

// --- showing it over YouTube's home, and only there

const HOME_PAGES = ['', 'default', 'FEtopics', 'FEwhat_to_watch'];

// YouTube's screens that keep the home's address: the Shorts player is one. The screen stays out of
// their way.
const OVER_HOME = ['ytlr-shorts-page', 'ytlr-reel-player-overlay-renderer'];

const onYouTubeHome = () => {
    if (OVER_HOME.some((tag) => document.querySelector(tag))) return false;
    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (hash === '' || hash === '/') return true;
    const browsing = /^\/browse(\?|$)/.exec(hash);
    if (!browsing) return false;
    const page = /[?&]c=([^&]*)/.exec(hash);
    return HOME_PAGES.indexOf(page ? decodeURIComponent(page[1]) : '') !== -1;
};

const show = () => {
    build();
    state.root.style.display = 'block';
    if (!state.shown) {
        state.shown = true;
        if (!state.rows.length && !state.loading) load(state.section);
    }
    paint();
};

const hide = () => {
    if (state.root) state.root.style.display = 'none';
    state.shown = false;
};

const look = () => {
    if (wanted() && !state.suppressed && onYouTubeHome()) show();
    else hide();
};

// --- what the remote does

const open = (card) => {
    hide();
    try {
        resolve(card.command);
    } catch (error) {
        report('smarttube', 'open failed', error);
    }
};

const goTo = (hash) => {
    hide();
    window.location.hash = hash;
};

const act = (section) => {
    if (section.action === 'settings') {
        goTo('/settings');
        return;
    }
    if (section.action === 'stremio') {
        openStremio();
        return;
    }
    if (section.action === 'classic') {
        state.suppressed = true;
        hide();
    }
};

const askToLeave = () => glass('Exit UltimatiumTube?', ['Exit leaves the app. Stay keeps you where you were.'], [
    { label: 'Stay' },
    { label: 'Exit', run: leaveConfirmed }
]);

const pressOk = () => {
    if (state.zone === 'keys') {
        pressKey();
        return;
    }
    if (state.zone === 'hints') {
        runSearch(state.hints[state.hint]);
        return;
    }
    if (state.zone === 'rail') {
        const section = SECTIONS[state.rail];
        if (section.action) {
            act(section);
            return;
        }
        if (section.search) {
            enterSearch(state.rail);
            return;
        }
        load(state.rail);
        state.zone = 'rows';
        paint();
        return;
    }
    const row = state.rows[state.row];
    const card = row && row.cards[state.cards[state.row] || 0];
    if (card) open(card);
    else if (searching()) state.zone = 'keys';
    else if (state.message) load(state.section);
};

const move = (code) => {
    if (state.zone === 'rail') {
        if (code === 38) state.rail = Math.max(0, state.rail - 1);
        if (code === 40) state.rail = Math.min(SECTIONS.length - 1, state.rail + 1);
        if (code === 39 && searching() && state.rail === state.section) state.zone = 'keys';
        else if (code === 39 && state.rows.length) state.zone = 'rows';
        paint();
        return;
    }
    if (searching() && moveInSearch(code)) return;
    const count = (state.rows[state.row] && state.rows[state.row].cards.length) || 0;
    const chosen = state.cards[state.row] || 0;
    if (code === 37) {
        if (chosen === 0) {
            state.zone = 'rail';
            state.rail = state.section;
        } else state.cards[state.row] = chosen - 1;
    }
    if (code === 39) state.cards[state.row] = Math.min(count - 1, chosen + 1);
    if (code === 38) state.row = Math.max(0, state.row - 1);
    if (code === 40) state.row = Math.min(state.rows.length - 1, state.row + 1);
    paint();
    loadMore();
};

const keys = (event) => {
    if (!state.shown || !state.root || state.root.style.display === 'none') return false;
    // The glass panel (welcome, exit) answers its own keys, and a key it took is not ours too.
    if (event.__tubeGlass || document.getElementById('tube-glass')) return false;
    if (event.type !== 'keydown') return true;

    const code = event.keyCode;
    if (BACK_KEYS.indexOf(code) !== -1) {
        if (state.zone === 'rows' && searching()) state.zone = 'keys';
        else if (state.zone !== 'rail') {
            state.zone = 'rail';
            state.rail = state.section;
        } else {
            askToLeave();
            return true;
        }
        paint();
        return true;
    }
    if (code === 13) pressOk();
    else move(code);
    return true;
};

const start = () => {
    onKey('smarttube ui', KEYS, keys);
    window.addEventListener('hashchange', look);
    window.addEventListener('resize', fit);
    every('smarttube look', 500, look);
    every('smarttube clock', 15000, clock);
    configChangeEmitter.addEventListener('configChange', (event) => {
        if (event.detail.key === 'uiMode') look();
    });
    look();
};

export { start, onYouTubeHome, SECTIONS, state };
