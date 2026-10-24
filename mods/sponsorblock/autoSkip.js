import { configRead, showToast } from '../../framework/index.js';
import { currentChannel, isListed } from '../channels/index.js';
import { nameOf } from './segments.js';
import { repeatGuard } from './repeatGuard.js';
import { recordSkip } from './stats.js';

const LEAD = 0.3;

// Seeking flush with the video end triggers the end screen, so stop short of it.
const TAIL = 1;

// setTimeout can land a few milliseconds before the playhead does.
const EARLY = 0.05;

const announce = (text) => {
    if (configRead('enableSponsorBlockToasts')) showToast('SponsorBlock', text);
};

// `skippable`, `manualOnly` and `quiet` are read once per video; a change applies from the next one.
// The minimum length and the exempt channels are read each time, so they apply at once.
const autoSkipper = (segments, skippable, manualOnly, quiet = []) => {
    const held = { video: null, timeout: null, unmuteTimer: null, active: true, muting: null, wasMuted: false };
    const repeats = repeatGuard();

    const watch = (video) => {
        held.video = video;
    };

    const lengthOf = (segment) => segment.segment[1] - segment.segment[0];

    // The API's own mute action is honoured whatever the category, as is a category the viewer
    // chose to mute.
    const mutes = (segment) => segment.actionType === 'mute' || quiet.indexOf(segment.category) !== -1;

    const exempt = () => isListed(configRead('sponsorBlockExemptChannels'), currentChannel());

    const acts = (segment) => skippable.indexOf(segment.category) !== -1
        && lengthOf(segment) >= (configRead('sponsorBlockMinDuration') || 0)
        && (mutes(segment) || manualOnly.indexOf(segment.category) === -1);

    // Landing mid-way into a second segment that overlaps the one just skipped is jarring, so the
    // jump follows the chain of overlapping auto-skip segments out to whichever's end is furthest.
    // Recurses because one pass only reaches segments that overlap the start; a segment overlapping
    // only the extended end needs a further pass to be picked up.
    const latestEndOf = (segment) => {
        const autoSkippable = segments.filter((candidate) => acts(candidate) && !mutes(candidate));

        const extend = (end) => {
            const stretched = autoSkippable.reduce((furthest, other) => {
                const [otherStart, otherEnd] = other.segment;
                return otherStart < furthest && otherEnd > furthest ? otherEnd : furthest;
            }, end);

            return stretched === end ? end : extend(stretched);
        };

        const [, end] = segment.segment;
        return extend(end);
    };

    const restore = () => {
        clearTimeout(held.unmuteTimer);
        held.unmuteTimer = null;

        if (!held.muting) return;
        held.muting = null;

        // Only undone when it was this that muted it; a viewer who muted the TV stays muted.
        if (held.video && !held.wasMuted) held.video.muted = false;
    };

    const quieten = (segment) => {
        if (held.muting === segment) return;
        restore();

        announce(`Muting ${nameOf(segment)}`);

        held.wasMuted = held.video.muted;
        held.video.muted = true;
        held.muting = segment;

        const rate = held.video.playbackRate || 1;
        const remaining = Math.max(0, segment.segment[1] - held.video.currentTime);

        held.unmuteTimer = setTimeout(() => {
            restore();
            schedule();
        }, (remaining * 1000) / rate);
    };

    // The playhead can be anywhere after a seek, so what should be muted is decided from where it is.
    const settleMute = () => {
        const now = held.video.currentTime;

        const inside = segments.find((segment) => mutes(segment) && acts(segment)
            && segment.segment[0] - EARLY <= now && now < segment.segment[1]);

        if (inside) quieten(inside);
        else restore();
    };

    const jump = (segment) => {
        const skipName = nameOf(segment);

        const judged = repeats.judge(segment.UUID, Date.now());

        if (judged.repeated) {
            if (judged.announce) {
                announce(`Not skipping ${skipName} (was skipped ${judged.count} times)`);
            }
            return;
        }

        announce(`Skipping ${skipName}`);

        const from = held.video.currentTime;
        const end = latestEndOf(segment);
        const target = held.video.duration - end < TAIL ? end - TAIL : end;

        held.video.currentTime = target;
        recordSkip(target - from);
        schedule();
    };

    // The lead counts a segment the playhead has just entered as ahead, so a seek into the middle of one still skips.
    function schedule() {
        clearTimeout(held.timeout);
        held.timeout = null;

        if (!held.active || held.video.paused) return;

        if (exempt()) {
            restore();
            return;
        }

        settleMute();

        const ahead = segments
            .filter((segment) => acts(segment)
                && segment !== held.muting
                && segment.segment[0] > held.video.currentTime - LEAD
                && segment.segment[1] > held.video.currentTime - LEAD)
            .sort((one, two) => one.segment[0] - two.segment[0]);

        if (!ahead.length) return;

        const [segment] = ahead;
        const [start] = segment.segment;

        // A setTimeout counts real time, but `start` is video time, so the wait is scaled by
        // playback rate — at 2x speed the video reaches `start` in half the real-time delay.
        const rate = held.video.playbackRate || 1;

        held.timeout = setTimeout(() => {
            if (held.video.paused) return;
            if (exempt() || !acts(segment)) return schedule();

            if (mutes(segment)) {
                settleMute();
                return schedule();
            }

            return jump(segment);
        }, ((start - held.video.currentTime) * 1000) / rate);
    }

    const finish = () => {
        held.active = false;

        clearTimeout(held.timeout);
        held.timeout = null;

        restore();

        repeats.clear();
        held.video = null;
    };

    return { watch, schedule, finish };
};

export { autoSkipper };
