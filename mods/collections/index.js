import {
    buttonItem, configRead, configWrite, overlayPanelItemListRenderer, resolve, showModal, showToast
} from '../../framework/index.js';
import { currentVideo, normal } from '../channels/index.js';

// Channel collections: your channels in groups of your own (Favourites, Music, Learning, ...). A
// channel is added while one of its videos plays; a collection lists its channels, and a channel
// opens to its page. Kept in the settings, so the phone page shows them and a backup keeps them.

const TITLE = 'Collections';
const BACK = { signalAction: { signal: 'POPUP_BACK' } };

// Offered for a new collection, since names are hard to type with a remote.
const SUGGESTED = ['Favourites', 'Music', 'Learning', 'Gaming', 'News', 'Tech', 'Cooking', 'Sports', 'Kids', 'Comedy', 'Watch later'];

const collections = () => Object.assign({}, configRead('channelCollections') || {});
const names = () => Object.keys(collections());

const action = (name, parameters) => ({ customAction: { action: name, parameters } });

// While a video plays: which collection to put its channel in.
const chooseCollection = () => {
    const now = currentVideo();
    if (!now.channel) {
        showToast(TITLE, 'Start a video of the channel first');
        return;
    }

    const all = collections();
    const choices = SUGGESTED.filter((name) => !all[name]);
    const items = names().map((name) => {
        const there = (all[name] || []).some((channel) => normal(channel) === normal(now.channel));
        return buttonItem({ title: `${name}${there ? '  (already in it)' : ''}`, subtitle: `${(all[name] || []).length} channels` },
            null, [BACK, action('ADD_TO_COLLECTION', name)]);
    }).concat(choices.map((name) => buttonItem({ title: `New: ${name}` }, null, [BACK, action('ADD_TO_COLLECTION', name)])));

    showModal(`Add ${now.channel} to`, overlayPanelItemListRenderer(items, 0), 'tube-collect');
};

const addToCollection = (name) => {
    const now = currentVideo();
    if (!now.channel || !name) return;

    const all = collections();
    const list = (all[name] || []).filter((channel) => normal(channel) !== normal(now.channel));
    all[name] = [now.channel].concat(list);
    configWrite('channelCollections', all);
    showToast(TITLE, `${now.channel} is in ${name}`);
};

const openCollections = () => {
    const all = collections();
    const items = names().length
        ? names().map((name) => buttonItem({ title: name, subtitle: `${(all[name] || []).length} channels` },
            null, [BACK, action('OPEN_COLLECTION', name)]))
        : [buttonItem({ title: 'No collections yet', subtitle: 'While a video plays, use "Add this channel to a collection"' }, null, [BACK])];

    showModal(TITLE, overlayPanelItemListRenderer(items, 0), 'tube-collections');
};

const openCollection = (name) => {
    const all = collections();
    const channels = all[name] || [];
    const ids = configRead('channelIds') || {};

    const items = channels.map((channel) => {
        const id = ids[normal(channel)];
        return buttonItem({ title: channel, subtitle: id ? 'Open the channel' : 'Watch one of its videos once to open it from here' },
            null, id ? [BACK, { browseEndpoint: { browseId: id } }] : [BACK]);
    }).concat([
        buttonItem({ title: `Take the channel playing now out of ${name}` }, null, [BACK, action('REMOVE_FROM_COLLECTION', name)]),
        buttonItem({ title: `Delete the collection ${name}` }, null, [BACK, action('DELETE_COLLECTION', name)])
    ]);

    showModal(name, overlayPanelItemListRenderer(items, 0), 'tube-collection');
};

const removeFromCollection = (name) => {
    const now = currentVideo();
    const all = collections();
    if (!all[name] || !now.channel) return;
    all[name] = all[name].filter((channel) => normal(channel) !== normal(now.channel));
    configWrite('channelCollections', all);
    showToast(TITLE, `${now.channel} is out of ${name}`);
};

const deleteCollection = (name) => {
    const all = collections();
    delete all[name];
    configWrite('channelCollections', all);
    showToast(TITLE, `${name} deleted`);
};

const openChannel = (id) => resolve({ browseEndpoint: { browseId: id } });

export { chooseCollection, addToCollection, openCollections, openCollection, removeFromCollection, deleteCollection, openChannel, SUGGESTED };
