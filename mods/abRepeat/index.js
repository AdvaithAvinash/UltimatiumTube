import { configRead, showToast, video, whenVideo } from '../../framework/index.js';

// A-B repeat: the first press marks A, the second marks B and loops A to B, the third stops the loop.
// And the seek steps the remote buttons use, chosen in the settings.

const loop = { a: null, b: null, video: null };

const clock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const two = (n) => (n < 10 ? `0${n}` : String(n));
    return `${Math.floor(s / 60)}:${two(s % 60)}`;
};

const abPress = () => {
    const v = video();
    if (!v) return;

    if (loop.a === null) {
        loop.a = v.currentTime;
        loop.b = null;
        showToast('A-B repeat', `A at ${clock(loop.a)}. Press again at the end of the part`);
    } else if (loop.b === null) {
        if (v.currentTime <= loop.a + 1) {
            showToast('A-B repeat', 'B must be after A');
            return;
        }
        loop.b = v.currentTime;
        v.currentTime = loop.a;
        showToast('A-B repeat', `Looping ${clock(loop.a)} to ${clock(loop.b)}. Press again to stop`);
    } else {
        loop.a = null;
        loop.b = null;
        showToast('A-B repeat', 'Stopped');
    }
};

const watch = (v) => {
    loop.video = v;
    v.addEventListener('timeupdate', () => {
        if (loop.a !== null && loop.b !== null && v.currentTime >= loop.b) v.currentTime = loop.a;
    });
    // A new video ends the loop of the last one.
    v.addEventListener('loadstart', () => { loop.a = null; loop.b = null; });
};

const seekStep = (forward) => Number(configRead(forward ? 'seekForwardSeconds' : 'seekBackSeconds')) || (forward ? 30 : 10);

const start = () => whenVideo('a-b repeat', watch);

export { abPress, seekStep, start, loop };
