// Back at the start of the app asks before leaving.

import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

const shown = [];
const resolved = [];

global.window._yttv = { router: { instance: { resolveCommand: (command) => {
    if (command.openPopupAction) shown.push(command);
    else resolved.push(command);
} } } };

global.setTimeout = () => 0;

const { PASS } = await import('../../framework/index.js');
const { askToExit, interpretExit, leaveConfirmed, leaveOrAsk, EXIT_CONFIRMED } = await import('../../mods/exitConfirm/index.js');
const { GROUPS } = await import('../../mods/settings/settingsModel.js');

const EXIT = { signalAction: { signal: 'EXIT_APP' } };

const modalOf = (command) => command.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer
    .actionPanel.overlayPanelRenderer;

const buttons = (command) => modalOf(command).content.overlayPanelItemListRenderer.items.map((item) => item.compactLinkRenderer);

const reset = () => {
    shown.length = 0;
    resolved.length = 0;
};

check('leaving is held back, and asked about', () => {
    reset();

    assert.strictEqual(interpretExit(EXIT), true);
    assert.strictEqual(shown.length, 1, 'nothing was asked');
    assert.strictEqual(modalOf(shown[0]).header.overlayPanelHeaderRenderer.title.simpleText, 'Exit UltimatiumTube?');
});

check('the question has Stay first, and Exit', () => {
    reset();
    askToExit();

    const [stay, exit] = buttons(shown[0]);

    assert.strictEqual(stay.title.simpleText, 'Stay');
    assert.strictEqual(exit.title.simpleText, 'Exit');
    assert.strictEqual(modalOf(shown[0]).content.overlayPanelItemListRenderer.selectedIndex, 0, 'Exit is where the focus starts');
});

check('Stay only closes the question', () => {
    reset();
    askToExit();

    const commands = buttons(shown[0])[0].serviceEndpoint.commandExecutorCommand.commands;
    assert.deepStrictEqual(commands, [{ signalAction: { signal: 'POPUP_BACK' } }]);
});

check('Exit closes the question and sends the answer', () => {
    reset();
    askToExit();

    const commands = buttons(shown[0])[1].serviceEndpoint.commandExecutorCommand.commands;
    assert.strictEqual(commands[0].signalAction.signal, 'POPUP_BACK');
    assert.strictEqual(commands[1].customAction.action, EXIT_CONFIRMED);
});

check('after Exit, the command goes round again and is let through, once', () => {
    reset();

    leaveConfirmed();
    assert.deepStrictEqual(resolved, [EXIT], 'the exit was not sent again');

    assert.strictEqual(interpretExit(EXIT), PASS, 'the confirmed exit was held back again');
    assert.strictEqual(interpretExit(EXIT), true, 'a second one went through without asking');
    assert.strictEqual(shown.length, 1);
});

check('in the Android app, Exit also tells the app to close', () => {
    reset();
    const told = [];
    global.window.UltimatiumNative = { exit: () => told.push(1) };

    leaveConfirmed();
    delete global.window.UltimatiumNative;

    assert.strictEqual(told.length, 1);
    assert.deepStrictEqual(resolved, [EXIT]);
});

check('a bridge that fails does not stop the exit', () => {
    reset();
    global.window.UltimatiumNative = { exit: () => { throw new Error('gone'); } };

    leaveConfirmed();
    delete global.window.UltimatiumNative;

    assert.deepStrictEqual(resolved, [EXIT]);
});

check('with the setting off, nothing is held back', () => {
    reset();

    withConfig({ confirmExit: false }, () => assert.strictEqual(interpretExit(EXIT), PASS));
    assert.strictEqual(shown.length, 0);
});

check('other commands, and other signals, are not its business', () => {
    reset();

    assert.strictEqual(interpretExit({ signalAction: { signal: 'POPUP_BACK' } }), PASS);
    assert.strictEqual(interpretExit({ watchEndpoint: { videoId: 'x' } }), PASS);
    assert.strictEqual(interpretExit({ signalAction: {} }), PASS);
    assert.strictEqual(shown.length, 0);
});

check('the shortcut that leaves past the interpreters asks too', () => {
    reset();
    const direct = [];

    leaveOrAsk(function (command) { direct.push(command); }, {}, {});
    assert.strictEqual(direct.length, 0, 'it left without asking');
    assert.strictEqual(shown.length, 1);
});

check('and leaves at once when asking is off', () => {
    reset();
    const direct = [];

    withConfig({ confirmExit: false }, () => leaveOrAsk(function (command) { direct.push(command); }, {}, {}));
    assert.deepStrictEqual(direct, [EXIT]);
    assert.strictEqual(shown.length, 0);
});

check('it is on by default, and a switch in Startup turns it off', () => {
    const startup = GROUPS.find((group) => group.id === 'tube_startup');
    const item = startup.items.find((one) => one.key === 'confirmExit');

    assert.ok(item, 'no switch');
    assert.strictEqual(item.kind, 'switch');
    assert.strictEqual(item.on, true);
});

finish();
