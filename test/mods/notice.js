import assert from 'assert';
import { check, finish } from '../harness.js';

const made = [];
const fakeElement = () => {
    const node = { style: {}, innerHTML: '', parentNode: null, querySelectorAll: () => [], removeChild: () => undefined };
    made.push(node);
    return node;
};
global.document = {
    querySelector: () => null, addEventListener: () => undefined, getElementById: () => null,
    createElement: fakeElement,
    body: { appendChild: (node) => { node.parentNode = global.document.body; }, removeChild: () => undefined }
};
global.window = global.window || { addEventListener: () => undefined };

const { WELCOME, WHATS_NEW, CHOOSER, choose, showChooser, firstPanel, state } = await import('../../mods/notice/index.js');
const { configDefaults, configRead, configWrite } = await import('../../framework/runtime/config.js');

check('the welcome message is the developer\'s, and shows until "Don\'t show again"', () => {
    assert.ok(/Dev of UltimatiumTube here/.test(WELCOME[0]));
    assert.ok(WELCOME.some((line) => /make UltimatiumTube my priority/.test(line)));
    assert.strictEqual(configDefaults().welcomeHidden, false);
});

check('What\'s new names the features of this version', () => {
    const names = WHATS_NEW.map((row) => row[0]);
    ['Universal Media Control Center', 'Playback profiles', 'A-B repeat', 'User profiles and Guest mode', 'Content intelligence']
        .forEach((name) => assert.ok(names.indexOf(name) !== -1, name));
});

check('the app opens on Welcome to UltimatiumTube and a choice of three modes: UltimatiumTube, SmartTube UI, YT Dummy', () => {
    const named = CHOOSER.filter(Array.isArray).map((row) => row[0]);
    assert.deepStrictEqual(named, ['UltimatiumTube', 'SmartTube UI', 'YT Dummy']);
    assert.strictEqual(configDefaults().uiChosen, false);
});

check('choosing SmartTube UI puts that mode on and asks no more', () => {
    choose('smarttube');
    assert.strictEqual(configRead('uiMode'), 'smarttube');
    assert.strictEqual(configRead('themeAccent'), 'red');
    assert.strictEqual(configRead('uiChosen'), true);
});

check('choosing Stock YouTube UI after it takes the stock mode, with the own setup kept from before', () => {
    choose('stock');
    assert.strictEqual(configRead('uiMode'), 'stock');
    assert.strictEqual(configRead('themeBackground'), 'default');
    assert.strictEqual(configRead('uiModeSaved').themeAccent, 'blue');
});

check('choosing the interface already on keeps it as it is, with what was changed in it since', () => {
    configWrite('themeAccent', 'green');
    choose('stock');
    assert.strictEqual(configRead('themeAccent'), 'green');
});

check('the welcome can be closed: Close, and Don\u2019t show again, beside the three modes', () => {
    showChooser();
    assert.deepStrictEqual(state.buttons.map((b) => b.label), ['UltimatiumTube', 'SmartTube UI', 'YT Dummy', 'Close', 'Don\u2019t show again']);
    assert.ok(state.open, 'the panel is open');
});

check('Don\u2019t show again keeps it from opening when the app opens, until switched back on in the settings', () => {
    configWrite('welcomeHidden', false);
    assert.ok(firstPanel(), 'shown while not hidden');
    const dont = state.buttons.filter((b) => /show again/.test(b.label))[0];
    dont.run();
    assert.strictEqual(configRead('welcomeHidden'), true);
    assert.strictEqual(firstPanel(), null);
    configWrite('welcomeHidden', false);
    assert.ok(firstPanel());
});

finish();
