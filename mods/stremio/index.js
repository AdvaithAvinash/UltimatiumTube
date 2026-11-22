import { pageHost, servicePath, showToast } from '../../framework/index.js';

// Opening the Stremio page: the movie and series screens that use Stremio addons. It is a page
// bundled in the app: on Android a screen of its own, on a Samsung TV a page of the service.

const PAGE = '/stremio/index.html';
const TITLE = 'Stremio addons';

const viaApp = () => {
    const bridge = window.UltimatiumNative;
    if (!bridge) return 'absent';

    try {
        if (!bridge.openStremio) return 'old';

        bridge.openStremio();
        return 'opened';
    } catch (error) {
        return 'old';
    }
};

const openStremio = () => {
    const app = viaApp();

    if (app === 'opened') return 'app';
    if (app === 'old') {
        showToast(TITLE, 'This version of the app cannot open it. Install the latest UltimatiumTube');
        return 'old';
    }

    // In the TV's own engine YouTube's page is ours only while it stays open, so the Stremio page,
    // a page of the service, opens in a window of its own over it and closes back to YouTube.
    if (pageHost() === 'wrt') {
        const opened = openWindow(servicePath(PAGE));
        if (!opened) showToast(TITLE, 'The Stremio page needs the app\u2019s service. Turn the TV off and on again');
        return opened ? 'window' : 'none';
    }

    window.location.assign(PAGE);
    return 'page';
};

const openWindow = (url) => {
    try {
        return window.open(url, 'stremio');
    } catch (error) {
        return null;
    }
};

// What the Stremio page asks for as it closes: a video, or a screen, of YouTube's.
const fromStremio = (event) => {
    const data = event && event.data;
    if (!data || data.tube !== 'youtube' || typeof data.path !== 'string') return;

    const at = data.path.indexOf('#');
    if (at !== -1) window.location.hash = data.path.slice(at + 1);
};

if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('message', fromStremio);

export { openStremio, PAGE };
