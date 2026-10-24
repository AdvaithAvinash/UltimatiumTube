import { buttonItem, configRead, configWrite, onKey, overlayPanelItemListRenderer, showModal, whenVideo } from '../../framework/index.js';
import { currentChannel, normal } from '../channels/index.js';

const SPEED_KEYS = [406, 191];

const MAX_SPEED = 5;
const DEFAULT_INCREMENT = 0.25;
const STUTTER_FIX = 1.0001;

const round = (value) => Math.round(value * 100) / 100;

const currentRate = () => {
    const video = document.querySelector('video');
    if (video && video.playbackRate > 0) return round(video.playbackRate);

    return configRead('rememberPlaybackSpeed') ? configRead('videoSpeed') : 1;
};

const speedButton = (speed, title = `${speed}x`) => buttonItem({ title }, null, [
    { signalAction: { signal: 'POPUP_BACK' } },
    {
        setClientSettingEndpoint: {
            settingDatas: [{ clientSettingEnum: { item: 'videoSpeed' }, intValue: speed.toString() }]
        }
    },
    { customAction: { action: 'SET_PLAYER_SPEED', parameters: speed.toString() } }
]);

const speedLadder = () => {
    const increment = configRead('speedSettingsIncrement') || DEFAULT_INCREMENT;
    const rungs = Math.floor(MAX_SPEED / increment);

    return Array.from({ length: rungs }, (_, step) => round((step + 1) * increment));
};

function openSpeedOptions() {
    const rungs = speedLadder();
    const chosen = rungs.indexOf(currentRate());
    const buttons = rungs.map((speed) => speedButton(speed))
        .concat([speedButton(STUTTER_FIX, `Fix stuttering (${STUTTER_FIX}x)`)]);

    showModal(
        'Playback Speed',
        overlayPanelItemListRenderer(buttons, chosen === -1 ? 0 : chosen),
        'options-speed'
    );
}

// Keyed by the lower-cased name, so a channel that changes its capitals keeps its speed.
const channelSpeed = () => {
    const channel = currentChannel();
    const speeds = configRead('channelSpeeds') || {};

    return channel ? speeds[normal(channel)] : undefined;
};

// A speed set on a video is that channel's from now on; 1x forgets it, which is what stock plays at.
const rememberSpeedForChannel = (speed) => {
    const channel = currentChannel();
    if (!configRead('rememberChannelSpeed') || !channel) return;

    const kept = Object.assign({}, configRead('channelSpeeds'));

    if (speed === 1) delete kept[normal(channel)];
    else kept[normal(channel)] = speed;

    configWrite('channelSpeeds', kept);
};

const rememberSpeed = (video) => {
    video.addEventListener('canplay', () => {
        const forChannel = configRead('rememberChannelSpeed') ? channelSpeed() : undefined;

        if (forChannel) {
            video.playbackRate = forChannel;
            return;
        }

        if (!configRead('rememberPlaybackSpeed')) return;
        video.playbackRate = configRead('videoSpeed');
    });
};

// Returning true swallows all three event types, but only keydown opens the menu.
const claimSpeedKeys = () => onKey('playback speed', SPEED_KEYS, (event) => {
    if (event.type === 'keydown') openSpeedOptions();
    return true;
});

const start = () => {
    claimSpeedKeys();
    whenVideo('playback speed', rememberSpeed);
};

export { openSpeedOptions, rememberSpeedForChannel, start };
