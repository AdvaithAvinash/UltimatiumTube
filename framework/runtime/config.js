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

  enableDeArrow: false,
  enableDeArrowThumbnails: false,

  enableReturnDislike: true,

  preferredVideoQuality: 'highest',
  videoPreferredCodec: 'any',
  enableDevBridge: DEV_TOOLS,
  videoSpeed: 1,
  rememberPlaybackSpeed: false,
  speedSettingsIncrement: 0.25,

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
