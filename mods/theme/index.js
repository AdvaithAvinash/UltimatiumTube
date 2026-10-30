import { configChangeEmitter, configRead } from '../../framework/index.js';

// Customization: wallpaper, colours and font for YouTube's own screens, and the glow on the
// UltimatiumTube rows. Everything here is one stylesheet, rebuilt whenever a setting changes.

// Pictures in wallpapers/, which the service (Samsung) or the app (Android) serves at this path.
const PICTURES = '/__tube/wallpapers/';

// A picture's preset id and its file. To offer another, add the file to wallpapers/ and list it here.
const WALLPAPER_FILES = { flames: 'blue-flames.jpg' };

const picture = (file) => `url("${PICTURES}${file}") center / cover no-repeat`;

const WALLPAPERS = {
    flames: picture(WALLPAPER_FILES.flames),
    ultimatium: 'radial-gradient(ellipse at 50% 38%, #0a3d91 0%, #04122e 58%, #000000 100%)',
    aurora: 'radial-gradient(ellipse at 18% 22%, #1b6b5a 0%, rgba(27,107,90,0) 55%), '
        + 'radial-gradient(ellipse at 82% 30%, #3b2a7a 0%, rgba(59,42,122,0) 55%), #0b1020',
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

// The wallpaper, as a CSS background, or null while it is off or its picture is not a usable one.
// An address the viewer typed is used only as an image, and only if it is a plain http(s) one.
const wallpaperOf = (read) => {
    if (!read('themeWallpaperOn')) return null;

    const chosen = read('themeWallpaper');

    if (chosen === 'custom') {
        const url = String(read('themeWallpaperUrl') || '').trim();
        return /^https?:\/\/[^\s"'()\\]+$/.test(url) ? `url("${url}") center / cover no-repeat` : null;
    }

    return Object.prototype.hasOwnProperty.call(WALLPAPERS, chosen) ? WALLPAPERS[chosen] : null;
};

// The glow is explicit colours rather than a variable: the TV's engine is older than the web's.
const glow = (accent) => {
    const rest = `0 0 6px rgba(${rgb(accent)}, 0.55)`;
    const peak = `0 0 14px rgba(${rgb(accent)}, 1), 0 0 28px rgba(${rgb(accent)}, 0.7)`;

    return `.tube-ultimate, .tube-ultimate * { color: ${accent} !important; text-shadow: ${rest}; `
        + 'animation: tubeGlow 2.6s ease-in-out infinite; }\n'
        + `@keyframes tubeGlow { 0% { text-shadow: ${rest}; } 50% { text-shadow: ${peak}; } 100% { text-shadow: ${rest}; } }\n`;
};

// The class on <html> that turns the wallpaper on. Drawn only while it is wanted and nothing is
// playing, and as one background on the page, with nothing fixed or laid over it: those made the
// screens slow on a TV.
const WALL = 'tube-wall';

const themeCss = (read) => {
    const accent = ACCENTS[read('themeAccent')] || ACCENTS.blue;
    const wallpaper = wallpaperOf(read);
    const colour = BACKGROUNDS[read('themeBackground')];
    const font = FONTS[read('themeFont')];
    const dim = Math.max(0, Math.min(90, Number(read('themeDim')) || 0));

    const parts = [glow(accent)];

    if (wallpaper) {
        const shade = dim ? `linear-gradient(rgba(0, 0, 0, ${dim / 100}), rgba(0, 0, 0, ${dim / 100})), ` : '';

        // The page is made at least as tall as the screen, so the picture covers all of it, and black
        // sits under it for any part it does not.
        parts.push(`html.${WALL}, html.${WALL} body { min-height: 100vh; background: ${shade}${wallpaper} !important; `
            + 'background-color: #000000 !important; }');
        // The app's own backdrop is opaque; without this the wallpaper is behind it.
        parts.push(`html.${WALL} #container { background: transparent !important; }`);
    } else if (colour) {
        parts.push(`html, body { background-color: ${colour} !important; } #container { background-color: ${colour} !important; }`);
    }

    if (font) parts.push(`#container, #container * { font-family: ${font} !important; }`);

    const own = String(read('customCss') || '');
    if (own.trim()) parts.push(own);

    return parts.join('\n');
};

const watching = () => /^#?\/watch/.test(String(window.location.hash || ''));

const STYLE_ID = 'ultimatiumtube-theme';

const refreshClass = () => {
    const root = document.documentElement;
    if (!root || !root.classList) return;

    if (wallpaperOf(configRead) && !watching()) root.classList.add(WALL);
    else root.classList.remove(WALL);
};

const apply = () => {
    const parent = document.head || document.documentElement;
    if (!parent) return;

    const existing = document.getElementById(STYLE_ID);
    const style = existing || document.createElement('style');

    style.id = STYLE_ID;
    style.textContent = themeCss(configRead);

    // Last in the head, so what it says wins over what the page said.
    if (!existing || existing !== parent.lastChild) parent.appendChild(style);

    refreshClass();
};

const THEME_KEYS = ['themeWallpaperOn', 'themeWallpaper', 'themeWallpaperUrl', 'themeDim', 'themeBackground', 'themeAccent',
    'themeFont', 'customCss'];

const start = () => {
    apply();

    configChangeEmitter.addEventListener('configChange', (event) => {
        if (THEME_KEYS.indexOf(event.detail.key) !== -1) apply();
    });

    // The wallpaper steps aside while a video plays, and comes back after.
    window.addEventListener('hashchange', refreshClass);

    // The page adds its own styles as it loads; ours goes back to the end once it has settled.
    window.addEventListener('load', apply);
};

export { themeCss, wallpaperOf, WALL, WALLPAPER_FILES, WALLPAPERS, BACKGROUNDS, ACCENTS, FONTS, start };
