import { configRead, onKey, resolve, showToast, video } from '../../framework/index.js';

// Actions are sent as the app's own commands (mods/commands), so this file needs none of the mods
// that carry them out.
const command = (action) => () => resolve({ customAction: { action, parameters: {} } });

// The coloured buttons of the remote, each with an action for a press and one for a long press,
// chosen in the settings (Remote buttons). A button set to nothing is left to YouTube.

const KEYS = { red: 403, green: 404, yellow: 405, blue: 406 };
const HOLD = 600; // ms: held this long, it is a long press

const onWatchPage = () => String(window.location.hash || '').indexOf('#/watch') === 0;

const seekBy = (seconds) => {
    const v = video();
    if (!v) return false;
    v.currentTime = Math.max(0, Math.min((v.duration || Infinity) - 1, v.currentTime + seconds));
    return true;
};

// Each: what it does, and whether it is only for while a video plays (elsewhere the key is left alone).
const ACTIONS = {
    fit: { run: command('CYCLE_VIDEO_FIT'), watching: true },
    fitMenu: { run: command('OPEN_VIDEO_FIT'), watching: true },
    speed: { run: command('OPEN_SPEED_OPTIONS'), watching: true },
    bookmark: { run: command('ADD_BOOKMARK'), watching: true },
    bookmarks: { run: command('OPEN_BOOKMARKS'), watching: false },
    quality: { run: command('OPEN_CHANNEL_QUALITY'), watching: true },
    replay: { run: () => seekBy(-(Number(configRead('seekBackSeconds')) || 10)), watching: true },
    forward: { run: () => seekBy(Number(configRead('seekForwardSeconds')) || 30), watching: true },
    abRepeat: { run: command('AB_REPEAT'), watching: true },
    profiles: { run: command('OPEN_PROFILES'), watching: false },
    whatsNew: { run: command('OPEN_WHATS_NEW'), watching: false },
    restart: { run: () => seekBy(-1e9), watching: true },
    collect: { run: command('CHOOSE_COLLECTION'), watching: true },
    collections: { run: command('OPEN_COLLECTIONS'), watching: false },
    stremio: { run: command('OPEN_STREMIO'), watching: false }
};

const actionFor = (color, held) => {
    const name = configRead(`key${color.charAt(0).toUpperCase()}${color.slice(1)}${held ? 'Hold' : ''}`);
    return name && ACTIONS[name] ? ACTIONS[name] : null;
};

const usable = (action) => !!action && (!action.watching || onWatchPage());

const pressed = {};

const handle = (color) => (event) => {
    const press = actionFor(color, false);
    const hold = actionFor(color, true);
    if (!usable(press) && !usable(hold)) return false;

    if (event.type === 'keydown') {
        if (!pressed[color]) {
            pressed[color] = { at: Date.now(), done: false };
            // Without a long-press action, the press acts at once.
            if (!usable(hold)) {
                pressed[color].done = true;
                press.run();
            }
        } else if (!pressed[color].done && usable(hold) && Date.now() - pressed[color].at >= HOLD) {
            // A held key repeats its keydown: the long press acts as soon as it is long enough.
            pressed[color].done = true;
            hold.run();
        }
        return true;
    }

    if (event.type === 'keyup') {
        const was = pressed[color];
        pressed[color] = null;
        if (was && !was.done) {
            if (usable(hold) && Date.now() - was.at >= HOLD) hold.run();
            else if (usable(press)) press.run();
        }
    }

    return true;
};

const start = () => {
    Object.keys(KEYS).forEach((color) => onKey(`remote ${color}`, [KEYS[color]], handle(color)));
};

const ACTION_NAMES = {
    none: 'Nothing (left to YouTube)', fit: 'Next video fit', fitMenu: 'Video fit menu', speed: 'Speed menu',
    bookmark: 'Bookmark this moment', bookmarks: 'Open bookmarks', quality: 'Quality for this channel',
    replay: 'Back (the seek step)', forward: 'Forward (the seek step)', abRepeat: 'A-B repeat (mark A, mark B, stop)',
    profiles: 'Who is watching (profiles)', whatsNew: 'What\u2019s new', restart: 'Start the video again', collect: 'Add this channel to a collection',
    collections: 'Open collections', stremio: 'Open Stremio and Grayjay'
};

const toastUnknown = () => showToast('Remote buttons', 'That button has no action');

export { start, ACTIONS, ACTION_NAMES, KEYS, toastUnknown };
