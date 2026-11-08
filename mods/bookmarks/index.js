import {
    buttonItem, configRead, configWrite, overlayPanelItemListRenderer, resolve, showModal, showToast, video
} from '../../framework/index.js';
import { currentVideo } from '../channels/index.js';

// Video bookmarks: a moment of a video, kept so it can be gone back to. Kept in the settings, so the
// phone page sees them and a backup carries them.

const MOST = 60;
const TITLE = 'Bookmarks';

const clock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const two = (n) => (n < 10 ? `0${n}` : String(n));
    return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
};

const bookmarks = () => configRead('videoBookmarks') || [];

// The moment on screen now, kept first in the list. Nothing is kept without a video.
const addBookmark = () => {
    const playing = video();
    const now = currentVideo();
    if (!playing || !now.videoId) {
        showToast(TITLE, 'Start a video first, then press it again at the moment to keep');
        return false;
    }

    const entry = {
        videoId: now.videoId,
        title: now.title || 'A video',
        channel: now.channel || '',
        t: Math.floor(playing.currentTime || 0),
        at: Date.now()
    };

    // The same moment of the same video (within five seconds) is kept once.
    const rest = bookmarks().filter((b) => !(b.videoId === entry.videoId && Math.abs(b.t - entry.t) < 5));
    configWrite('videoBookmarks', [entry].concat(rest).slice(0, MOST));
    showToast(TITLE, `Kept ${clock(entry.t)} of ${entry.title}`);
    return true;
};

const openBookmark = (index) => {
    const entry = bookmarks()[Number(index)];
    if (!entry) return;

    resolve({ watchEndpoint: { videoId: entry.videoId, startTimeSeconds: entry.t } });
};

const removeBookmark = (index) => {
    const list = bookmarks().slice();
    list.splice(Number(index), 1);
    configWrite('videoBookmarks', list);
};

const BACK = { signalAction: { signal: 'POPUP_BACK' } };

const openBookmarks = () => {
    const list = bookmarks();
    const items = list.length
        ? list.map((b, index) => buttonItem(
            { title: `${clock(b.t)}  ${b.title}`, subtitle: b.channel },
            null,
            [BACK, { customAction: { action: 'OPEN_BOOKMARK', parameters: String(index) } }]
        )).concat([
            buttonItem({ title: 'Remove the newest bookmark' }, null, [BACK, { customAction: { action: 'REMOVE_BOOKMARK', parameters: '0' } }]),
            buttonItem({ title: 'Remove all bookmarks' }, null, [BACK, { customAction: { action: 'CLEAR_BOOKMARKS', parameters: '' } }])
        ])
        : [buttonItem({ title: 'No bookmarks yet', subtitle: 'While a video plays, press the button set for "Bookmark this moment"' }, null, [BACK])];

    showModal(TITLE, overlayPanelItemListRenderer(items, 0), 'tube-bookmarks');
};

const clearBookmarks = () => {
    configWrite('videoBookmarks', []);
    showToast(TITLE, 'All bookmarks removed');
};

export { addBookmark, openBookmarks, openBookmark, removeBookmark, clearBookmarks, bookmarks, clock };
