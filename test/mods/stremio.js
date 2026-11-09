import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined };

const shown = [];
global.window = { location: { assign: (address) => shown.push(address) }, addEventListener: () => undefined };

const { openStremio, PAGE } = await import('../../mods/stremio/index.js');
const { GROUPS } = await import('../../mods/settings/settingsModel.js');

const group = () => GROUPS.filter((one) => one.id === 'tube_stremio')[0];

check('without the Android app, the page of the service is opened', () => {
    shown.length = 0;
    assert.strictEqual(openStremio(), 'page');
    assert.deepStrictEqual(shown, [PAGE]);
});

check('with the Android app, its own screen is opened instead', () => {
    const calls = [];
    global.window.UltimatiumNative = { openStremio: () => calls.push('opened') };
    shown.length = 0;

    assert.strictEqual(openStremio(), 'app');
    assert.deepStrictEqual(calls, ['opened']);
    assert.deepStrictEqual(shown, []);
    delete global.window.UltimatiumNative;
});

check('an app that is too old is told so, and nothing else happens', () => {
    global.window.UltimatiumNative = { exit: () => undefined };
    shown.length = 0;

    assert.strictEqual(openStremio(), 'old');
    assert.deepStrictEqual(shown, []);
    delete global.window.UltimatiumNative;
});

check('the settings offer Stremio behind the Ultimate row, with the addon list typed on the phone', () => {
    assert.ok(group().ultimate);
    withConfig({ enableStremio: true }, () => {
        assert.deepStrictEqual(group().items.map((item) => item.key), ['enableStremio', 'openStremio', 'stremioAddons', 'smartPlaylists', 'aniUltimatiumAppId', 'grayjayPlugins']);
    });
    withConfig({ enableStremio: false }, () => {
        assert.deepStrictEqual(group().items.map((item) => item.key), ['enableStremio']);
    });
});

finish();
