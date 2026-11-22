import { buttonItem, configRead, configWrite, onKey, overlayPanelItemListRenderer, showModal, whenVideo } from '../../framework/index.js';
import { currentChannel, normal } from '../channels/index.js';

// Blue is one of the remote buttons now (mods/remoteKeys), set to the speed menu unless changed.
const SPEED_KEYS = [191];

const MAX_SPEED = 20;
// The step setting decides the rungs up to here; beyond it each whole speed is one rung, so the
// menu reaches 20x without being a hundred rows long.
const FINE_UNTIL = 4;
const DEFAULT_INCREMENT = 0.25;
const STUTTER_FIX = 1.0001;

const round = (value) => Math.round(value * 100) / 100;

// Above what YouTube's own menu offers, each speed carries UltimatiumTube's name beneath it.
const YOUTUBE_TOP = 2;
const LABEL = 'UltimatiumTube';

// A video engine plays up to a top of its own (16x in Chromium, less in some); faster than that, the
// video plays at the engine's top and is moved on by the rest four times a second.
const BOOST_EVERY = 250;

const stopBoost = (video) => {
    if (video.__tubeBoost) clearInterval(video.__tubeBoost);
    video.__tubeBoost = null;
};

const setSpeed = (video, speed) => {
    if (!video) return;
    const wanted = Number(speed) > 0 ? Number(speed) : 1;

    stopBoost(video);
    video.__tubeSpeed = wanted;
    try {
        video.playbackRate = wanted;
    } catch (error) {
        try {
            video.playbackRate = 16;
        } catch (again) {
            // The rate it has stays.
        }
    }

    const played = video.playbackRate || 1;
    if (wanted <= played + 0.01) return;

    video.__tubeBoost = setInterval(() => {
        if (video.__tubeSpeed !== wanted) {
            stopBoost(video);
            return;
        }
        if (video.paused || video.seeking || video.readyState < 2) return;
        const ahead = video.currentTime + (wanted - (video.playbackRate || 1)) * (BOOST_EVERY / 1000);
        video.currentTime = video.duration > 0 ? Math.min(ahead, video.duration - 0.1) : ahead;
    }, BOOST_EVERY);
};

const currentRate = () => {
    /** @type {any} */
    const video = document.querySelector('video');
    if (video && video.__tubeBoost && video.__tubeSpeed) return round(video.__tubeSpeed);
    if (video && video.playbackRate > 0) return round(video.playbackRate);

    return configRead('rememberPlaybackSpeed') ? configRead('videoSpeed') : 1;
};

const speedButton = (speed, title = `${speed}x`) => buttonItem(speed > YOUTUBE_TOP && title === `${speed}x`
    ? { title, subtitle: LABEL } : { title }, null, [
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
        { title: 'Playback Speed', subtitle: `${LABEL} \u00b7 up to ${MAX_SPEED}x` },
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
        stopBoost(video);
        video.__tubeSpeed = undefined;
    });

    video.addEventListener('canplay', () => {
        const forChannel = configRead('rememberChannelSpeed') ? channelSpeed() : undefined;

        if (forChannel) {
            setSpeed(video, forChannel);
            return;
        }

        if (configRead('rememberPlaybackSpeed')) {
            setSpeed(video, configRead('videoSpeed'));
            return;
        }

        const wanted = configRead('defaultPlaybackSpeed');
        if (held.defaulted || !wanted || wanted === 1) return;

        held.defaulted = true;
        setSpeed(video, wanted);
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

export { openSpeedOptions, rememberSpeedForChannel, setSpeed, speedLadder, start, MAX_SPEED };
