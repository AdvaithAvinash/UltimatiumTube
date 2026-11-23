import { GRID, PIVOT, SHELF, TILES, onTile } from '../../framework/index.js';

// Shorts in the Shorts player, as in YouTube's own TV app. YouTube decides how a Short opens from the
// device that first loaded its TV page: for Samsung's YouTube engine each Short carries a
// reelWatchEndpoint (the vertical Shorts player, Up and Down between Shorts); for a TV's web browser,
// which is how this app loads it, the same Short carries a plain watchEndpoint and plays as an
// ordinary video. The browser's page has the Shorts player all the same, so each Short is given the
// command the YouTube engine gets, with a sequence of Shorts to follow it.

const SHORTS_LOCKUP = 'LOCKUP_CONTENT_TYPE_SHORT';
const SHORTS_TILE = 'TVHTML5_TILE_RENDERER_TYPE_SHORTS';

// The sequence the Shorts player asks YouTube for, which starts at this Short: field 1 of the
// sequence parameters, the video's id, as YouTube's own Shorts links carry it.
const sequenceFor = (videoId) => {
    const bytes = [0x0a, videoId.length].concat(videoId.split('').map((letter) => letter.charCodeAt(0) & 0xff));
    try {
        return encodeURIComponent(btoa(String.fromCharCode.apply(null, bytes)));
    } catch (error) {
        return undefined;
    }
};

const reelFor = (watch) => Object.assign({
    videoId: watch.videoId,
    sequenceProvider: 'REEL_WATCH_SEQUENCE_PROVIDER_RPC',
    overlay: {
        reelPlayerOverlayRenderer: {
            style: 'REEL_PLAYER_OVERLAY_STYLE_SHORTS',
            reelPlayerNavigationModel: 'REEL_PLAYER_NAVIGATION_MODEL_UNSPECIFIED'
        }
    },
    videoType: 'REEL_VIDEO_TYPE_VIDEO'
}, watch.playerParams ? { playerParams: watch.playerParams } : {},
sequenceFor(watch.videoId) ? { sequenceParams: sequenceFor(watch.videoId) } : {},
watch.watchEndpointSupportedOnesieConfig ? { watchEndpointSupportedOnesieConfig: watch.watchEndpointSupportedOnesieConfig } : {});

// The command a Short opens with, wherever YouTube keeps it for each kind of card.
const commandOf = (item) => {
    const lockup = item.lockupViewModel;
    if (lockup && lockup.contentType === SHORTS_LOCKUP) {
        const context = lockup.rendererContext && lockup.rendererContext.commandContext;
        return context && context.onTap && context.onTap.innertubeCommand;
    }
    const tile = item.tileRenderer;
    if (tile && (tile.tvhtml5ShelfRendererType === SHORTS_TILE || tile.contentType === 'TILE_CONTENT_TYPE_SHORTS')) return tile.onSelectCommand;
    return null;
};

const toShortsPlayer = (item) => {
    const command = item && commandOf(item);
    if (!command || command.reelWatchEndpoint || !command.watchEndpoint || !command.watchEndpoint.videoId) return;

    command.reelWatchEndpoint = reelFor(command.watchEndpoint);
    delete command.watchEndpoint;
};

onTile('shorts in the shorts player', [SHELF, PIVOT, TILES, GRID], toShortsPlayer);

export { toShortsPlayer, reelFor, sequenceFor };
