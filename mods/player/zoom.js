import { configChangeEmitter, configRead, configWrite, onKey, showToast, whenVideo } from '../../framework/index.js';

// Video fit: a video whose shape differs from the screen's is shown with bars around it. Zoom to
// fill crops the edges so the picture covers the screen; Stretch fills it without cropping.

const ZOOM_KEY = 405; // Yellow on the remote

const FITS = ['original', 'fill', 'stretch'];
const CSS_FIT = { original: 'contain', fill: 'cover', stretch: 'fill' };
const NAMES = { original: 'Original', fill: 'Zoom to fill', stretch: 'Stretch' };

const fitOf = (read) => (FITS.indexOf(read('videoFit')) === -1 ? 'original' : read('videoFit'));

const kept = { video: null };

const apply = (video) => {
    if (!video || !video.style) return;

    const fit = fitOf(configRead);

    // Original puts back what the stock player had, which is no fit of its own.
    video.style.objectFit = fit === 'original' ? '' : CSS_FIT[fit];
};

const adopt = (video) => {
    kept.video = video;
    apply(video);

    // The player redraws a video's box when it starts another, so the fit is set again then.
    ['loadedmetadata', 'playing', 'resize'].forEach((name) => video.addEventListener(name, () => apply(video)));
};

const cycle = () => {
    const next = FITS[(FITS.indexOf(fitOf(configRead)) + 1) % FITS.length];
    configWrite('videoFit', next);
    showToast('Video fit', NAMES[next]);
};

const start = () => {
    whenVideo('video fit', adopt);

    configChangeEmitter.addEventListener('configChange', (event) => {
        if (event.detail.key === 'videoFit') apply(kept.video);
    });

    onKey('video fit', [ZOOM_KEY], (event) => {
        if (event.type === 'keydown') cycle();
        return true;
    });
};

export { apply, cycle, fitOf, FITS, CSS_FIT, start };
