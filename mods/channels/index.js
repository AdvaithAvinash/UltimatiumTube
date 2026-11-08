import { configRead, configWrite, onResponse } from '../../framework/index.js';

// What the player response says about the video on screen. Read at the moment a skip, a speed or
// a block is decided, so it is a lookup rather than a subscription.
const playing = { videoId: null, channel: null, title: null };

const RECENT = 30;

const rememberChannel = (name) => {
    const recent = configRead('recentChannels') || [];
    if (recent[0] === name) return;

    configWrite('recentChannels', [name].concat(recent.filter((entry) => entry !== name)).slice(0, RECENT));
};

const noteVideo = (details) => {
    if (!details || !details.author) return;

    playing.videoId = details.videoId || null;
    playing.channel = details.author;
    playing.title = details.title || null;

    rememberChannel(details.author);
};

onResponse('channel tracker', ['videoDetails'], (response) => noteVideo(response.videoDetails));

const currentChannel = () => playing.channel;
const currentVideo = () => ({ videoId: playing.videoId, channel: playing.channel, title: playing.title });

const normal = (name) => String(name || '').trim().toLowerCase();

const isListed = (list, name) => !!name && (list || []).some((entry) => normal(entry) === normal(name));

export { currentChannel, currentVideo, isListed, normal, noteVideo };
