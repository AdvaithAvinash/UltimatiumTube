// Where the page runs, as the app's loader or the service tells it.
//  - 'wrt': Samsung's own web engine. The app's loader fetched YouTube's TV page and wrote it into a
//    window with this script on top; the page reads as www.youtube.com, and the app's service (the
//    extras: phone settings, wallpapers, Stremio) is at another address, if it is running.
//  - 'service': the page was served by the app's service, which is then its own origin.

const pageHost = () => (typeof window !== 'undefined' && window.__tubeHost === 'wrt' ? 'wrt' : 'service');

// A path of the app's service, as the page reaches it.
const servicePath = (path) => `${(typeof window !== 'undefined' && window.__tubeService) || ''}${path}`;

export { pageHost, servicePath };
