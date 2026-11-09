import assert from 'assert';
import { check, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined };

const { WELCOME, WHATS_NEW } = await import('../../mods/notice/index.js');
const { configDefaults } = await import('../../framework/runtime/config.js');

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

finish();
