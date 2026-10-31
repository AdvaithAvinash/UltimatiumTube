import { DEV_TOOLS } from './flags.js';

const CONFIG_KEY = 'tube.settings';

// Out of the box the TV looks and behaves like the stock YouTube app; only ads and sponsor
// segments go. Everything else is opt-in under Settings > UltimatiumTube.
const defaultConfig = {
  enableAdBlock: true,

  enableSponsorBlock: true,
  enableSponsorBlockToasts: false,
  enableSponsorBlockSponsor: true,
  enableSponsorBlockIntro: true,
  enableSponsorBlockOutro: true,
  enableSponsorBlockInteraction: true,
  enableSponsorBlockSelfPromo: true,
  enableSponsorBlockPreview: true,
  enableSponsorBlockMusicOfftopic: true,
  enableSponsorBlockExclusiveAccess: false,
  enableSponsorBlockFiller: false,
  enableSponsorBlockHighlight: true,
  sponsorBlockManualSkips: ['intro', 'outro', 'filler'],
  // Seconds; a segment shorter than this is left alone.
  sponsorBlockMinDuration: 0,
  // Categories that go quiet for the length of the segment instead of being jumped over.
  sponsorBlockMuteSegments: [],
  // Channel names SponsorBlock stays out of, so a creator's own sponsor reads still play.
  sponsorBlockExemptChannels: [],
  sponsorBlockSkipCount: 0,
  sponsorBlockSavedSeconds: 0,

  enableDeArrow: false,
  enableDeArrowThumbnails: false,

  enableReturnDislike: true,

  preferredVideoQuality: 'highest',
  videoPreferredCodec: 'any',
  enableDevBridge: DEV_TOOLS,
  videoSpeed: 1,
  // The speed every video starts at, up to 15x; a remembered or per-channel speed wins over it.
  defaultPlaybackSpeed: 1,
  rememberPlaybackSpeed: false,
  rememberChannelSpeed: false,
  // Channel name -> the speed it was last watched at.
  channelSpeeds: {},
  speedSettingsIncrement: 0.25,

  // Channel names and words dropped from every shelf; managed from the phone page.
  blockedChannels: [],
  blockedKeywords: [],
  // The last channels played, newest first, so the settings can offer them as a pick list.
  recentChannels: [],

  // AniUltimatium, bundled in this app: the switch only decides whether it is offered.
  enableAniUltimatium: false,
  // The id Aniultimatium's own Samsung app installs under; started first when it is there.
  aniUltimatiumAppId: 'oXabc12345.EnglishAnime',

  // Customization: the look of YouTube's own screens. The defaults change nothing.
  themeWallpaperOn: false,
  themeWallpaper: 'flames',
  themeWallpaperUrl: '',
  // Percent. A picture behind white text needs some of this to stay readable.
  themeDim: 40,
  themeBackground: 'default',
  themeAccent: 'blue',
  themeFont: 'default',

  // Ultimate Dev Options.
  enablePhoneSync: true,
  phoneSyncSeconds: 4,
  // An address (https://...) that answers like sponsor.ajay.app; empty uses the official one.
  sponsorBlockServer: '',
  // Rules added to the page last, so they win. Typed on the phone page.
  customCss: '',

  // Back at the start of the app asks before leaving.
  confirmExit: true,

  enableShorts: true,
  disabledSidebarContents: [],

  enableHqThumbnails: true,

  hideShoppingAction: false,
  enableHideEndScreenCards: false,
  enablePaidPromotionOverlay: true,
  enableUpNextCard: true,
  enableYouThereRenderer: true,
  enableSigninReminder: true,
  enableWhoIsWatchingMenu: true,
  permanentlyEnableWhoIsWatchingMenu: false,
  enableWhosWatchingMenuOnAppExit: false,

  enableHideWatchedVideos: false,
  hideWatchedVideosThreshold: 80,
  hideWatchedVideosPages: [],

  enablePreviousNextButtons: false,
  enableMPButton: false,
  enableSuperThanksButton: true,
  enableAIAskButton: true,

  enableShowUserLanguage: true,
  enableShowOtherLanguages: false,

  // The browseId the app opens on, empty for YouTube's own choice.
  startupPage: '',

  // A rung such as '2', empty for YouTube's own pacing.
  scrollSpeed: '',
  enableRapidPress: true,
  enableSmoothNavigation: false,
};

function readStoredSettings() {
  try {
    const parsed = JSON.parse(window.localStorage[CONFIG_KEY]);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('Stored settings were unreadable; starting from defaults.', e);
    return {};
  }
}

const localConfig = Object.assign({}, defaultConfig, readStoredSettings());

export function configRead(key) {
  return localConfig[key] !== undefined ? localConfig[key] : defaultConfig[key];
}

export function configWrite(key, value) {
  localConfig[key] = value;

  const changed = {};
  Object.keys(defaultConfig).forEach((name) => {
    if (localConfig[name] !== defaultConfig[name]) changed[name] = localConfig[name];
  });

  try {
    window.localStorage[CONFIG_KEY] = JSON.stringify(changed);
  } catch (e) {
    console.warn('Could not persist settings.', e);
  }

  configChangeEmitter.dispatchEvent(new CustomEvent('configChange', { detail: { key, value } }));
}

export function configHas(key) {
  return Object.prototype.hasOwnProperty.call(defaultConfig, key);
}

// A value is accepted only in the shape its default has, so the phone page cannot store nonsense.
export function configAccepts(key, value) {
  if (!configHas(key)) return false;

  const shape = defaultConfig[key];
  if (Array.isArray(shape)) return Array.isArray(value);
  if (shape !== null && typeof shape === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);

  return typeof value === typeof shape;
}

export function configDefaults() {
  return Object.assign({}, defaultConfig);
}

export function configSnapshot() {
  const all = {};
  Object.keys(defaultConfig).forEach((key) => {
    all[key] = configRead(key);
  });

  return all;
}

export const configChangeEmitter = {
  listeners: {},
  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  },
  removeEventListener(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  },
  dispatchEvent(event) {
    const type = event.type;
    if (!this.listeners[type]) return;
    this.listeners[type].forEach(cb => {
      try {
        cb.call(this, event);
      } catch (_) { }
    });
  }
};
