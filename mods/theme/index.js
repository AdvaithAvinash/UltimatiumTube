import { configChangeEmitter, configRead, every, stop } from '../../framework/index.js';

// Customization: wallpaper, colours and font for YouTube's own screens, and the glow on the
// UltimatiumTube rows.
//
// The wallpaper and the background colour are painted as styles set directly on the page's elements
// and put back exactly as they were when switched off, not as rules in a stylesheet: a TV's engine
// may not read a stylesheet again after it changes, and then the wallpaper could be switched on but
// never off. What was painted is checked afterwards, and the page is reloaded if it did not go.

// Pictures in wallpapers/, which the service (Samsung) or the app (Android) serves at this path.
const PICTURES = '/__tube/wallpapers/';

// A picture's preset id and its file. To offer another, add the file to wallpapers/ and list it here.
const WALLPAPER_FILES = { flames: 'blue-flames.jpg' };

const picture = (file) => `url("${PICTURES}${file}")`;

// Each is one image, for the background-image of the page.
const WALLPAPERS = {
    flames: picture(WALLPAPER_FILES.flames),
    ultimatium: 'radial-gradient(ellipse at 50% 38%, #0a3d91 0%, #04122e 58%, #000000 100%)',
    aurora: 'radial-gradient(ellipse at 18% 22%, #1b6b5a 0%, rgba(27,107,90,0) 55%), '
        + 'radial-gradient(ellipse at 82% 30%, #3b2a7a 0%, rgba(59,42,122,0) 55%), '
        + 'linear-gradient(#0b1020, #0b1020)',
    sunset: 'linear-gradient(160deg, #1a0b2e 0%, #5b1f6b 45%, #e0603a 100%)',
    ocean: 'linear-gradient(180deg, #02111f 0%, #06365c 55%, #0a6ea1 100%)',
    forest: 'linear-gradient(160deg, #04140c 0%, #0b3d24 55%, #1d7a45 100%)',
    ember: 'radial-gradient(ellipse at 50% 112%, #a8321a 0%, #3a0e0a 55%, #0c0505 100%)',
    violet: 'linear-gradient(135deg, #12002b 0%, #3a0f7a 60%, #7a3fd1 100%)',
    steel: 'linear-gradient(160deg, #101418 0%, #2a3440 60%, #4a5a6b 100%)',
    midnight: 'linear-gradient(180deg, #050510 0%, #10102a 100%)'
};

const BACKGROUNDS = {
    black: '#000000', graphite: '#121212', navy: '#0a1128', plum: '#1a0f26', forest: '#0c1a12', wine: '#200a10'
};

const ACCENTS = {
    blue: '#3ea6ff', cyan: '#22d3ee', purple: '#a78bfa', pink: '#f472b6',
    green: '#4ade80', orange: '#fb923c', red: '#f87171', white: '#ffffff'
};

const FONTS = {
    sans: 'Roboto, Arial, Helvetica, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", Courier, monospace',
    rounded: '"Trebuchet MS", Verdana, sans-serif'
};

const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ');

// The wallpaper's image, or null while it is off or its picture is not a usable one. An address the
// viewer typed is used only as an image, and only if it is a plain http(s) one.
const wallpaperOf = (read) => {
    if (!read('themeWallpaperOn')) return null;

    const chosen = read('themeWallpaper');

    if (chosen === 'custom') {
        const url = String(read('themeWallpaperUrl') || '').trim();
        return /^https?:\/\/[^\s"'()\\]+$/.test(url) ? `url("${url}")` : null;
    }

    return Object.prototype.hasOwnProperty.call(WALLPAPERS, chosen) ? WALLPAPERS[chosen] : null;
};

const dimOf = (read) => Math.max(0, Math.min(90, Number(read('themeDim')) || 0));

// What the page's backdrop should be: a wallpaper, a plain colour, or nothing of ours.
const backdropOf = (read) => {
    const image = wallpaperOf(read);
    if (image) return { kind: 'wallpaper', image, dim: dimOf(read) };

    const colour = BACKGROUNDS[read('themeBackground')];
    return colour ? { kind: 'colour', colour } : null;
};

// The glow is explicit colours rather than a variable: the TV's engine is older than the web's.
const glow = (accent) => {
    const rest = `0 0 6px rgba(${rgb(accent)}, 0.55)`;
    const peak = `0 0 14px rgba(${rgb(accent)}, 1), 0 0 28px rgba(${rgb(accent)}, 0.7)`;

    return `.tube-ultimate, .tube-ultimate * { color: ${accent} !important; text-shadow: ${rest}; `
        + 'animation: tubeGlow 2.6s ease-in-out infinite; }\n'
        + `@keyframes tubeGlow { 0% { text-shadow: ${rest}; } 50% { text-shadow: ${peak}; } 100% { text-shadow: ${rest}; } }\n`;
};

// The stylesheet: the glow, the font and the viewer's own rules. The backdrop is not in it.
const themeCss = (read) => {
    const accent = ACCENTS[read('themeAccent')] || ACCENTS.blue;
    const font = FONTS[read('themeFont')];
    const parts = [glow(accent)];

    if (font) parts.push(`#container, #container * { font-family: ${font} !important; }`);

    const own = String(read('customCss') || '');
    if (own.trim()) parts.push(own);

    return parts.join('\n');
};

// --- painting the backdrop

const KEPT = '__tubeKept';

// What an element's own style held before, so painting can be undone to the letter.
const remember = (element, values) => {
    if (element[KEPT]) return;

    const kept = {};
    Object.keys(values).forEach((name) => {
        kept[name] = element.style[name] || '';
    });
    element[KEPT] = kept;
};

const paint = (element, values) => {
    if (!element || !element.style) return;

    remember(element, values);
    Object.keys(values).forEach((name) => {
        element.style[name] = values[name];
    });
};

const unpaint = (element) => {
    const kept = element && element[KEPT];
    if (!kept) return;

    Object.keys(kept).forEach((name) => {
        element.style[name] = kept[name];
    });
    element[KEPT] = null;
};

// The page, and what the app draws its own opaque backdrop on.
const targets = () => ({
    page: [document.documentElement, document.body],
    backdrops: [document.getElementById('container'), document.querySelector('ytlr-app')]
});

const ofPage = (values) => Object.assign({
    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', minHeight: '100vh'
}, values);

const shade = (dim) => `linear-gradient(rgba(0, 0, 0, ${dim / 100}), rgba(0, 0, 0, ${dim / 100}))`;

const computedImage = () => {
    try {
        return String(window.getComputedStyle(document.body).backgroundImage || '');
    } catch (error) {
        return null;
    }
};

// seen is what the engine reported for the page's background-image while the wallpaper was on.
const state = { painted: false, seen: null, reloading: false };

const paintWallpaper = (backdrop) => {
    const { page, backdrops } = targets();
    const open = { backgroundColor: 'transparent', backgroundImage: 'none' };

    const draw = (image) => {
        page.forEach((element) => paint(element, ofPage({ backgroundImage: image, backgroundColor: '#000000' })));
        backdrops.forEach((element) => paint(element, open));
    };

    // The dimming is a second layer in the same background. If this engine does not take two, the
    // wallpaper goes on without it rather than not at all.
    draw(backdrop.dim ? `${shade(backdrop.dim)}, ${backdrop.image}` : backdrop.image);

    const drawn = computedImage();
    if (backdrop.dim && (drawn === '' || drawn === 'none')) draw(backdrop.image);

    state.seen = computedImage();
};

const paintColour = (backdrop) => {
    const { page, backdrops } = targets();
    const values = { backgroundColor: backdrop.colour };

    page.forEach((element) => paint(element, values));
    backdrops.forEach((element) => paint(element, values));
};

// Reloading by itself is done once; the button the viewer pressed always does it.
const reload = (asked) => {
    if (state.reloading && !asked) return;
    state.reloading = true;

    window.location.reload();
};

// Puts every element back as it was. If the engine still shows the wallpaper after that, it did not
// redraw, and a reload is the one thing certain to.
const clearBackdrop = (checkGone) => {
    const { page, backdrops } = targets();

    /** @type {any[]} */ (page).concat(backdrops).forEach(unpaint);
    stop('tube backdrop');

    const was = state.painted;
    state.painted = false;

    if (!checkGone || !was) return;

    const still = computedImage();
    if (still !== null && still !== 'none' && still !== '' && still === state.seen) reload();
};

const watching = () => /^#?\/watch/.test(String(window.location.hash || ''));

// The app may draw its own backdrop again after a change of screen, so while one is painted it is
// painted again now and then.
const assertBackdrop = () => {
    const desired = backdropOf(configRead);
    if (!desired || watching()) return;

    if (desired.kind === 'wallpaper') paintWallpaper(desired);
    else paintColour(desired);
};

const applyBackdrop = (checkGone) => {
    const desired = backdropOf(configRead);

    // A video covers the page, and the wallpaper costs something to keep under it.
    if (!desired || watching()) {
        clearBackdrop(checkGone);
        return;
    }

    // Anything painted earlier is undone first, so a new picture never lies over an old one.
    const here = targets();
    /** @type {any[]} */ (here.page).concat(here.backdrops).forEach(unpaint);

    if (desired.kind === 'wallpaper') paintWallpaper(desired);
    else paintColour(desired);

    state.painted = true;
    every('tube backdrop', 3000, assertBackdrop);
};

// --- the stylesheet

const STYLE_ID = 'ultimatiumtube-theme';

// A new element each time, taking the old one's place: an engine that reads a style element when it
// is inserted reads this one, and one that reads changes does as well.
const applySheet = () => {
    const parent = document.head || document.documentElement;
    if (!parent) return;

    const old = document.getElementById(STYLE_ID);
    if (old) old.id = '';

    const fresh = document.createElement('style');
    fresh.id = STYLE_ID;
    fresh.textContent = themeCss(configRead);
    parent.appendChild(fresh);

    if (old && old.parentNode) old.parentNode.removeChild(old);
};

const THEME_KEYS = ['themeWallpaperOn', 'themeWallpaper', 'themeWallpaperUrl', 'themeDim', 'themeBackground',
    'themeAccent', 'themeFont', 'customCss'];

const BACKDROP_KEYS = ['themeWallpaperOn', 'themeWallpaper', 'themeWallpaperUrl', 'themeDim', 'themeBackground'];

// For the "turn it off now" entry in the settings: off, painted away, and the page loaded again so
// that it is certain.
const wallpaperOffNow = () => {
    clearBackdrop(false);
    setTimeout(() => reload(true), 300);
};

const start = () => {
    applySheet();
    applyBackdrop(false);

    configChangeEmitter.addEventListener('configChange', (event) => {
        const key = event.detail.key;

        if (THEME_KEYS.indexOf(key) !== -1) applySheet();
        if (BACKDROP_KEYS.indexOf(key) !== -1) applyBackdrop(true);
    });

    // The wallpaper steps aside while a video plays, and comes back after.
    window.addEventListener('hashchange', () => applyBackdrop(false));

    // The page builds itself as it loads, so what was painted early is painted again once it has.
    window.addEventListener('load', () => {
        applySheet();
        applyBackdrop(false);
    });
};

export {
    themeCss, wallpaperOf, backdropOf, wallpaperOffNow, WALLPAPER_FILES, WALLPAPERS, BACKGROUNDS, ACCENTS, FONTS, start
};
