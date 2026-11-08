import { warn, buttonItem, configChangeEmitter, configRead, configWrite, every, onKey, overlayPanelItemListRenderer, showModal, showToast, stop, whenVideo } from '../../framework/index.js';

// Video fit: a video whose shape differs from the screen's is shown with bars around it. Zoom to
// fill crops the edges so the picture covers the screen; Stretch fills it without cropping.

const ZOOM_KEY = 405; // Yellow on the remote

// Zoom to fill works from the video's own shape. Many uploads are 16:9 with the black bars inside
// the picture (a film, a 4:3 clip), and to the player those are already the screen's shape, so the
// fixed zooms are for them: 1.33x fills a 2.39:1 film or a 4:3 clip that was put in a 16:9 frame.
const FITS = ['original', 'fill', 'z115', 'z133', 'z150', 'stretch'];
const NAMES = {
    original: 'Original', fill: 'Zoom to fill', z115: 'Zoom 1.15x', z133: 'Zoom 1.33x (black bars inside the video)',
    z150: 'Zoom 1.5x', stretch: 'Stretch'
};
const ZOOMS = { z115: 1.15, z133: 1.33, z150: 1.5 };

const fitOf = (read) => (FITS.indexOf(read('videoFit')) === -1 ? 'original' : read('videoFit'));

const kept = { video: null };

// How the engine draws a video: always whole and in its own shape, centred in the video element's
// box (there is no object-fit to change that). So a fit cannot be set on the element; the element's
// box is what is changed. Zoom makes the box as big as the picture must be to cover the screen,
// placed so its middle is the screen's middle, and the part outside the screen is cut off. Stretch
// makes the box the screen and scales it, by a different amount across and down, until the picture
// in it fills the screen.
const boxFor = (mode, vw, vh, sw, sh) => {
    if (ZOOMS[mode]) {
        // The picture as the player shows it (whole, in its shape), made bigger about the middle.
        const fitted = Math.min(sw / vw, sh / vh) * ZOOMS[mode];
        const width = Math.round(vw * fitted);
        const height = Math.round(vh * fitted);

        return { left: Math.round((sw - width) / 2), top: Math.round((sh - height) / 2), width, height, scaleX: 1, scaleY: 1 };
    }

    if (mode === 'fill') {
        const scale = Math.max(sw / vw, sh / vh);
        const width = Math.round(vw * scale);
        const height = Math.round(vh * scale);

        return { left: Math.round((sw - width) / 2), top: Math.round((sh - height) / 2), width, height, scaleX: 1, scaleY: 1 };
    }

    const inside = Math.min(sw / vw, sh / vh);

    return { left: 0, top: 0, width: sw, height: sh, scaleX: sw / (vw * inside), scaleY: sh / (vh * inside) };
};

const HELD = '__tubeFitKept';

const NAMES_SET = ['position', 'left', 'top', 'width', 'height', 'maxWidth', 'maxHeight', 'margin', 'transform', 'transformOrigin', 'objectFit'];

// Plainly first, which every engine takes; with priority too where the engine takes that, since the
// player's own rules may be marked important.
const write = (style, name, value) => {
    style[name] = value;

    if (typeof style.setProperty === 'function') {
        try {
            style.setProperty(name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value, 'important');
        } catch (error) {
            // The plain write stands.
        }
    }
};

const release = (video) => {
    const held = video[HELD];
    if (!held) return;

    NAMES_SET.forEach((name) => { video.style[name] = held[name] || ''; });
    video[HELD] = null;
    video.__tubeFitTransform = undefined;
    video.__tubeFitSaid = undefined;
};

const screenSize = () => ({ width: window.innerWidth || 1920, height: window.innerHeight || 1080 });

const apply = (video) => {
    if (!video || !video.style) return;

    const fit = fitOf(configRead);

    if (fit === 'original') {
        release(video);
        return;
    }

    // Until the video says its shape there is nothing to work from.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!(vw > 0 && vh > 0)) return;

    if (!video[HELD]) {
        const before = {};
        NAMES_SET.forEach((name) => { before[name] = video.style[name] || ''; });
        video[HELD] = before;
    }

    const screen = screenSize();
    const box = boxFor(fit, vw, vh, screen.width, screen.height);
    const scaled = Math.abs(box.scaleX - 1) > 0.001 || Math.abs(box.scaleY - 1) > 0.001;

    const wanted = {
        position: 'fixed',
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        maxWidth: 'none',
        maxHeight: 'none',
        margin: '0px',
        transformOrigin: '50% 50%',
        transform: scaled ? `scale(${box.scaleX}, ${box.scaleY})` : 'none'
    };

    // Written again whenever the player has put something else there.
    Object.keys(wanted).forEach((name) => {
        if (name === 'transform' || name === 'transformOrigin') {
            if (video.__tubeFitTransform !== wanted.transform) write(video.style, name, wanted[name]);
        } else if (video.style[name] !== wanted[name]) {
            write(video.style, name, wanted[name]);
        }
    });
    video.__tubeFitTransform = wanted.transform;

    // What was asked for, and a moment later what the engine made of it, go to the service's log
    // (/__tube/log) once for each change: that is the only way to see it on a television.
    const said = `${fit} ${vw}x${vh} on ${screen.width}x${screen.height}`;
    if (video.__tubeFitSaid !== said) {
        video.__tubeFitSaid = said;
        warn('video fit', `${said}: box ${box.width}x${box.height} at ${box.left},${box.top}${scaled ? `, ${wanted.transform}` : ''}`);
        setTimeout(() => {
            try {
                const r = video.getBoundingClientRect();
                warn('video fit', `${said}: the element is now ${Math.round(r.width)}x${Math.round(r.height)} at `
                    + `${Math.round(r.left)},${Math.round(r.top)}; style width ${video.style.width}, position ${video.style.position}, transform ${video.style.transform || 'none'}`);
            } catch (error) {
                warn('video fit', `could not read the element back: ${error && error.message}`);
            }
        }, 1500);
    }
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
    ['loadedmetadata', 'loadeddata', 'playing', 'resize', 'seeked'].forEach((name) => video.addEventListener(name, () => apply(video)));
    window.addEventListener('resize', () => apply(video));
    if (fitOf(configRead) !== 'original') every(WATCH, 500, upkeep);

    // The player writes the video's size into its style when it lays the player out; the fit is put
    // back at once, not at the next look. Writing the same values again changes nothing, so this
    // does not feed itself.
    if (typeof MutationObserver === 'function') {
        try {
            new MutationObserver(() => {
                if (fitOf(configRead) !== 'original') apply(video);
            }).observe(video, { attributes: true, attributeFilter: ['style'] });
        } catch (error) {
            // The half-second look still does it.
        }
    }
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

export { adopt, apply, boxFor, cycle, openFitOptions, setFit, fitOf, FITS, start };
