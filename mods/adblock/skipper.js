import { configRead, every, report, stop, whenPlayer } from '../../framework/index.js';
import { countAds } from './stats.js';

// Adverts stitched into the video itself. YouTube now cuts some adverts on TVs straight into the
// stream (server-stitched, with no list of adverts in its answers for anything to take out), so the
// adverts that still come are played through: while the player says an advert is showing, the video
// is muted and runs at the fastest speed the TV plays, and Skip is pressed the moment it is offered.
// The sound and speed come back as they were when the advert ends.

const LOOK = 'advert skipper';
const LOOK_EVERY = 300;
const FASTEST = 16;

// The signals the player gives while an advert plays: its own classes and state, and the advert's
// label and Skip button on the screen.
const AD_CLASSES = ['ad-showing', 'ad-interrupting'];
const AD_LABELS = 'ytlr-ad-attribution, ytlr-ad-badge-renderer, ytlr-ad-preview-renderer, ytlr-skip-ad-renderer, '
    + 'ytlr-ad-progress-renderer, .ytp-ad-text, .ytp-ad-preview-container, .ytp-ad-skip-button-container';
const AD_TEXT = /\bAd\b|\bAds\b|Sponsored|Skip ad|Skip\b/i;
const SKIP = 'ytlr-skip-ad-renderer, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, [class*="SkipAd"]';

const held = { player: null, during: false, muted: false, rate: 1, counted: false };

const shown = (element) => {
    try {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && window.getComputedStyle(element).visibility !== 'hidden';
    } catch (error) {
        return false;
    }
};

const advertShowing = (player) => {
    if (!player) return false;
    if (player.classList && AD_CLASSES.some((name) => player.classList.contains(name))) return true;
    try {
        if (typeof player.getAdState === 'function' && player.getAdState() === 1) return true;
    } catch (error) {
        // Not this player's.
    }
    return Array.prototype.some.call(document.querySelectorAll(AD_LABELS), (label) => shown(label) && AD_TEXT.test(label.textContent || ''));
};

const pressSkip = () => {
    const button = Array.prototype.filter.call(document.querySelectorAll(SKIP), shown)[0];
    if (!button) return false;
    try {
        button.click();
        return true;
    } catch (error) {
        return false;
    }
};

const video = () => document.querySelector('video');

const begin = (media) => {
    held.during = true;
    held.counted = false;
    held.muted = media.muted;
    held.rate = media.playbackRate || 1;
};

const end = (media) => {
    held.during = false;
    if (!media) return;
    media.muted = held.muted;
    try {
        media.playbackRate = held.rate;
    } catch (error) {
        media.playbackRate = 1;
    }
};

const look = () => {
    const media = video();
    if (!configRead('enableAdBlock') || !media) {
        if (held.during) end(media);
        return;
    }

    if (!advertShowing(held.player)) {
        if (held.during) end(media);
        return;
    }

    if (!held.during) begin(media);
    if (!held.counted) {
        held.counted = true;
        countAds(1);
    }
    if (pressSkip()) return;
    media.muted = true;
    try {
        if (media.playbackRate !== FASTEST) media.playbackRate = FASTEST;
    } catch (error) {
        try {
            media.playbackRate = 8;
        } catch (again) {
            // The rate it has stays.
        }
    }
};

const guardedLook = () => {
    try {
        look();
    } catch (error) {
        report('adblock', 'advert skipper', error);
    }
};

const start = () => {
    whenPlayer(LOOK, (player) => {
        held.player = player;
        every(LOOK, LOOK_EVERY, guardedLook);
    });
};

const stopLooking = () => stop(LOOK);

export { start, stopLooking, advertShowing, look, held };
