import { after, configChangeEmitter, configDefaults, configRead, reloadPage } from '../../framework/index.js';

// Interface modes: the whole app in one press.
//
//  - UltimatiumTube: the TV app YouTube serves Samsung's own YouTube app (Shorts in the Shorts player,
//    one after another; search as in the app), asked for by the app's service, with everything
//    UltimatiumTube adds, as you set it up.
//  - SmartTube UI: UltimatiumTube's own home screen in SmartTube's manner over that same app, with
//    SmartTube's habits: segments skipped with a note, DeArrow titles, dislikes, the player's extra
//    buttons, no nags, a speed remembered per channel.
//  - YT Dummy: YouTube's TV page as a TV's web browser gets it, loaded as youtube-dummy loads it,
//    untouched: no theme, no extra buttons, menus or panels. Only adverts and sponsor segments go.
//
// Leaving UltimatiumTube mode keeps your own setup of everything a mode changes, and coming back puts
// it back exactly.

const ULTIMATIUMTUBE = 'ultimatiumtube';
const SMARTTUBE = 'smarttube';
const STOCK = 'stock';

/** @type {Array<[string, string, string]>} */
const MODES = [
    [ULTIMATIUMTUBE, 'UltimatiumTube', 'The YouTube app as Samsung\u2019s own YouTube app gets it (Shorts and search as in the app), '
        + 'with everything UltimatiumTube adds'],
    [SMARTTUBE, 'SmartTube UI', 'UltimatiumTube\u2019s own home screen in SmartTube\u2019s manner: a side menu, rows of your videos, '
        + 'its own quick search; segments skipped with a note, DeArrow, dislikes, no nags'],
    [STOCK, 'YT Dummy', 'YouTube as youtube-dummy loads it, untouched: only adverts and sponsor segments go']
];

/** @type {Record<string, Record<string, any>>} */
const PRESETS = {
    [SMARTTUBE]: {
        themeWallpaperOn: false, themeShuffle: 'off', themeBackground: 'graphite', themeAccent: 'red', themeFont: 'default',
        enableSponsorBlock: true, enableSponsorBlockToasts: true, sponsorBlockManualSkips: [],
        enableChapterSkips: true, autoSkipIntros: false,
        enableDeArrow: true, enableDeArrowThumbnails: false, enableReturnDislike: true, enableHqThumbnails: true,
        rememberPlaybackSpeed: false, rememberChannelSpeed: true, enableSmartResume: true,
        enablePreviousNextButtons: true, enableMPButton: true,
        enableHideEndScreenCards: true, enableYouThereRenderer: false, enablePaidPromotionOverlay: false,
        enableSigninReminder: false, hideShoppingAction: true, enableSuperThanksButton: false, enableAIAskButton: false,
        enableSmartSearch: true, confirmExit: true, videoFit: 'original'
    },
    [STOCK]: {
        themeWallpaperOn: false, themeShuffle: 'off', themeBackground: 'default', themeAccent: 'blue', themeFont: 'default',
        enableSponsorBlock: true, enableSponsorBlockToasts: false, sponsorBlockManualSkips: [],
        enableChapterSkips: false, autoSkipIntros: false,
        enableDeArrow: false, enableDeArrowThumbnails: false, enableReturnDislike: false, enableHqThumbnails: false,
        rememberPlaybackSpeed: false, rememberChannelSpeed: false, enableSmartResume: false, defaultPlaybackSpeed: 1,
        enablePreviousNextButtons: false, enableMPButton: false,
        enableHideEndScreenCards: false, enableYouThereRenderer: true, enablePaidPromotionOverlay: true,
        enableSigninReminder: true, hideShoppingAction: false, enableSuperThanksButton: true, enableAIAskButton: true,
        enableSmartSearch: false, confirmExit: false, videoFit: 'original',
        enableHideWatchedVideos: false, hideDuplicates: false, hideClickbait: false,
        startupPage: '', scrollSpeed: '', enableRapidPress: false, enableSmoothNavigation: false,
        enableWhoIsWatchingMenu: true, permanentlyEnableWhoIsWatchingMenu: false, enableWhosWatchingMenuOnAppExit: false,
        keyRed: 'none', keyRedHold: 'none', keyGreen: 'none', keyGreenHold: 'none',
        keyYellow: 'none', keyYellowHold: 'none', keyBlue: 'none', keyBlueHold: 'none',
        disabledSidebarContents: [], enableShorts: true, customCss: ''
    }
};

// Every setting a mode may change: what is kept of your own setup while another mode is on.
const KEYS = Object.keys(PRESETS[SMARTTUBE]).concat(Object.keys(PRESETS[STOCK]))
    .filter((key, at, all) => all.indexOf(key) === at);

const modeOf = (read) => {
    const mode = read('uiMode');
    return mode === SMARTTUBE || mode === STOCK ? mode : ULTIMATIUMTUBE;
};

const uiMode = () => modeOf(configRead);
const isStock = () => uiMode() === STOCK;

const nameOf = (mode) => (MODES.find((entry) => entry[0] === mode) || MODES[0])[1];

const ownSetup = (read) => KEYS.reduce((kept, key) => {
    kept[key] = read(key);
    return kept;
}, {});

// The settings a press on a mode writes, worked out from what is set when the list is opened.
const writesFor = (mode, read, defaults) => {
    const leaving = modeOf(read) === ULTIMATIUMTUBE;

    if (mode === ULTIMATIUMTUBE) {
        const saved = read('uiModeSaved') || {};
        return [{ key: 'uiMode', value: ULTIMATIUMTUBE }]
            .concat(leaving ? [] : KEYS.filter((key) => Object.prototype.hasOwnProperty.call(saved, key))
                .map((key) => ({ key, value: saved[key] })));
    }

    const preset = PRESETS[mode];
    const kept = leaving ? [{ key: 'uiModeSaved', value: ownSetup(read) }] : [];

    return [{ key: 'uiMode', value: mode }].concat(kept, KEYS.map((key) => ({
        key,
        value: Object.prototype.hasOwnProperty.call(preset, key) ? preset[key] : defaults[key]
    })));
};

// For the settings: each mode as the writes it makes.
const modeChoices = () => MODES.map(([mode, label]) => ({ label, writes: writesFor(mode, configRead, configDefaults()) }));

const SMARTTUBE_RED = '#e53935';

// A new mode is loaded afresh: much of what a mode changes is read as YouTube's screens are built.
const RELOAD_AFTER = 700;

const start = () => {
    configChangeEmitter.addEventListener('configChange', (event) => {
        if (event.detail.key !== 'uiMode') return;
        after('interface mode reload', RELOAD_AFTER, reloadPage);
    });
};

export {
    MODES, PRESETS, KEYS, ULTIMATIUMTUBE, SMARTTUBE, STOCK, SMARTTUBE_RED, uiMode, isStock, nameOf, modeChoices, writesFor,
    start
};
