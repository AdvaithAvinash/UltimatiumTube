import { showToast } from '../../framework/index.js';

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

    window.location.assign(PAGE);
    return 'page';
};

export { openStremio, PAGE };
