import { configRead, showToast, whenVideo } from '../../framework/index.js';
import { currentVideo } from '../channels/index.js';

// Smart resume: where each video was left, and the next time it opens it starts there. YouTube does
// this itself for a signed-in account, and then the video has already moved on when it starts, so
// nothing is done twice. Kept on the TV only (not in the settings): it changes every few seconds.

const KEY = 'tube.resume';
const MOST = 300;
const SAVE_EVERY = 10000;
const LONG_ENOUGH = 120; // seconds: shorter videos simply start again
const NEAR_START = 5;
const NEAR_END = 0.95;

const read = () => {
    try {
        return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {};
    } catch (error) {
        return {};
    }
};

const write = (all) => {
    try {
        const ids = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
        ids.slice(MOST).forEach((id) => { delete all[id]; });
        window.localStorage.setItem(KEY, JSON.stringify(all));
    } catch (error) {
        // Full or unavailable: nothing is remembered.
    }
};

const remember = (id, t, d) => {
    if (!id || !(d > LONG_ENOUGH)) return;
    const all = read();
    if (t > NEAR_START && t < d * NEAR_END) all[id] = { t: Math.floor(t), d: Math.floor(d), at: Date.now() };
    else delete all[id];
    write(all);
};

const positionFor = (id, d) => {
    const kept = read()[id];
    if (!kept || !(d > LONG_ENOUGH)) return 0;
    return kept.t > NEAR_START && kept.t < d * NEAR_END ? kept.t : 0;
};

const clock = (seconds) => {
    const s = Math.floor(seconds);
    const two = (n) => (n < 10 ? `0${n}` : String(n));
    return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`;
};

const follow = (video) => {
    const held = { id: null, saved: 0, resumed: null };

    const id = () => currentVideo().videoId;

    const maybeResume = () => {
        if (!configRead('enableSmartResume')) return;
        const now = id();
        if (!now || held.resumed === now) return;
        if (!(video.duration > 0)) return;

        held.resumed = now;
        const at = positionFor(now, video.duration);
        if (at && video.currentTime < NEAR_START) {
            video.currentTime = at;
            showToast('Resumed', `From ${clock(at)}, where you stopped`);
        }
    };

    const save = () => {
        if (!configRead('enableSmartResume')) return;
        const now = id();
        if (!now || held.resumed !== now) return;
        remember(now, video.currentTime, video.duration);
        held.saved = Date.now();
    };

    video.addEventListener('loadedmetadata', maybeResume);
    video.addEventListener('playing', maybeResume);
    video.addEventListener('timeupdate', () => { if (Date.now() - held.saved > SAVE_EVERY) save(); });
    video.addEventListener('pause', save);
    video.addEventListener('ended', () => { const now = id(); if (now) remember(now, 0, video.duration); });
};

const start = () => whenVideo('smart resume', follow);

export { start, remember, positionFor };
