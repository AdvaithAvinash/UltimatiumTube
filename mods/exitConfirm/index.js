import {
    PASS, buttonItem, configRead, overlayPanelItemListRenderer, resolve, showModal
} from '../../framework/index.js';

// Back at the start of the app asks whether to leave. YouTube leaves by the command EXIT_APP, so that
// is the command held back, and asked about; the answer Exit lets one through.

const EXIT_APP = { signalAction: { signal: 'EXIT_APP' } };
const BACK = { signalAction: { signal: 'POPUP_BACK' } };

const EXIT_CONFIRMED = 'EXIT_CONFIRMED';

// How long an answer of Exit is good for: the command it sends comes straight back.
const GOOD_FOR = 3000;

const state = { confirmed: false };

const action = (name) => ({ customAction: { action: name, parameters: {} } });

// Stay is first, so a second press of OK, or of Back, does not leave by accident.
const askToExit = () => showModal(
    { title: 'Exit UltimatiumTube?', subtitle: 'Exit leaves the app. Stay keeps you where you were.' },
    overlayPanelItemListRenderer([
        buttonItem({ title: 'Stay' }, null, [BACK]),
        buttonItem({ title: 'Exit' }, null, [BACK, action(EXIT_CONFIRMED)])
    ], 0),
    'tube-exit'
);

// The Exit button: the command goes round again, and this time is let through.
const leaveConfirmed = () => {
    state.confirmed = true;
    setTimeout(() => {
        state.confirmed = false;
    }, GOOD_FOR);

    resolve(EXIT_APP);

    // The Android app is not YouTube's own engine: it is told directly, so that Exit always leaves.
    try {
        if (window.UltimatiumNative && window.UltimatiumNative.exit) window.UltimatiumNative.exit();
    } catch (error) {
        // The command above is what a TV that is not this app acts on.
    }
};

const interpretExit = (command) => {
    const leaving = command.signalAction && command.signalAction.signal === 'EXIT_APP';
    if (!leaving || !configRead('confirmExit')) return PASS;

    if (state.confirmed) {
        state.confirmed = false;
        return PASS;
    }

    askToExit();
    return true;
};

// For the places that leave by calling the resolver straight, past the interpreters.
const leaveOrAsk = (original, self, context) => {
    if (configRead('confirmExit')) askToExit();
    else original.call(self, EXIT_APP, context);
};

export { askToExit, interpretExit, leaveConfirmed, leaveOrAsk, EXIT_CONFIRMED };
