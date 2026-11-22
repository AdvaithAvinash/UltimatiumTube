import { after, configChangeEmitter, configDefaults, configRead, reloadPage } from '../../framework/index.js';

// Interface modes: the whole app in one press.
//
//  - UltimatiumTube: everything this app adds, as you set it up.
//  - SmartTube style: the look and the habits of SmartTube (the Android TV app), over YouTube's own TV
//    screens: dark grey with red, segments skipped with a note, DeArrow titles, dislikes, the player's
//    extra buttons, no nags or overlays, a speed remembered per channel.
//  - YouTube as it comes ("dummy"): YouTube's own TV app untouched, the way the youtube-dummy loader
//    shows it: no theme, no extra buttons, menus, panels or tricks. Only adverts and sponsor segments
//    go, quietly.
//
// Leaving UltimatiumTube mode keeps your own setup of everything a mode changes, and coming back puts
// it back exactly.

const ULTIMATIUMTUBE = 'ultimatiumtube';
const SMARTTUBE = 'smarttube';
const STOCK = 'stock';

/** @type {Array<[string, string, string]>} */
const MODES = [
    [ULTIMATIUMTUBE, 'UltimatiumTube', 'Everything UltimatiumTube adds, as you set it up'],
    [SMARTTUBE, 'SmartTube style', 'SmartTube’s look and habits over YouTube’s screens: dark grey and red, segments skipped '
        + 'with a note, DeArrow, dislikes, extra player buttons, no nags'],
    [STOCK, 'YouTube as it comes (dummy)', 'YouTube’s own TV app untouched, like youtube-dummy: only adverts and sponsor '
        + 'segments go, quietly']
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

// SmartTube's look over YouTube's own screens: a dark grey app with red where the focus is. YouTube's
// class names are scrambled with each release, so these hold on to what stays: its element names and
// zylon-focus, the class every element on the focus path carries (the focused button turns light grey
// in YouTube's own style, rgb(241, 241, 241)).
const SMARTTUBE_RED = '#e53935';
const FOCUSED = ['ytlr-button.zylon-focus', 'yt-button-container.zylon-focus'];
const inside = (what) => FOCUSED.map((focused) => `${focused} ${what}`).join(', ');
const smartTubeCss = () => [
    // YouTube's own black is marked important on body; html body outranks it.
    'html body, html body ytlr-app { background-color: #121212 !important; }',
    `${FOCUSED.join(', ')} { background-color: ${SMARTTUBE_RED} !important; color: #ffffff !important; }`,
    `${inside('yt-formatted-string')}, ${inside('yt-icon')} { color: #ffffff !important; }`,
    `ytlr-tile-renderer.zylon-focus ytlr-thumbnail-details { box-shadow: 0 0 0 5px ${SMARTTUBE_RED}, 0 0 26px rgba(229, 57, 53, 0.65) !important; }`,
    `ytlr-guide-entry-renderer.zylon-focus yt-icon, ytlr-guide-entry-renderer.zylon-focus yt-formatted-string { color: ${SMARTTUBE_RED} !important; }`,
    `ytlr-search-bar ytlr-text-box.zylon-focus { box-shadow: 0 0 0 3px ${SMARTTUBE_RED} !important; }`,
    `.ytLrProgressBarPlayed, .ytLrProgressBarPlayhead { background-color: ${SMARTTUBE_RED} !important; }`
].join('\n');

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
    smartTubeCss, start
};
