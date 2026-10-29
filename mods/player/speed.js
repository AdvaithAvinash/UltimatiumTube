import { buttonItem, configRead, configWrite, onKey, overlayPanelItemListRenderer, showModal, whenVideo } from '../../framework/index.js';
import { currentChannel, normal } from '../channels/index.js';

const SPEED_KEYS = [406, 191];

const MAX_SPEED = 15;
// The step setting decides the rungs up to here; beyond it each whole speed is one rung, so the
// menu reaches 15x without being a hundred rows long.
const FINE_UNTIL = 4;
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
    const fine = Array.from({ length: Math.floor(FINE_UNTIL / increment) }, (_, step) => round((step + 1) * increment));
    const whole = Array.from({ length: MAX_SPEED - FINE_UNTIL }, (_, step) => FINE_UNTIL + 1 + step);

    return fine.concat(whole);
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
    // The default speed is set once for each video, so a speed chosen while it plays is not undone
    // by the next time the player is ready after buffering.
    const held = { defaulted: false };

    video.addEventListener('loadstart', () => {
        held.defaulted = false;
    });

    video.addEventListener('canplay', () => {
        const forChannel = configRead('rememberChannelSpeed') ? channelSpeed() : undefined;

        if (forChannel) {
            video.playbackRate = forChannel;
            return;
        }

        if (configRead('rememberPlaybackSpeed')) {
            video.playbackRate = configRead('videoSpeed');
            return;
        }

        const wanted = configRead('defaultPlaybackSpeed');
        if (held.defaulted || !wanted || wanted === 1) return;

        held.defaulted = true;
        video.playbackRate = wanted;
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

export { openSpeedOptions, rememberSpeedForChannel, speedLadder, start };
