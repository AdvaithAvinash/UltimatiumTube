import {
    PLAYER, buttonItem, configChangeEmitter, configRead, configWrite, every, onResponse, overlayPanelItemListRenderer,
    showModal, showToast, until, waitFor, whenPlayer
} from '../../framework/index.js';
import { currentChannel, normal } from '../channels/index.js';
import { NAMED, chooseQuality } from './ladder.js';
import { rungToAsk } from './ask.js';
import { QUALITY, liftCeiling, seedPreferredQuality } from './seed.js';

// Quality lock for each channel: a channel can have its own preferred quality, which wins over the
// one set for every video.
const CHANNEL_QUALITIES = 'channelQualities';

const channelQuality = () => {
    const channel = currentChannel();
    const kept = configRead(CHANNEL_QUALITIES) || {};
    return channel ? kept[normal(channel)] : undefined;
};

const preferredNow = () => channelQuality() || configRead(QUALITY);

const LOCKABLE = ['highest', '2160', '1440', '1080', '720', '480', '360'];
const LABEL = (q) => (q === 'highest' ? 'Highest available' : `${q}p`);

const openChannelQuality = () => {
    const channel = currentChannel();
    if (!channel) {
        showToast('Quality lock', 'Start a video of the channel first');
        return;
    }

    const BACK = { signalAction: { signal: 'POPUP_BACK' } };
    const current = channelQuality();
    const items = LOCKABLE.map((q) => buttonItem({ title: LABEL(q) + (q === current ? '  (now)' : '') }, null,
        [BACK, { customAction: { action: 'SET_CHANNEL_QUALITY', parameters: q } }]))
        .concat([buttonItem({ title: 'Use the quality set for every video' }, null,
            [BACK, { customAction: { action: 'SET_CHANNEL_QUALITY', parameters: '' } }])]);

    showModal(`Quality for ${channel}`, overlayPanelItemListRenderer(items, Math.max(0, LOCKABLE.indexOf(current))), 'tube-channel-quality');
};

const setChannelQuality = (quality) => {
    const channel = currentChannel();
    if (!channel) return;

    const kept = Object.assign({}, configRead(CHANNEL_QUALITIES) || {});
    if (quality && LOCKABLE.indexOf(String(quality)) !== -1) kept[normal(channel)] = String(quality);
    else delete kept[normal(channel)];
    configWrite(CHANNEL_QUALITIES, kept);
    showToast('Quality lock', quality ? `${channel}: ${LABEL(String(quality))}` : `${channel}: the quality for every video`);
};

// Every playback starts on Auto and must be told its ceiling.

const CHECK_INTERVAL = 3000;

const SETTLING_EVERY = 250;
const SETTLING_FOR = 8000;

function watchPreferredQuality() {
    // Keyed on the cpn: a Next passes through a copy of the playback data that is then discarded.
    const held = { player: null, playback: null, asked: null };

    // Forcing 2160p on a Short spends the link on a video that was never going to show it.
    const isShorts = (player) => {
        try {
            return Object.values(player.getVideoStats()).some((value) => value === 'shortspage');
        } catch (e) {
            return false;
        }
    };

    // A preview on a shelf plays in this same player, which YouTube caps at 480p.
    const onWatchPage = () => String(location.hash).indexOf('#/watch') === 0;

    const applyPreference = (player) => {
        const data = player.getVideoData?.() || {};
        const playback = data.cpn || data.video_id;

        if (playback !== held.playback) {
            held.playback = playback;
            held.asked = null;
        }

        const preference = preferredNow();
        if (!preference || preference === 'auto') return;
        if (!onWatchPage() || isShorts(player)) return;

        const wanted = rungToAsk({
            chosen: chooseQuality(preference, player.getAvailableQualityData()),
            preferred: player.getPreferredQuality?.(),
            asked: held.asked
        });
        if (!wanted) return;

        // A ceiling, not a pin: Auto still steps down when the link cannot carry the rung.
        player.setPlaybackQualityRange('auto', wanted);
        held.asked = wanted;
    };

    // Early enough that the first segment fetched is under the right ceiling, and a rung the video
    // does not offer is corrected down once the ladder arrives.
    const capNamed = (player) => {
        const named = NAMED[parseInt(preferredNow(), 10)];
        if (!named) return;

        try {
            player.setPlaybackQualityRange('auto', named);
        } catch (e) {
            console.warn('[tube] could not cap the preferred quality:', e);
        }
    };

    const adopt = (player) => {
        if (player === held.player) return;

        held.player = player;
        player.addEventListener('onStateChange', tick);
        capNamed(player);
        tick();
    };

    const attachToPlayer = () => whenPlayer('preferred quality', adopt);

    function tick() {
        if (!held.player) return;
        if (held.player.isConnected === false) {
            held.player = null;
            waitFor(() => document.querySelector(PLAYER), adopt);
            return;
        }

        try {
            applyPreference(held.player);
        } catch (e) {
            console.warn('[tube] could not apply the preferred quality:', e);
        }
    }

    configChangeEmitter.addEventListener('configChange', (event) => {
        if (event.detail?.key !== QUALITY && event.detail?.key !== CHANNEL_QUALITIES) return;

        // So the next video opens on the new setting rather than being corrected into it.
        seedPreferredQuality();
        if (configRead(QUALITY) === 'auto') liftCeiling();
        tick();
    });

    // The heartbeat is too coarse to land between the response arriving and the player reading it,
    // and the burst runs its full length because the first playback after a Next may be discarded.
    const settleQuickly = () => until('quality settling', SETTLING_EVERY, tick, SETTLING_FOR);

    onResponse('preferred quality', ['streamingData'], settleQuickly);

    every('quality heartbeat', CHECK_INTERVAL, tick);
    attachToPlayer();
}

if (typeof window !== 'undefined') {
    seedPreferredQuality();
    window.addEventListener('hashchange', seedPreferredQuality);

    watchPreferredQuality();
}

export { openChannelQuality, setChannelQuality, channelQuality };
