import { GRID, PIVOT, SHELF, TILES, configRead, keepShelf, keepTile, player, whenVideo } from '../../framework/index.js';
import { currentVideo } from '../channels/index.js';

const SHORTS_SHELF = 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS';
const SHORTS_TILE = 'TVHTML5_TILE_RENDERER_TYPE_SHORTS';

// Search results carry shorts as lockupViewModel, not tileRenderer.
const SHORTS_LOCKUP = 'LOCKUP_CONTENT_TYPE_SHORT';

const wanted = () => configRead('enableShorts');

keepTile('shorts tiles', [SHELF, PIVOT, TILES, GRID], (item) => {
    if (wanted()) return true;

    if (item.lockupViewModel?.contentType === SHORTS_LOCKUP) return false;
    if (item.tileRenderer?.tvhtml5ShelfRendererType === SHORTS_TILE) return false;

    return !item.tileRenderer?.onSelectCommand?.reelWatchEndpoint;
});

// A section list holds entries that are not shelves, such as an advert slot with no shelfRenderer.
keepShelf('shorts shelves', [SHELF, PIVOT], (shelf) =>
    wanted() || shelf.shelfRenderer?.tvhtml5ShelfRendererType !== SHORTS_SHELF);

// --- the Shorts player: Shorts of the wrong length, or from a hidden channel or with a hidden word,
// are passed over as they come up. The feed of Shorts does not say how long each is, so it is done
// when one starts playing: the player is moved on to the next, as the Down button does.

const SKIP_EVERY_MS = 400;
const MOST_IN_A_ROW = 8;
const DOWN = 40;

const onShortsPage = (playerElement) => {
    try {
        return Object.values(playerElement.getVideoStats()).some((value) => value === 'shortspage');
    } catch (e) {
        return String(window.location.hash || '').indexOf('shorts') !== -1;
    }
};

const pressDown = () => ['keydown', 'keyup'].forEach((type) => {
    const event = /** @type {any} */ (document.createEvent('Event'));
    event.initEvent(type, true, true);
    event.keyCode = DOWN;
    event.which = DOWN;
    document.dispatchEvent(event);
});

const lowered = (list) => (list || []).map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);

// Why this Short is passed over, or null to let it play.
const reasonToPass = (seconds, channel, title, read) => {
    const longest = Number(read('shortsMaxSeconds')) || 0;
    const shortest = Number(read('shortsMinSeconds')) || 0;
    if (seconds > 0 && longest && seconds > longest + 0.5) return `longer than ${longest} s`;
    if (seconds > 0 && shortest && seconds < shortest) return `shorter than ${shortest} s`;

    const name = String(channel || '').trim().toLowerCase();
    const text0 = String(title || '').toLowerCase();
    const own = String(read('shortsBlockedWords') || '').split(/\n+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (own.some((w) => text0.indexOf(w) !== -1)) return 'a word you hid for Shorts';
    if (read('shortsOnlyCollections') && name) {
        const kept = Object.keys(read('channelCollections') || {})
            .reduce((all, key) => all.concat(lowered((read('channelCollections') || {})[key])), []);
        if (kept.indexOf(name) === -1) return 'not in your collections';
    }

    if (!read('shortsUseHiddenLists')) return null;
    if (name && lowered(read('blockedChannels')).indexOf(name) !== -1) return 'a hidden channel';
    const text = String(title || '').toLowerCase();
    const word = lowered(read('blockedKeywords')).find((w) => text.indexOf(w) !== -1);
    return word ? 'a hidden word' : null;
};

const passing = { last: null, inARow: 0, at: 0 };

const judgeShort = (videoElement, playerElement, now) => {
    if (!now.videoId || passing.last === now.videoId) return;
    if (!playerElement || !onShortsPage(playerElement)) {
        passing.inARow = 0;
        return;
    }

    passing.last = now.videoId;
    const why = reasonToPass(videoElement.duration, now.channel, now.title, configRead);
    if (!why) {
        passing.inARow = 0;
        return;
    }

    // A feed of nothing but passed Shorts would otherwise be scrolled through for ever.
    if (passing.inARow >= MOST_IN_A_ROW || Date.now() - passing.at < SKIP_EVERY_MS) return;
    passing.inARow += 1;
    passing.at = Date.now();
    pressDown();
};

const watchShorts = (videoElement) => {
    const look = () => judgeShort(videoElement, player(), currentVideo());
    videoElement.addEventListener('loadedmetadata', look);
    videoElement.addEventListener('playing', look);
};

const startShortsFilter = () => whenVideo('shorts filter', watchShorts);

export { reasonToPass, startShortsFilter };
