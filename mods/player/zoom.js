import { buttonItem, configChangeEmitter, configRead, configWrite, every, onKey, overlayPanelItemListRenderer, showModal, showToast, stop, whenVideo } from '../../framework/index.js';

// Video fit: a video whose shape differs from the screen's is shown with bars around it. Zoom to
// fill crops the edges so the picture covers the screen; Stretch fills it without cropping.

const ZOOM_KEY = 405; // Yellow on the remote

const FITS = ['original', 'fill', 'stretch'];
const CSS_FIT = { original: 'contain', fill: 'cover', stretch: 'fill' };
const NAMES = { original: 'Original', fill: 'Zoom to fill', stretch: 'Stretch' };

const fitOf = (read) => (FITS.indexOf(read('videoFit')) === -1 ? 'original' : read('videoFit'));

const kept = { video: null };

// The player gives the video element the size and place of the picture inside the bars, so a fit
// set on the element only crops inside that same box. For Zoom and Stretch the element is made the
// whole screen, and what the player had written is put back for Original.
const LAYOUT = { position: 'fixed', left: '0px', top: '0px', width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' };
const HELD = '__tubeFitKept';

const names = Object.keys(LAYOUT).concat(['objectFit']);

const write = (style, name, value, priority) => {
    const css = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (typeof style.setProperty === 'function') style.setProperty(css, value, priority);
    else style[name] = value;
};

const release = (video) => {
    const held = video[HELD];
    if (!held) return;

    names.forEach((name) => write(video.style, name, held[name] || '', ''));
    video[HELD] = null;
};

const apply = (video) => {
    if (!video || !video.style) return;

    const fit = fitOf(configRead);

    if (fit === 'original') {
        release(video);
        return;
    }

    if (!video[HELD]) {
        const before = {};
        names.forEach((name) => { before[name] = video.style[name] || ''; });
        video[HELD] = before;
    }

    // Written with priority, and written again when the player has changed it.
    Object.keys(LAYOUT).forEach((name) => {
        if (video.style[name] !== LAYOUT[name]) write(video.style, name, LAYOUT[name], 'important');
    });
    if (video.style.objectFit !== CSS_FIT[fit]) write(video.style, 'objectFit', CSS_FIT[fit], 'important');
};

const WATCH = 'video fit upkeep';

const upkeep = () => {
    if (fitOf(configRead) === 'original') {
        apply(kept.video);
        stop(WATCH);
        return;
    }

    apply(kept.video);
};

const adopt = (video) => {
    kept.video = video;
    apply(video);

    // The player redraws a video's box on resize, quality changes and new videos.
    ['loadedmetadata', 'playing', 'resize', 'seeked'].forEach((name) => video.addEventListener(name, () => apply(video)));
    if (fitOf(configRead) !== 'original') every(WATCH, 500, upkeep);
};

const openFitOptions = () => {
    const current = FITS.indexOf(fitOf(configRead));
    const buttons = FITS.map((fit) => buttonItem({ title: NAMES[fit] }, null, [
        { signalAction: { signal: 'POPUP_BACK' } },
        { customAction: { action: 'SET_VIDEO_FIT', parameters: fit } }
    ]));

    showModal('Video fit', overlayPanelItemListRenderer(buttons, current), 'options-fit');
};

const setFit = (fit) => {
    if (FITS.indexOf(fit) === -1) return;

    configWrite('videoFit', fit);
    showToast('Video fit', NAMES[fit]);
};

const cycle = () => {
    const next = FITS[(FITS.indexOf(fitOf(configRead)) + 1) % FITS.length];
    setFit(next);
};

const start = () => {
    whenVideo('video fit', adopt);

    configChangeEmitter.addEventListener('configChange', (event) => {
        if (event.detail.key !== 'videoFit') return;

        apply(kept.video);
        if (fitOf(configRead) !== 'original') every(WATCH, 500, upkeep);
    });

    onKey('video fit', [ZOOM_KEY], (event) => {
        if (event.type === 'keydown') cycle();
        return true;
    });
};

export { apply, cycle, openFitOptions, setFit, fitOf, FITS, CSS_FIT, start };
