import { VERSION, configDefaults, configRead, configWrite, every, findResolver, onKey, resolve, showToast, stop } from '../../framework/index.js';
import { SMARTTUBE, STOCK, ULTIMATIUMTUBE, uiMode, writesFor } from '../uiMode/index.js';

// The welcome message the app opens with, and the "What's new" page, as a glass panel of our own drawn
// over YouTube: a translucent dark pane with a glowing edge and its buttons in a row. Its keys are
// held while it is open: Left and Right choose a button, OK presses it, Back closes it.

const WELCOME = [
    'Hello, thanks for using the app. Dev of UltimatiumTube here.',
    'Many features have been added, so much so that I am running out of features to add. To make UltimatiumTube '
        + 'better, star the project and add feature suggestions in the GitHub issues section. I will look into every '
        + 'suggestion and decide whether to add it or not.',
    'From now on UltimatiumTube will aim to be the best Tizen YouTube streaming platform. It will also receive more '
        + 'focus than AniUltimatium: that app has been removed from the Tizen community packages list (you can still '
        + 'install it with a custom WGT), and AniUltimatium Lite is not getting much community support either. '
        + 'Therefore, I have decided to make UltimatiumTube my priority.'
];

const WHATS_NEW = [
    ['Welcome with Close', 'The welcome has Close and Don\u2019t show again; it is under Settings all the same'],
    ['The YouTube app, for real', 'UltimatiumTube mode loads YouTube as Samsung\u2019s own YouTube app gets it: Shorts one after another in the Shorts player, search as in the app'],
    ['Three modes', 'UltimatiumTube, SmartTube UI and YT Dummy, offered every time the app opens'],
    ['Shorts like YouTube\u2019s own TV app', 'Every Short opens in YouTube\u2019s own Shorts player, not as an ordinary video'],
    ['Quick search in SmartTube UI', 'A keyboard of its own, suggestions as you type, results as rows of cards'],
    ['SmartTube UI, for real', 'An UltimatiumTube home screen in SmartTube\u2019s manner: side menu, rows of your videos, red focus, clock; YouTube\u2019s player'],
    ['Self-updating', 'New versions of UltimatiumTube arrive by themselves from GitHub, like youtube-dummy; no reinstall'],
    ['Speed up to 20x', 'With the UltimatiumTube label under the speeds YouTube does not offer'],
    ['Like YouTube\u2019s own TV app', 'Full animations, Shorts in their own player, quicker search suggestions and a remote that answers at once'],
    ['Loads YouTube straight', 'Like youtube-dummy: no Cobalt container and no service to wait on, so no more host errors. Tizen 3 and up'],
    ['Starts reliably', 'The app no longer stays on the start screen when the TV answers on another address, and keeps loading after the router gives the TV a new one'],
    ['Stay signed in', 'A new network address for the TV no longer signs every account out'],
    ['Universal Media Control Center', 'One place for YouTube, Stremio, Grayjay and AniUltimatium: continue watching, favourites, feeds, search'],
    ['Custom feeds', 'The newest videos of the channels in each of your collections'],
    ['Smart playlists', 'Play a feed or a keyword mix as one continuous playlist, shuffled or in order'],
    ['Playback profiles', 'Cinema, Learning, Music and Sports: speed, quality, fit and skipping in one press'],
    ['A-B repeat', 'Loop a part of a video; seek steps of your choice'],
    ['User profiles and Guest mode', 'Separate settings, bookmarks, themes and filters for each person'],
    ['Content intelligence', 'Duplicates and reposts hidden, clickbait filtered, watched videos marked, rules of your own'],
    ['Shorts control center', 'Shorts by length, channel, words and collections'],
    ['Movie covers', 'Posters and backdrops from Cinemeta where an addon gives none'],
    ['Voice', 'Searches from the TV’s voice assistant reach the app (where the TV passes them on)']
];

const ID = 'tube-glass';
const BACK_KEYS = [8, 27, 461, 10009];
const ALL_KEYS = [13, 37, 38, 39, 40].concat(BACK_KEYS);

const state = { open: null, index: 0, buttons: [] };

const STYLE = {
    shade: 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;'
        + 'background-color:rgba(0,0,0,0.55);',
    pane: 'position:absolute;left:50%;top:50%;width:1180px;margin-left:-590px;transform:translateY(-50%);'
        + 'padding:44px 52px 36px 52px;border-radius:28px;color:#f2f6ff;font-family:Roboto,Arial,sans-serif;'
        + 'background:linear-gradient(135deg,rgba(62,166,255,0.22) 0%,rgba(20,26,44,0.88) 38%,rgba(10,14,26,0.92) 100%);'
        + 'border:2px solid rgba(140,200,255,0.55);box-shadow:0 0 40px rgba(62,166,255,0.45),inset 0 1px 0 rgba(255,255,255,0.35);',
    title: 'font-size:44px;font-weight:bold;margin:0 0 18px 0;color:#ffffff;text-shadow:0 0 18px rgba(62,166,255,0.9);',
    text: 'font-size:27px;line-height:38px;margin:0 0 16px 0;color:#dce6f7;',
    row: 'font-size:25px;line-height:34px;margin:0 0 10px 0;color:#dce6f7;',
    buttons: 'margin-top:26px;text-align:right;',
    button: 'display:inline-block;margin-left:18px;padding:14px 34px;border-radius:40px;font-size:27px;font-weight:bold;'
        + 'background-color:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.25);color:#ffffff;',
    focused: 'display:inline-block;margin-left:18px;padding:14px 34px;border-radius:40px;font-size:27px;font-weight:bold;'
        + 'background-color:#3ea6ff;border:2px solid #ffffff;color:#04101d;box-shadow:0 0 22px rgba(62,166,255,0.95);'
};

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// More than three buttons are drawn smaller, so the row fits the panel.
const COMPACT = 'padding:12px 22px;margin-left:12px;margin-top:10px;font-size:24px;';

const paint = () => {
    const nodes = state.open ? state.open.querySelectorAll('[data-glass-button]') : [];
    const compact = nodes.length > 3 ? COMPACT : '';
    Array.prototype.forEach.call(nodes, (node, i) => {
        node.style.cssText = (i === state.index ? STYLE.focused : STYLE.button) + compact;
    });
};

const close = () => {
    if (state.open && state.open.parentNode) state.open.parentNode.removeChild(state.open);
    state.open = null;
    state.buttons = [];
};

// title, paragraphs (strings) or rows ([name, text]), buttons ([{ label, run }]).
const glass = (title, lines, buttons) => {
    close();
    const shade = document.createElement('div');
    shade.id = ID;
    shade.style.cssText = STYLE.shade;

    const body = lines.map((line) => (Array.isArray(line)
        ? `<p style="${STYLE.row}"><b style="color:#9fd3ff">${escape(line[0])}</b> — ${escape(line[1])}</p>`
        : `<p style="${STYLE.text}">${escape(line)}</p>`)).join('');
    const row = buttons.map((b, i) => `<span data-glass-button="${i}">${escape(b.label)}</span>`).join('');
    shade.innerHTML = `<div style="${STYLE.pane}"><h2 style="${STYLE.title}">${escape(title)}</h2>${body}`
        + `<div style="${STYLE.buttons}">${row}</div></div>`;

    (document.body || document.documentElement).appendChild(shade);
    state.open = shade;
    state.buttons = buttons;
    state.index = 0;
    paint();
};

const keys = (event) => {
    if (!state.open) return false;
    // Marked as taken, so what is drawn under the panel does not act on the same press.
    event.__tubeGlass = true;
    if (event.type !== 'keydown') return true;

    const code = event.keyCode;
    if (BACK_KEYS.indexOf(code) !== -1) close();
    else if (code === 37 || code === 38) state.index = Math.max(0, state.index - 1);
    else if (code === 39 || code === 40) state.index = Math.min(state.buttons.length - 1, state.index + 1);
    else if (code === 13) {
        const chosen = state.buttons[state.index];
        close();
        if (chosen && chosen.run) chosen.run();
        return true;
    }
    paint();
    return true;
};

const showWhatsNew = () => glass(`What’s new in UltimatiumTube ${VERSION}`, WHATS_NEW, [
    { label: 'OK' },
    { label: 'Open the Control Center', run: () => resolve({ customAction: { action: 'OPEN_STREMIO', parameters: {} } }) }
]);

const showWelcome = () => glass('UltimatiumTube', WELCOME, [
    { label: 'OK' },
    { label: 'What’s new', run: showWhatsNew },
    { label: 'Don’t show again', run: () => configWrite('welcomeHidden', true) }
]);

// What the app opens with, every time: welcome, and which interface. Back keeps the one there is.
const CHOOSER = [
    'Choose how YouTube looks and behaves on this TV. Adverts and sponsor segments are taken out in all three.',
    ['UltimatiumTube', 'The YouTube app as Samsung\u2019s own YouTube app gets it: Shorts in the Shorts player, search as in the app, '
        + 'with everything UltimatiumTube adds'],
    ['SmartTube UI', 'An UltimatiumTube home screen in SmartTube\u2019s manner: a side menu, rows of your videos, quick search, red focus'],
    ['YT Dummy', 'YouTube as youtube-dummy loads it, untouched'],
    'You can change it any time in Settings > UltimatiumTube > Interface mode.'
];

// The mode already on is kept as it is (with whatever was changed in it since), not set again.
const choose = (mode) => {
    if (mode !== uiMode()) writesFor(mode, configRead, configDefaults()).forEach((write) => configWrite(write.key, write.value));
    configWrite('uiChosen', true);
};

const CHOICES = [['UltimatiumTube', ULTIMATIUMTUBE], ['SmartTube UI', SMARTTUBE], ['YT Dummy', STOCK]];

// The welcome is closed with Close (or Back), and kept from opening again with Don't show again; it
// is under Settings > UltimatiumTube > Profiles and what's new all the same.
const showChooser = () => {
    glass('Welcome to UltimatiumTube', CHOOSER, CHOICES.map(([label, mode]) => ({ label, run: () => choose(mode) })).concat([
        { label: 'Close', run: () => undefined },
        { label: 'Don\u2019t show again', run: () => configWrite('welcomeHidden', true) }
    ]));
    // The button of the interface already on is the one OK presses.
    const on = CHOICES.map((choice) => choice[1]).indexOf(uiMode());
    if (on >= 0) {
        state.index = on;
        paint();
    }
};

const NAME = 'startup notice';

// Every time the app opens: on its first page, not again when YouTube reloads itself (after a sign-in)
// or a mode just chosen loads it afresh. The loader says which page is the first; elsewhere every
// page is.
const firstPanel = () => (window.__tubeFirstLoad === false || configRead('welcomeHidden') ? null : showChooser);

// The app's loader says so when it has kept a newer version of UltimatiumTube for the next start.
const heardUpdate = (event) => {
    const data = event && event.data;
    if (!data || data.tube !== 'updated' || typeof data.version !== 'string') return;
    showToast('UltimatiumTube updated', `Version ${data.version} is ready. It starts the next time you open the app`);
};

const start = () => {
    if (window.addEventListener) window.addEventListener('message', heardUpdate);
    onKey('glass panel', ALL_KEYS, keys);
    if (!firstPanel()) return;

    // The page is not ready for a panel until YouTube's own commands can be sent.
    every(NAME, 1500, () => {
        if (!findResolver()) return;
        stop(NAME);
        const panel = firstPanel();
        if (panel) setTimeout(panel, 1200);
    });
};

export { start, showWelcome, showWhatsNew, showChooser, choose, glass, close, firstPanel, state, WELCOME, WHATS_NEW, CHOOSER };
