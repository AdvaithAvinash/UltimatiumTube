import { GRID, PIVOT, SHELF, TILES, configRead, keepShelf, keepTile, onRequest, onResponse } from '../../framework/index.js';

const blocking = () => configRead('enableAdBlock');

onResponse('adverts', ['adPlacements', 'adSlots', 'playerAds', 'entries'], (r) => {
    if (!blocking()) return;

    if (r.adPlacements) r.adPlacements = [];
    if (r.playerAds) r.playerAds = false;
    if (r.adSlots) r.adSlots = [];

    if (!Array.isArray(r) && r?.entries) {
        r.entries = r.entries.filter((entry) => !entry?.command?.reelWatchEndpoint?.adClientParams?.isAd);
    }
});

// What a feed carries as an advert, wherever it carries it. The feed walk reaches the surfaces it
// knows; a signed-in account is sent others, and an advert in one of them would be drawn.
const isAdvert = (item) => !!item && typeof item === 'object' && !Array.isArray(item)
    && !!(item.adSlotRenderer || item.adPlacementRenderer);

const MOST_DEEP = 16;

const scrubAdverts = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > MOST_DEEP) return 0;

    if (Array.isArray(node)) {
        const kept = node.filter((item) => !isAdvert(item));
        const removed = node.length - kept.length;

        if (removed) {
            node.length = 0;
            kept.forEach((item) => node.push(item));
        }

        return removed + node.reduce((sum, item) => sum + scrubAdverts(item, depth + 1), 0);
    }

    return Object.keys(node).reduce((sum, key) => sum + scrubAdverts(node[key], depth + 1), 0);
};

onResponse('advert sweep', ['contents', 'continuationContents', 'onResponseReceivedCommands',
    'onResponseReceivedActions'], (r) => {
    if (blocking()) scrubAdverts(r, 0);
});

keepShelf('advert sections', [SHELF, PIVOT], (shelf) => !shelf.adSlotRenderer || !blocking());

export { scrubAdverts };

keepTile('advert slots', [SHELF, PIVOT, TILES, GRID],
    (item) => !item.adSlotRenderer || !blocking());

// Claiming no-ad playback suppresses adverts upstream, before any response exists.
onRequest('playback context', ['playbackContext'], (value) => {
    if (!blocking()) return value;

    const context = value.playbackContext && value.playbackContext.contentPlaybackContext;
    if (!context || context.isInlinePlaybackNoAd) return value;

    return Object.assign({}, value, {
        playbackContext: Object.assign({}, value.playbackContext, {
            contentPlaybackContext: Object.assign({}, context, { isInlinePlaybackNoAd: true })
        })
    });
});
