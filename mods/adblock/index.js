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

const MOST_DEEP = 12;

// Parts of a feed that hold no items, only text, pictures and tracking: a TV's processor has no time
// to walk them, and an advert is never inside one.
const LEAVES = {
    trackingParams: 1, clickTrackingParams: 1, thumbnail: 1, thumbnails: 1, image: 1, accessibility: 1,
    accessibilityData: 1, commandMetadata: 1, loggingDirectives: 1, text: 1, title: 1, subtitle: 1,
    avatar: 1, banner: 1, thumbnailOverlays: 1, menu: 1, serviceEndpoint: 1
};

const scrubAdverts = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > MOST_DEEP) return 0;

    if (Array.isArray(node)) {
        // Nothing is made unless something is to go, which is nearly always the case.
        const removed = node.some(isAdvert) ? node.length : 0;

        if (removed) {
            const kept = node.filter((item) => !isAdvert(item));
            node.length = 0;
            kept.forEach((item) => node.push(item));
            return removed - kept.length + kept.reduce((sum, item) => sum + scrubAdverts(item, depth + 1), 0);
        }

        return node.reduce((sum, item) => sum + scrubAdverts(item, depth + 1), 0);
    }

    return Object.keys(node).reduce((sum, key) => (LEAVES[key] ? sum : sum + scrubAdverts(node[key], depth + 1)), 0);
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
