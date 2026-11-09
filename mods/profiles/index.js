import {
    buttonItem, configDefaults, configRead, configSnapshot, configWrite, overlayPanelItemListRenderer, showModal, showToast
} from '../../framework/index.js';

// Playback profiles: Cinema, Learning, Music and Sports, each a set of playback settings in one press.
// User profiles: each person their own settings, bookmarks, themes and filters, kept on this TV; Guest
// starts from how the app came and keeps nothing.

/** @type {Array<[string, string, Record<string, any> | null]>} */
const PLAYBACK_PROFILES = [
    ['Cinema', 'Best quality, the picture filled, intros and credits skipped', {
        defaultPlaybackSpeed: 1, preferredVideoQuality: 'highest', videoFit: 'fill', autoSkipIntros: true, enableSmartResume: true
    }],
    ['Learning', '1.5x, 1080p, filler and intros skipped, where you stopped remembered', {
        defaultPlaybackSpeed: 1.5, preferredVideoQuality: '1080', videoFit: 'original', autoSkipIntros: true,
        enableSponsorBlockFiller: true, enableSmartResume: true
    }],
    ['Music', 'Normal speed, 720p to spare the network, the talking in music videos skipped', {
        defaultPlaybackSpeed: 1, preferredVideoQuality: '720', videoFit: 'original', autoSkipIntros: false,
        enableSponsorBlockMusicOfftopic: true, enableSmartResume: false
    }],
    ['Sports', 'Best quality and nothing skipped, so no moment of the match is lost', {
        defaultPlaybackSpeed: 1, preferredVideoQuality: 'highest', videoFit: 'original', autoSkipIntros: false, enableSmartResume: false
    }],
    ['Standard', 'How the app came', null]
];

const PLAYBACK_KEYS = ['defaultPlaybackSpeed', 'preferredVideoQuality', 'videoFit', 'autoSkipIntros', 'enableSmartResume',
    'enableSponsorBlockFiller', 'enableSponsorBlockMusicOfftopic'];

// For the settings: each profile as the writes it makes.
const playbackChoices = () => {
    const defaults = configDefaults();
    return PLAYBACK_PROFILES.map(([label, , values]) => ({
        label,
        writes: [{ key: 'playbackProfile', value: label }]
            .concat(PLAYBACK_KEYS.map((key) => ({ key, value: values && key in values ? values[key] : defaults[key] })))
    }));
};

// --- user profiles

const STORE = 'tube.profiles';
const GUEST = 'Guest';
const NAMES = ['Main', 'Person 2', 'Person 3', 'Person 4', GUEST];

// Kept for the TV, not for a person.
const DEVICE_KEYS = ['enablePhoneSync', 'phoneSyncSeconds', 'welcomeHidden', 'noticeSeen', 'channelIds', 'recentChannels',
    'adsBlockedCount', 'adRequestsBlocked', 'sponsorBlockServer', 'userProfile'];

const readStore = () => {
    try {
        return JSON.parse(window.localStorage.getItem(STORE) || '{}') || {};
    } catch (error) {
        return {};
    }
};

const writeStore = (store) => {
    try {
        window.localStorage.setItem(STORE, JSON.stringify(store));
    } catch (error) {
        // Full or unavailable: the switch still happens, the old one is not kept.
    }
};

const currentProfile = () => configRead('userProfile') || 'Main';

const personal = (snapshot) => Object.keys(snapshot)
    .filter((key) => DEVICE_KEYS.indexOf(key) === -1)
    .reduce((all, key) => Object.assign(all, { [key]: snapshot[key] }), {});

// Keeps the person now using the app, and loads the next one's settings (the page then loads again,
// so every part of the app reads them afresh).
const switchProfile = (name, reload) => {
    if (NAMES.indexOf(name) === -1 || name === currentProfile()) return false;

    const store = readStore();
    const leaving = currentProfile();
    if (leaving !== GUEST) store[leaving] = personal(configSnapshot());

    const defaults = configDefaults();
    const next = name === GUEST
        ? Object.assign(personal(defaults), { enableSmartResume: false })
        : store[name] || personal(defaults);

    writeStore(store);
    Object.keys(next).forEach((key) => configWrite(key, next[key]));
    configWrite('userProfile', name);
    showToast('Profiles', name === GUEST ? 'Guest mode: nothing you do now is kept' : `Now ${name}`);

    if (reload !== false) setTimeout(() => window.location.reload(), 900);
    return true;
};

const BACK = { signalAction: { signal: 'POPUP_BACK' } };

const openProfiles = () => {
    const now = currentProfile();
    const store = readStore();
    const items = NAMES.map((name) => buttonItem({
        title: `${name}${name === now ? '  (now)' : ''}`,
        subtitle: name === GUEST ? 'Starts as the app came; keeps nothing' : (store[name] || name === now ? 'Own settings, bookmarks, themes and filters' : 'New')
    }, null, [BACK, { customAction: { action: 'SWITCH_PROFILE', parameters: name } }]));

    showModal('Who is watching?', overlayPanelItemListRenderer(items, Math.max(0, NAMES.indexOf(now))), 'tube-profiles');
};

export { PLAYBACK_PROFILES, playbackChoices, switchProfile, openProfiles, currentProfile, personal, NAMES, GUEST, DEVICE_KEYS };
