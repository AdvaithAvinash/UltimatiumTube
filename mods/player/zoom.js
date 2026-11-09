import { warn, buttonItem, configChangeEmitter, configRead, configWrite, every, overlayPanelItemListRenderer, showModal, showToast, stop, whenVideo } from '../../framework/index.js';

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

// Where the picture must end up, from where it is now. The picture is drawn whole and centred in the
// video element's box; YouTube's player makes that box the whole screen for some videos and only the
// picture's own size (a band across the middle) for others. So the fit is worked out against the
// screen, not the box: the picture is moved and scaled from where it is drawn to where the fit wants
// it, which works whichever box the player chose.
//
// box: the element's box on the screen before any transform of ours {x, y, w, h}; screen {w, h};
// vw x vh: the video's own size (0 when the engine does not say: the box's shape is taken).
// Answers { tx, ty, sx, sy } for transform-origin 0 0, or null for no change.
const planFor = (mode, vw, vh, box, screen) => {
    if (mode === 'original' || !(box.w > 0 && box.h > 0)) return null;

    const w = vw > 0 ? vw : box.w;
    const h = vh > 0 ? vh : box.h;

    // The picture as drawn now, inside the box.
    const inBox = Math.min(box.w / w, box.h / h);
    const cw = w * inBox;
    const ch = h * inBox;
    const ox = (box.w - cw) / 2;
    const oy = (box.h - ch) / 2;

    // The picture as the fit wants it, centred on the screen.
    const onScreen = Math.min(screen.w / w, screen.h / h);
    const wanted = ZOOMS[mode] ? { w: w * onScreen * ZOOMS[mode], h: h * onScreen * ZOOMS[mode] }
        : mode === 'fill' ? { w: w * Math.max(screen.w / w, screen.h / h), h: h * Math.max(screen.w / w, screen.h / h) }
            : mode === 'stretch' ? { w: screen.w, h: screen.h }
                : null;
    if (!wanted) return null;

    const sx = wanted.w / cw;
    const sy = wanted.h / ch;
    const tx = (screen.w - wanted.w) / 2 - box.x - sx * ox;
    const ty = (screen.h - wanted.h) / 2 - box.y - sy * oy;

    const still = Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5;
    return still ? null : { tx, ty, sx, sy };
};

const round = (n) => Math.round(n * 10000) / 10000;

const transformFor = (plan) => (plan
    ? `translate(${Math.round(plan.tx)}px, ${Math.round(plan.ty)}px) scale(${round(plan.sx)}, ${round(plan.sy)})`
    : 'none');

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

// The element's box on the screen as YouTube laid it out, before any transform of ours: its offsets
// added up the chain of the boxes it sits in (those ignore transforms), or, where the engine gives
// none, a box centred on the screen.
const screenOf = () => ({ w: window.innerWidth || 1920, h: window.innerHeight || 1080 });

const boxOf = (video) => {
    const screen = screenOf();
    const w = video.offsetWidth || screen.w;
    const h = video.offsetHeight || screen.h;

    if (typeof video.offsetLeft !== 'number') return { x: (screen.w - w) / 2, y: (screen.h - h) / 2, w, h };

    const at = { x: 0, y: 0 };
    const climb = (node, depth) => {
        if (!node || depth > 30) return;
        at.x += node.offsetLeft || 0;
        at.y += node.offsetTop || 0;
        climb(node.offsetParent, depth + 1);
    };
    climb(video, 0);
    return { x: at.x, y: at.y, w, h };
};

// Only the player on the watch screen: a preview on a shelf, or the mini player, is left alone.
const isMainPlayer = (box, screen) => box.w >= screen.w * 0.85 || box.h >= screen.h * 0.85;

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
    const screen = screenOf();
    const plan = isMainPlayer(box, screen) ? planFor(fit, video.videoWidth || 0, video.videoHeight || 0, box, screen) : null;
    const transform = transformFor(plan);

    if (video.style.transformOrigin !== '0px 0px') write(video.style, 'transformOrigin', '0px 0px');
    if (video.style.transform !== transform) write(video.style, 'transform', transform);

    // What was asked for, and a moment later what the engine made of it, go to the service's log
    // (/__tube/log) once for each change.
    const said = `${fit} ${video.videoWidth || '?'}x${video.videoHeight || '?'} in ${Math.round(box.w)}x${Math.round(box.h)} at ${Math.round(box.x)},${Math.round(box.y)}: ${transform}`;
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

};

export { adopt, apply, applyAll, planFor, transformFor, cycle, openFitOptions, setFit, fitOf, FITS, start };
