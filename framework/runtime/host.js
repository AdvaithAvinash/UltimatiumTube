// Where the page runs, as the app's loader or the service tells it.
//  - 'wrt': Samsung's own web engine. The app's loader fetched YouTube's TV page and wrote it into a
//    window with this script on top; the page reads as www.youtube.com, and the app's service (the
//    extras: phone settings, wallpapers, Stremio) is at another address, if it is running.
//  - 'service': the page was served by the app's service, which is then its own origin.

const pageHost = () => (typeof window !== 'undefined' && window.__tubeHost === 'wrt' ? 'wrt' : 'service');

// A path of the app's service, as the page reaches it.
const servicePath = (path) => `${(typeof window !== 'undefined' && window.__tubeService) || ''}${path}`;

// YouTube loaded afresh with UltimatiumTube on it, at the screen it is on. In the TV's own engine the
// app's loader does it (a page reloaded by itself would come back without our script); elsewhere the
// page reloads.
const reloadPage = () => {
    const at = String(window.location.hash || '').replace(/^#/, '') || '/';
    try {
        if (pageHost() === 'wrt' && window.opener && !window.opener.closed) {
            window.opener.postMessage({ tube: 'reload', hash: at }, '*');
            return 'loader';
        }
    } catch (error) {
        // The page's own way below.
    }
    window.location.reload();
    return 'page';
};

export { pageHost, servicePath, reloadPage };
