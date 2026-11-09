import { VERSION, configRead, configWrite, every, findResolver, onKey, resolve, stop } from '../../framework/index.js';

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

const paint = () => {
    const nodes = state.open ? state.open.querySelectorAll('[data-glass-button]') : [];
    Array.prototype.forEach.call(nodes, (node, i) => {
        node.style.cssText = i === state.index ? STYLE.focused : STYLE.button;
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

const NAME = 'startup notice';

const start = () => {
    onKey('glass panel', ALL_KEYS, keys);
    if (configRead('welcomeHidden')) return;

    // The page is not ready for a panel until YouTube's own commands can be sent.
    every(NAME, 1500, () => {
        if (!findResolver()) return;
        stop(NAME);
        setTimeout(showWelcome, 1200);
    });
};

export { start, showWelcome, showWhatsNew, glass, close, WELCOME, WHATS_NEW };
