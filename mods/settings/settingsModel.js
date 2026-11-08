import { VERSION, COMMIT, configDefaults, configRead } from '../../framework/index.js';
import { SPEEDS } from '../scroller/index.js';
import { phoneAddress } from '../phone/index.js';
import { savedTimeSummary } from '../sponsorblock/index.js';
import { adSummary } from '../adblock/index.js';
import { ACTION_NAMES } from '../remoteKeys/index.js';
import { bookmarks } from '../bookmarks/index.js';
import { ACCENTS, BACKGROUNDS, FONTS, WALLPAPERS, WALLPAPER_COLLECTIONS } from '../theme/index.js';

const ART = 'https://www.gstatic.com/ytlr/img/';

const BLOCKING = ART + 'restricted_mode.png';
const MONEY = ART + 'purchases_and_memberships.png';
const SKIPPING = ART + 'autoplay.png';
const WATCHED = ART + 'clear_watch_history.png';
const LOOKING = ART + 'clear_search_history.png';
const SCREEN = ART + 'living_room_pre_app_user_setting.png';
const CONTROLS = ART + 'linked_devices.png';
const SPEECH = ART + 'language.png';
const PRIVACY = ART + 'privacy_and_terms.png';
const RESTART = ART + 'reset_app.png';
const MESSAGE = ART + 'send_feedback.png';

const Switch = (key, title, summary, image, on = true, note) =>
  ({ kind: 'switch', key, title, summary, image, on, note });

const Choice = (key, title, summary, image, options, prefix, note) =>
  ({ kind: 'choice', key, title, summary, image, options, prefix: prefix || title, note });

// Options may be a function, for lists that only exist once something has been watched.
const Set_ = (key, title, summary, image, options, invert = false, phone) => {
  const item = { kind: 'set', key, title, summary, image, invert, phone };
  Object.defineProperty(item, 'options', {
    enumerable: true,
    get: () => (typeof options === 'function' ? options() : options)
  });

  return item;
};

// A row that shows a value and offers actions: each action writes some settings, or none. The
// actions may be a function, for ones that depend on what is set when the row is opened.
const Panel = (key, title, summary, image, value, actions, phone) => {
  const item = { kind: 'panel', key, title, summary, image, value, phone };
  Object.defineProperty(item, 'options', {
    enumerable: true,
    get: () => (typeof actions === 'function' ? actions() : actions)
  });

  return item;
};

// A row that does something when pressed, rather than opening a list.
const Action = (key, title, summary, image, action) =>
  ({ kind: 'action', key, title, summary, image, action });

const Flags = (id, title, summary, image, options) =>
  ({ kind: 'flags', id, title, summary, image, options });

const preview = (text) => {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  if (!line) return 'Not set';

  return line.length > 40 ? `${line.slice(0, 37)}...` : line;
};

// A setting that is text. It is typed on the phone page; the TV shows it and can clear it.
const Text = (key, title, summary, image, multiline = false) => Panel(key, title, summary, image,
  () => preview(configRead(key)), [{ label: 'Clear it', writes: [{ key, value: '' }] }],
  multiline ? 'textarea' : 'text');

const QUALITIES = ['highest', 'auto', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p']
  .map((quality) => ({
    label: quality === 'highest' ? 'Highest available'
      : quality === 'auto' ? 'Automatic'
        : quality,
    value: quality
  }));

const CODECS = [
  { label: 'Any', value: 'any' },
  { label: 'VP9', value: 'vp9' },
  { label: 'AV1', value: 'av01' },
  { label: 'H.264', value: 'avc1' }
];

const INCREMENTS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]
  .map((step) => ({ label: `${step}×`, value: step }));

const PERCENTAGES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  .map((percent) => ({ label: `${percent}%`, value: percent }));

const SEGMENTS = [
  { label: 'Sponsors', key: 'enableSponsorBlockSponsor' },
  { label: 'Intros', key: 'enableSponsorBlockIntro' },
  { label: 'Outros', key: 'enableSponsorBlockOutro' },
  { label: 'Subscribe reminders', key: 'enableSponsorBlockInteraction' },
  { label: 'Self-promotion', key: 'enableSponsorBlockSelfPromo' },
  { label: 'Recaps and previews', key: 'enableSponsorBlockPreview' },
  { label: 'Tangents and jokes', key: 'enableSponsorBlockFiller' },
  { label: 'Non-music parts', key: 'enableSponsorBlockMusicOfftopic' },
  { label: 'Exclusive access plugs', key: 'enableSponsorBlockExclusiveAccess' },
  { label: 'Jump to the highlight', key: 'enableSponsorBlockHighlight' }
];

const NOTHING_YET = [{ label: 'Play a video first: the channels you watch will be listed here', value: '' }];

// Offered from what has been played, plus whatever is already ticked so it can be unticked.
const channelOptions = (key) => () => {
  const names = (configRead('recentChannels') || []).concat(configRead(key) || [])
    .filter((name, at, all) => name && all.indexOf(name) === at);

  return names.length ? names.map((name) => ({ label: name, value: name })) : NOTHING_YET;
};

const countOf = (key, noun) => () => {
  const count = (configRead(key) || []).length;
  return count ? `${count} ${noun}${count === 1 ? '' : 's'}` : 'None';
};

const countOfSpeeds = () => {
  const count = Object.keys(configRead('channelSpeeds') || {}).length;
  return count ? `${count} channel${count === 1 ? '' : 's'}` : 'None';
};

const countOfQualities = () => {
  const count = Object.keys(configRead('channelQualities') || {}).length;
  return count ? `${count} channel${count === 1 ? '' : 's'}` : 'None';
};

const REMOTE_ACTIONS = Object.keys(ACTION_NAMES).map((id) => ({ label: ACTION_NAMES[id], value: id }));

const remoteChoices = () => [['Red', 'keyRed'], ['Green', 'keyGreen'], ['Yellow', 'keyYellow'], ['Blue', 'keyBlue']]
  .reduce((/** @type {any[]} */ all, pair) => all.concat([
    Choice(pair[1], `${pair[0]} button`, `What a press of ${pair[0]} does. Some actions only work while a video plays`, CONTROLS, REMOTE_ACTIONS, pair[0]),
    Choice(`${pair[1]}Hold`, `${pair[0]} button, held`, `What holding ${pair[0]} for a moment does`, CONTROLS, REMOTE_ACTIONS, `${pair[0]} held`)
  ]), /** @type {any[]} */ ([]));

const DURATIONS = [0, 1, 2, 3, 5, 10]
  .map((seconds) => ({ label: seconds ? `${seconds} s` : 'Off', value: seconds }));

// The highlight is left out: it's a point, never auto-skipped, and already has its own "Skip to highlight" button.
const SEGMENT_VALUES = SEGMENTS.filter((segment) => segment.key !== 'enableSponsorBlockHighlight').map((segment) => ({
  label: segment.label,
  value: segment.key
    .replace('enableSponsorBlock', '')
    .replace('MusicOfftopic', 'music_offtopic')
    .replace('SelfPromo', 'selfpromo')
    .replace('ExclusiveAccess', 'exclusive_access')
    .toLowerCase()
}));

// Up to 15x, the same top as the player's own speed menu.
const SPEED_CHOICES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  .map((speed) => ({ label: `${speed}x`, value: speed }));

const VIDEO_FITS = [
  { label: 'Original', value: 'original' },
  { label: 'Zoom to fill', value: 'fill' },
  { label: 'Zoom 1.15x', value: 'z115' },
  { label: 'Zoom 1.33x (black bars inside the video)', value: 'z133' },
  { label: 'Zoom 1.5x', value: 'z150' },
  { label: 'Stretch', value: 'stretch' }
];

const SIDEBAR = [
  { label: 'Search', value: 'SEARCH' },
  { label: 'Home', value: 'WHAT_TO_WATCH' },
  { label: 'Shorts', value: 'YOUTUBE_SHORTS_FILL_24' },
  { label: 'Subscriptions', value: 'SUBSCRIPTIONS' },
  { label: 'Library', value: 'TAB_LIBRARY' },
  { label: 'Sports', value: 'TROPHY' },
  { label: 'News', value: 'NEWS' },
  { label: 'Music', value: 'YOUTUBE_MUSIC' },
  { label: 'Podcasts', value: 'BROADCAST' },
  { label: 'Movies & TV', value: 'CLAPPERBOARD' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Gaming', value: 'GAMING' },
  { label: 'More', value: 'TAB_MORE' }
];

const PAGES = [
  { label: 'Home', value: 'home' },
  { label: 'Search results', value: 'search' },
  { label: 'Subscriptions', value: 'subscriptions' },
  { label: 'Library', value: 'library' },
  { label: 'Music', value: 'music' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'More', value: 'more' }
];

const SCROLL_SPEEDS = [{ label: 'Default', value: '' }].concat(Object.keys(SPEEDS)
  .sort((a, b) => Number(a) - Number(b))
  .map((value) => ({ label: `${value}\u00d7`, value })));

const START_PAGES = [
  { label: 'Home', value: '' },
  { label: 'Subscriptions', value: 'FEsubscriptions' },
  { label: 'Library', value: 'FElibrary' },
  { label: 'Sports', value: 'FEtopics_sports' },
  { label: 'News', value: 'FEtopics_news' },
  { label: 'Music', value: 'FEtopics_music' },
  { label: 'Podcasts', value: 'FEtopics_podcasts' },
  { label: 'Movies & TV', value: 'FEtopics_movies' },
  { label: 'Live', value: 'FEtopics_live' },
  { label: 'Gaming', value: 'FEtopics_gaming' },
  { label: 'More', value: 'FEtopics_more' }
];

const GROUPS = [
  {
    id: 'tube_sponsorblock',
    title: 'SponsorBlock',
    items: [
      Switch('enableSponsorBlock', 'SponsorBlock',
        'Skip the parts of a video the community has marked',
        MONEY, true, 'SponsorBlock — github.com/ajayyy/SponsorBlock'),
      Flags('segments', 'SponsorBlock: segments to skip',
        'Skipped as soon as they start, with no prompt', SKIPPING, SEGMENTS),
      // The highlight is left out: it's a point, never auto-skipped, and already has its own "Skip to highlight" button.
      Set_('sponsorBlockManualSkips', 'SponsorBlock: ask before skipping',
        'These segments offer a button instead of skipping on their own', SKIPPING, SEGMENT_VALUES),
      Set_('sponsorBlockMuteSegments', 'SponsorBlock: mute instead of skipping',
        'These segments go quiet for their length and the picture keeps playing', SKIPPING, SEGMENT_VALUES),
      Choice('sponsorBlockMinDuration', 'SponsorBlock: ignore short segments',
        'Segments shorter than this are left alone', SKIPPING, DURATIONS, 'Ignore under'),
      Set_('sponsorBlockExemptChannels', 'SponsorBlock: never on these channels',
        'Skipped and muted nowhere on a ticked channel, so a creator\u2019s own sponsor reads still play',
        SKIPPING, channelOptions('sponsorBlockExemptChannels'), false, 'words'),
      Switch('enableSponsorBlockToasts', 'SponsorBlock: skip notifications',
        'A message over the picture each time a segment is skipped', MESSAGE),
      Panel('sponsorBlockSavedSeconds', 'SponsorBlock: time saved',
        'What skipping has saved you so far', MESSAGE, savedTimeSummary,
        [{
          label: 'Reset the counter',
          writes: [{ key: 'sponsorBlockSavedSeconds', value: 0 }, { key: 'sponsorBlockSkipCount', value: 0 }]
        }])
    ]
  },
  {
    id: 'tube_adblock',
    title: 'Ad blocking',
    items: [
      Switch('enableAdBlock', 'Block ads',
        'Adverts are dropped from every response before the player is told they exist',
        BLOCKING)
    ]
  },
  {
    id: 'tube_dearrow',
    title: 'DeArrow',
    items: [
      Switch('enableDeArrow', 'DeArrow',
        'Replace clickbait titles with ones submitted by the community',
        LOOKING, true, 'DeArrow — github.com/ajayyy/DeArrow'),
      Switch('enableDeArrowThumbnails', 'DeArrow thumbnails',
        'Thumbnails are replaced too, which loads slower over a thin connection', LOOKING)
    ]
  },
  {
    id: 'tube_return_dislike',
    title: 'Return YouTube Dislike',
    items: [
      Switch('enableReturnDislike', 'Return YouTube Dislike',
        'Show the real dislike count on the player’s own dislike button',
        LOOKING, true, 'Return YouTube Dislike — github.com/Anarios/return-youtube-dislike')
    ]
  },
  {
    id: 'tube_startup',
    title: 'Startup',
    items: [
      Switch('confirmExit', 'Ask before leaving',
        'Back at the start of the app asks "Exit UltimatiumTube?" with Stay and Exit, so a press too many does not close it',
        RESTART),
      Choice('startupPage', 'Startup page',
        'Opened at launch, so the home feed is never drawn first',
        RESTART, START_PAGES, 'Startup'),
      Switch('enableWhoIsWatchingMenu', 'Ask who\u2019s watching',
        'YouTube\u2019s account picker, shown before the feed', PRIVACY),
      Switch('permanentlyEnableWhoIsWatchingMenu', 'Ask every time',
        'Asked again even when the app was only in the background', PRIVACY),
      Switch('enableWhosWatchingMenuOnAppExit', 'Ask on the way out',
        'Asked again when the app closes; off puts the home button back', PRIVACY)
    ]
  },
  {
    id: 'tube_channels',
    title: 'Channels and words',
    items: [
      Panel('phoneSettings', 'Settings from your phone',
        () => (phoneAddress() ? `Open ${phoneAddress()} on a phone or computer` : 'Open the address listed under About on a phone or computer'),
        CONTROLS, () => 'On your phone', [{ label: 'Typing words is easier there', writes: [] }]),
      Set_('blockedChannels', 'Hidden channels',
        'Videos from a ticked channel are left out of every shelf', WATCHED,
        channelOptions('blockedChannels'), false, 'words'),
      Panel('blockedKeywords', 'Hidden words',
        'Videos with one of these words in the title are left out. Add them from your phone', WATCHED,
        countOf('blockedKeywords', 'word'),
        [{ label: 'Clear the list', writes: [{ key: 'blockedKeywords', value: [] }] }], 'words'),
      Switch('rememberChannelSpeed', 'Speed for each channel',
        'A speed you pick on a video is used for that channel\u2019s next ones', SKIPPING),
      Panel('channelSpeeds', 'Channel speeds',
        'The channels that have a speed of their own', SKIPPING, countOfSpeeds,
        [{ label: 'Forget them all', writes: [{ key: 'channelSpeeds', value: {} }] }])
    ]
  },
  {
    id: 'tube_feed',
    title: 'Feed',
    items: [
      Switch('enableShorts', 'Shorts',
        'Off removes them from every shelf, including rows that mix them with ordinary videos',
        SCREEN),
      Switch('enableHqThumbnails', 'High-quality thumbnails',
        'Ask for the largest thumbnail rather than the one sized for a phone', LOOKING),
      Switch('enableHideWatchedVideos', 'Hide watched videos',
        'Drop videos you have already finished out of the shelves', WATCHED),
      Choice('hideWatchedVideosThreshold', 'Counts as watched at',
        'How much of a video has to be behind you before it is hidden',
        WATCHED, PERCENTAGES, 'Watched'),
      Set_('hideWatchedVideosPages', 'Hide them on',
        'Left off a page, watched videos still show there', WATCHED, PAGES)
    ]
  },
  {
    id: 'tube_sidebar',
    title: 'Sidebar',
    items: [
      Set_('disabledSidebarContents', 'Sidebar sections',
        'Unchecked entries are dropped from the guide', CONTROLS, SIDEBAR, true)
    ]
  },
  {
    id: 'tube_navigation',
    title: 'Navigation',
    items: [
      Choice('scrollSpeed', 'Scroll speed',
        'How fast the feed moves while a direction is held', CONTROLS,
        SCROLL_SPEEDS),
      Switch('enableRapidPress', 'Rapid press',
        'Presses made faster than the feed can move are kept rather than dropped',
        CONTROLS),
      Switch('enableSmoothNavigation', 'Smoother navigation',
        'Skips work YouTube does while you move; tiles stop sliding one by one', SCREEN)
    ]
  },
  {
    id: 'tube_playback',
    title: 'Playback',
    items: [
      Choice('preferredVideoQuality', 'Preferred quality',
        'The most it will use; YouTube steps down when your connection cannot keep up, '
        + 'and the next best is used when the video lacks it',
        SCREEN, QUALITIES, 'Quality'),
      Choice('videoPreferredCodec', 'Preferred codec',
        'Some sets decode one codec in hardware and the rest in software',
        SCREEN, CODECS, 'Codec'),
      Choice('videoFit', 'Video fit',
        'Zoom to fill crops a video of another shape to cover the screen. When the bars are part of the '
        + 'video itself (most films and old clips uploaded as 16:9), use Zoom 1.33x. Stretch fills the '
        + 'screen without cropping. The Yellow button changes it while a video plays',
        SCREEN, VIDEO_FITS, 'Fit'),
      Choice('defaultPlaybackSpeed', 'Speed',
        'The speed every video starts at, up to 15x. Pick another while one plays, from the speed button',
        SKIPPING, SPEED_CHOICES, 'Speed'),
      Switch('rememberPlaybackSpeed', 'Remember playback speed',
        'The speed you chose carries into the next video, which YouTube otherwise starts '
        + 'at normal', SKIPPING),
      Switch('enableSmartResume', 'Smart resume',
        'A video starts where you stopped it last time (videos over two minutes)', SKIPPING),
      Panel('channelQualities', 'Quality for each channel',
        'Set from the Blue button held while a video plays (or the button you chose for it); wins over Preferred quality',
        SCREEN, countOfQualities, [{ label: 'Forget them all', writes: [{ key: 'channelQualities', value: {} }] }]),
      Choice('speedSettingsIncrement', 'Speed steps',
        'How far one press moves playback speed in the speed control',
        SKIPPING, INCREMENTS, 'Step')
    ]
  },
  {
    id: 'tube_remote',
    title: 'Remote buttons and bookmarks',
    get items() {
      return [
        Action('openBookmarks', 'Bookmarks', 'Moments of videos you kept; open one to go straight back to it',
          SKIPPING, 'OPEN_BOOKMARKS'),
        Panel('videoBookmarks', 'Clear bookmarks', 'Removes every kept moment', SKIPPING,
          () => `${bookmarks().length} kept`, [{ label: 'Remove them all', writes: [{ key: 'videoBookmarks', value: [] }] }])
      ].concat(remoteChoices());
    }
  },
  {
    id: 'tube_subtitles',
    title: 'Subtitles',
    items: [
      Switch('enableShowUserLanguage', 'Your own language',
        'Offer a subtitle track matching the interface language', SPEECH),
      Switch('enableShowOtherLanguages', 'Hidden tracks',
        'Show the tracks YouTube leaves out of the subtitle list', SPEECH)
    ]
  },
  {
    id: 'tube_player',
    title: 'Player controls',
    items: [
      Switch('enablePreviousNextButtons', 'Previous and next',
        'Skip between videos in a playlist from the control row', CONTROLS),
      Switch('enableMPButton', 'Mini player', 'Shrink the video and keep browsing',
        CONTROLS),
      Switch('enableSuperThanksButton', 'Super Thanks',
        'YouTube\u2019s button for paying the uploader', MONEY),
      Switch('enableAIAskButton', 'Ask',
        'YouTube\u2019s button for asking a chatbot about the video', MESSAGE)
    ]
  },
  {
    id: 'tube_interruptions',
    title: 'Overlays and prompts',
    items: [
      Switch('hideShoppingAction', 'Shopping action',
        'The QR-code merchandise card laid over the picture partway through a video',
        MONEY, false),
      Switch('enableHideEndScreenCards', 'End screen cards',
        'The tiles the uploader lays over the last seconds of a video', SCREEN, false),
      Switch('enablePaidPromotionOverlay', 'Paid promotion notice',
        'YouTube\u2019s "Includes paid promotion" badge', MONEY),
      Switch('enableUpNextCard', 'Up next card',
        'Off stops the next video playing too \u2014 the card is the only warning it is coming',
        SKIPPING),
      Switch('enableYouThereRenderer', 'Are you still watching?',
        'The prompt that stops playback after a long run', PRIVACY),
      Switch('enableSigninReminder', 'Sign-in reminder',
        'The prompt shown to a signed-out viewer', PRIVACY)
    ]
  }
];


const WALLPAPER_NAMES = {
  flames: 'Blue flames', ultimatium: 'Ultimatium blue', aurora: 'Aurora glow', sunset: 'Sunset', ocean: 'Ocean', forest: 'Forest',
  ember: 'Ember', violet: 'Violet', steel: 'Steel', midnight: 'Midnight', electric: 'Electric energy',
  cyberpunk: 'Neon city', cyberpurple: 'Purple horizon', nebula: 'Nebula', auroraPeaks: 'Aurora over mountains',
  amoled: 'AMOLED arc', liquid: 'Liquid waves', holo: 'Holographic glass', inferno: 'Inferno', rain: 'Rainy window'
};

const capital = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const named = (table) => Object.keys(table).map((id) => ({ label: capital(id), value: id }));

// Whether there is a wallpaper at all is its own switch, so it can always be turned off.
// Listed by collection ("Cyberpunk: Neon city"), then anything not in a collection.
const inCollection = WALLPAPER_COLLECTIONS.reduce((all, entry) => all.concat(entry[1]), []);
const WALLPAPER_OPTIONS = []
  .concat(WALLPAPER_COLLECTIONS.reduce((all, entry) => all.concat(entry[1]
    .filter((id) => WALLPAPERS[id])
    .map((id) => ({ label: `${entry[0]}: ${WALLPAPER_NAMES[id] || capital(id)}`, value: id }))), []))
  .concat(Object.keys(WALLPAPERS).filter((id) => inCollection.indexOf(id) === -1)
    .map((id) => ({ label: WALLPAPER_NAMES[id] || capital(id), value: id })))
  .concat([{ label: 'Your own picture (address set on the phone)', value: 'custom' }]);

const DIMS = [0, 20, 40, 60, 80].map((percent) => ({ label: percent ? `${percent}%` : 'None', value: percent }));

const SYNC_SECONDS = [2, 4, 10, 30].map((seconds) => ({ label: `${seconds} s`, value: seconds }));

const THEME_KEYS = ['themeWallpaperOn', 'themeWallpaper', 'themeWallpaperUrl', 'themeDim', 'themeBackground', 'themeAccent', 'themeFont', 'themeShuffle'];

const SHUFFLES = [
  { label: 'Off', value: 'off' }, { label: 'Each time the app opens', value: 'open' },
  { label: 'Every 15 minutes', value: '15' }, { label: 'Every hour', value: '60' }
];

// A theme sets the wallpaper and the look of UltimatiumTube together.
const THEMES = [
  ['Ultimatium Blue Flame', { themeWallpaper: 'flames', themeAccent: 'blue', themeBackground: 'black', themeDim: 40 }],
  ['Cyber Purple', { themeWallpaper: 'cyberpurple', themeAccent: 'purple', themeBackground: 'plum', themeDim: 40 }],
  ['AMOLED Black', { themeWallpaper: 'amoled', themeAccent: 'white', themeBackground: 'black', themeDim: 0 }],
  ['Inferno', { themeWallpaper: 'inferno', themeAccent: 'red', themeBackground: 'wine', themeDim: 40 }],
  ['Holographic', { themeWallpaper: 'holo', themeAccent: 'cyan', themeBackground: 'navy', themeDim: 40 }],
  ['Neon City', { themeWallpaper: 'cyberpunk', themeAccent: 'pink', themeBackground: 'plum', themeDim: 40 }],
  ['Deep Space', { themeWallpaper: 'nebula', themeAccent: 'purple', themeBackground: 'navy', themeDim: 20 }]
];

const themeChoices = () => THEMES.map((theme) => ({
  label: theme[0],
  writes: [{ key: 'themeWallpaperOn', value: true }, { key: 'themeShuffle', value: 'off' }]
    .concat(Object.keys(theme[1]).map((key) => ({ key, value: theme[1][key] })))
}));

// Everything back to how it ships, at the moment the list is opened, so a setting added later is included.
const resetEverything = () => {
  const defaults = configDefaults();
  return [{ label: 'Reset every setting to how it came', writes: Object.keys(defaults).map((key) => ({ key, value: defaults[key] })) }];
};

const resetTheme = () => {
  const defaults = configDefaults();
  return [{ label: 'Back to the stock look', writes: THEME_KEYS.map((key) => ({ key, value: defaults[key] })) }];
};

const stremioGroup = () => {
  const group = /** @type {any} */ ({
    id: 'tube_stremio',
    ultimate: true,
    title: 'Stremio and Grayjay',
    summary: 'Movies, series and videos from Stremio addons and Grayjay plugins'
  });

  Object.defineProperty(group, 'items', {
    enumerable: true,
    get: () => {
      const items = /** @type {any[]} */ ([
        Switch('enableStremio', 'Stremio and Grayjay',
          'Offers movies, series and videos from Stremio addons and Grayjay plugins: catalogs, search, a library and a player', SKIPPING)
      ]);

      if (configRead('enableStremio')) {
        items.push(Action('openStremio', 'Open Stremio and Grayjay', 'Back returns to YouTube', SKIPPING, 'OPEN_STREMIO'));
        items.push(Text('stremioAddons', 'Addons',
          'The addresses of the addons to use, one to a line (stremio:// or https://). Cinemeta, which gives the catalogs, is added by the page. Streams need an addon that gives direct links. Typed on the phone', SKIPPING, true));
        items.push(Text('grayjayPlugins', 'Grayjay plugins',
          'The addresses of the plugins to use (the .json configuration, or a grayjay:// link), one to a line. A plugin is a program that runs in the page, so add only ones you trust, such as those on plugins.grayjay.app. Typed on the phone', SKIPPING, true));
      }

      return items;
    }
  });

  return group;
};

// The sections behind "UltimatiumTube Ultimate Settings". They are groups like the others,
// but are reached through that row, not listed with the rest.
const ULTIMATE = [
  {
    id: 'tube_customization',
    ultimate: true,
    title: 'Customization',
    summary: 'Wallpaper, colours and font',
    items: [
      Switch('themeWallpaperOn', 'Wallpaper',
        'A picture behind YouTube\u2019s home screens. Off puts YouTube\u2019s own background back', SCREEN),
      Panel('themePreset', 'Themes', 'A wallpaper and the colours of UltimatiumTube together', SCREEN,
        () => 'Pick one', themeChoices),
      Action('wallpaperOffNow', 'Turn the wallpaper off now',
        'Switches it off and loads the page again, so it is certain. Use this if it will not go', SCREEN, 'WALLPAPER_OFF'),
      Choice('themeWallpaper', 'Wallpaper picture', 'Which picture, when Wallpaper is on', SCREEN, WALLPAPER_OPTIONS, 'Picture'),
      Text('themeWallpaperUrl', 'Your own wallpaper', 'The web address of a picture, used when the picture is "Your own picture". Typed on the phone', SCREEN),
      Choice('themeShuffle', 'Shuffle wallpapers', 'A different built-in picture now and then; your choice above stays', SCREEN, SHUFFLES, 'Shuffle'),
      Choice('themeDim', 'Wallpaper dimming', 'Darkens the wallpaper so text stays readable', SCREEN, DIMS, 'Dimming'),
      Choice('themeBackground', 'Background colour', 'Behind everything when there is no wallpaper', SCREEN,
        [{ label: 'YouTube\u2019s own', value: 'default' }].concat(named(BACKGROUNDS)), 'Background'),
      Choice('themeAccent', 'Accent colour', 'The colour of the UltimatiumTube rows', SCREEN, named(ACCENTS), 'Accent'),
      Choice('themeFont', 'Font', 'As far as the TV has the font',
        SCREEN, [{ label: 'YouTube\u2019s own', value: 'default' }].concat(named(FONTS)), 'Font'),
      Panel('themeReset', 'Reset the look', 'Wallpaper, colours and font', SCREEN, () => 'Customization', resetTheme)
    ]
  },
  {
    id: 'tube_dev',
    ultimate: true,
    title: 'Ultimate Dev Options',
    summary: 'Advanced settings',
    items: [
      Panel('tubeStatistics', 'Ultimate statistics', 'Adverts removed, SponsorBlock segments skipped and the time saved', MONEY,
        () => `${adSummary()}; SponsorBlock: ${savedTimeSummary()}`,
        [{ label: 'Start counting again', writes: [{ key: 'adsBlockedCount', value: 0 }, { key: 'adRequestsBlocked', value: 0 },
          { key: 'sponsorBlockSavedSeconds', value: 0 }, { key: 'sponsorBlockSkipCount', value: 0 }] }]),
      Switch('enablePhoneSync', 'Phone settings page',
        'Lets the page on your phone read and change these settings. Off also stops the page working', CONTROLS),
      Choice('phoneSyncSeconds', 'Phone page refresh', 'How often the TV asks whether the phone changed something',
        CONTROLS, SYNC_SECONDS, 'Every'),
      Text('sponsorBlockServer', 'SponsorBlock server',
        'An address (https://...) of a server that answers like sponsor.ajay.app. Empty uses the official one. Typed on the phone', MONEY),
      Text('customCss', 'Custom style rules',
        'CSS added to YouTube\u2019s page, after everything else. Typed on the phone', SCREEN, true),
      Panel('tubeVersion', 'Version', 'What this build is', MESSAGE, () => `${VERSION} (${COMMIT})`,
        [{ label: 'Close', writes: [] }]),
      Panel('tubeReset', 'Reset everything', 'Puts every UltimatiumTube setting back to how it came',
        RESTART, () => 'All settings', resetEverything)
    ]
  },
  stremioGroup()
];

ULTIMATE.forEach((group) => GROUPS.push(group));

// The first step of the way in: a list of the three sections.
const ULTIMATE_MENU = {
  title: 'UltimatiumTube Ultimate Settings',
  summary: 'Customization, developer options, Stremio and Grayjay',
  image: SCREEN
};

const ultimateGroups = () => GROUPS.map((group, index) => ({ group, index })).filter((entry) => entry.group.ultimate);

function at(path) {
  if (path[0] === 'ultimate') return ULTIMATE_MENU;

  const group = GROUPS[path[0]];
  if (!group) return null;
  return path.length > 1 ? group.items[path[1]] : group;
}

function isChosen(item, value) {
  const stored = configRead(item.key) || [];
  const listed = stored.indexOf(value) !== -1;
  return item.invert ? !listed : listed;
}

function chosenLabel(item) {
  const current = configRead(item.key);
  const match = item.options.find((option) => option.value === current);
  return match ? match.label : item.options[0].label;
}

function listOf(labels, total) {
  if (labels.length === 0) return 'None';
  if (labels.length === total) return 'All';
  if (labels.length <= 2) return labels.join(' and ');
  return `${labels.slice(0, 2).join(', ')} and ${labels.length - 2} more`;
}

function chosenSummary(item) {
  if (item.kind === 'flags') {
    const chosen = item.options.filter((option) => configRead(option.key));
    return listOf(chosen.map((option) => option.label), item.options.length);
  }

  const chosen = item.options.filter((option) => isChosen(item, option.value));
  return listOf(chosen.map((option) => option.label), item.options.length);
}

export { GROUPS, ULTIMATE_MENU, at, isChosen, chosenLabel, chosenSummary, ultimateGroups, preview };
