import { warn, buttonItem, configChangeEmitter, configRead, configWrite, every, onKey, overlayPanelItemListRenderer, showModal, showToast, stop, whenVideo } from '../../framework/index.js';

// Video fit: a video whose shape differs from the screen's is shown with bars around it. Zoom to
// fill crops the edges so the picture covers the screen; Stretch fills it without cropping.
//
// How the TV's engine draws a video: whole and in its own shape, centred in the video element's box,
// with no object-fit. The rectangle it ends up in, after every CSS transform, is what the TV's own
// video player is told to draw into. So the fit is a CSS transform on the video element, about its
// middle: the player's own layout of the element (its size and place) is left exactly as YouTube
// wrote it, which nothing in YouTube then fights, and the transform scales what is drawn.
//
// Every video element in the page is fitted, not only the first: the TV page can hold more than one
// (a preview beside the one playing), and the first is not always the one on the screen.

const ZOOM_KEY = 405; // Yellow on the remote

// Zoom to fill works from the video's own shape. Many uploads are 16:9 with the black bars inside
// the picture (a film, a 4:3 clip); to the player those are already the screen's shape, so the fixed
// zooms are for them: 1.33x fills a 2.39:1 film or a 4:3 clip that was put in a 16:9 frame.
const FITS = ['original', 'fill', 'z115', 'z133', 'z150', 'stretch'];
const NAMES = {
    original: 'Original', fill: 'Zoom to fill', z115: 'Zoom 1.15x', z133: 'Zoom 1.33x (black bars inside the video)',
    z150: 'Zoom 1.5x', stretch: 'Stretch'
};
const ZOOMS = { z115: 1.15, z133: 1.33, z150: 1.5 };

const fitOf = (read) => (FITS.indexOf(read('videoFit')) === -1 ? 'original' : read('videoFit'));

// The scale across and down for a fit, given the video's shape (vw x vh; unknown is 0) and the size
// of the element's box (bw x bh). The picture is drawn whole inside the box; this is how much bigger
// it must be drawn.
const scaleFor = (mode, vw, vh, bw, bh) => {
    if (ZOOMS[mode]) return { x: ZOOMS[mode], y: ZOOMS[mode] };

    // An engine that does not say the video's shape: the picture is taken to fill the box, so
    // only the fixed zooms do anything.
    const w = vw > 0 ? vw : bw;
    const h = vh > 0 ? vh : bh;
    const inside = Math.min(bw / w, bh / h);
    const across = bw / (w * inside);
    const down = bh / (h * inside);

    if (mode === 'fill') {
        const both = Math.max(across, down);
        return { x: both, y: both };
    }

    if (mode === 'stretch') return { x: across, y: down };

    return { x: 1, y: 1 };
};

const round = (n) => Math.round(n * 10000) / 10000;

const transformFor = (scale) => (Math.abs(scale.x - 1) < 0.001 && Math.abs(scale.y - 1) < 0.001
    ? 'none'
    : `scale(${round(scale.x)}, ${round(scale.y)})`);

const HELD = '__tubeFitKept';
const NAMES_SET = ['transform', 'transformOrigin'];

// Plainly first, which every engine takes; with priority too where the engine takes that, since the
// player's own rules may be marked important.
const write = (style, name, value) => {
    style[name] = value;

    if (typeof style.setProperty === 'function') {
        try {
            style.setProperty(name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value, value ? 'important' : '');
        } catch (error) {
            // The plain write stands.
        }
    }
};

const release = (video) => {
    const held = video[HELD];
    if (!held) return;

    NAMES_SET.forEach((name) => write(video.style, name, held[name] || ''));
    video[HELD] = null;
    video.__tubeFitSaid = undefined;
};

// The element's box as YouTube laid it out, before any transform of ours; the screen when the engine
// does not say.
const boxOf = (video) => ({
    width: video.offsetWidth || window.innerWidth || 1920,
    height: video.offsetHeight || window.innerHeight || 1080
});

const apply = (video) => {
    if (!video || !video.style) return;

    const fit = fitOf(configRead);

    if (fit === 'original') {
        release(video);
        return;
    }

    if (!video[HELD]) {
        const before = {};
        NAMES_SET.forEach((name) => { before[name] = video.style[name] || ''; });
        video[HELD] = before;
    }

    const box = boxOf(video);
    const scale = scaleFor(fit, video.videoWidth || 0, video.videoHeight || 0, box.width, box.height);
    const transform = transformFor(scale);

    if (video.style.transformOrigin !== '50% 50%') write(video.style, 'transformOrigin', '50% 50%');
    if (video.style.transform !== transform) write(video.style, 'transform', transform);

    // What was asked for, and a moment later what the engine made of it, go to the service's log
    // (/__tube/log) once for each change.
    const said = `${fit} ${video.videoWidth || '?'}x${video.videoHeight || '?'} in ${box.width}x${box.height}: ${transform}`;
    if (video.__tubeFitSaid === said) return;
    video.__tubeFitSaid = said;
    warn('video fit', said);

    setTimeout(() => {
        try {
            const r = video.getBoundingClientRect();
            warn('video fit', `${fit}: the video now covers ${Math.round(r.width)}x${Math.round(r.height)} at `
                + `${Math.round(r.left)},${Math.round(r.top)}; its transform reads ${video.style.transform || 'none'}`);
        } catch (error) {
            warn('video fit', `could not read the video back: ${error && error.message}`);
        }
    }, 1500);
};

const ON_EVENTS = ['loadedmetadata', 'loadeddata', 'playing', 'resize', 'seeked'];

// Each video is fitted again whenever the player changes it: a new video, its size, its style.
const watchVideo = (video) => {
    if (!video || video.__tubeFitWatched) return;
    video.__tubeFitWatched = true;

    ON_EVENTS.forEach((name) => video.addEventListener(name, () => apply(video)));

    // Writing the same values again changes nothing, so this does not feed itself.
    if (typeof MutationObserver === 'function') {
        try {
            new MutationObserver(() => {
                if (fitOf(configRead) !== 'original') apply(video);
            }).observe(video, { attributes: true, attributeFilter: ['style', 'class'] });
        } catch (error) {
            // The half-second look still does it.
        }
    }
};

const videos = () => Array.prototype.slice.call(document.querySelectorAll('video'));

const applyAll = () => videos().forEach((video) => {
    apply(video);
    watchVideo(video);
});

const WATCH = 'video fit upkeep';

const upkeep = () => {
    applyAll();
    if (fitOf(configRead) === 'original') stop(WATCH);
};

const adopt = (video) => {
    watchVideo(video);
    applyAll();
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
    window.addEventListener('resize', applyAll);

    configChangeEmitter.addEventListener('configChange', (event) => {
        if (event.detail.key !== 'videoFit') return;

        applyAll();
        if (fitOf(configRead) !== 'original') every(WATCH, 500, upkeep);
    });

    onKey('video fit', [ZOOM_KEY], (event) => {
        if (event.type === 'keydown') cycle();
        return true;
    });
};

export { adopt, apply, applyAll, scaleFor, transformFor, cycle, openFitOptions, setFit, fitOf, FITS, start };
