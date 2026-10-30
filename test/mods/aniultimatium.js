// Opening Aniultimatium: the app's own screen, Aniultimatium's own Samsung app, then the copy inside.

import assert from 'assert';
import '../harness.js';

const results = [];

const check = async (name, run) => {
    try {
        await run();
        results.push(true);
        console.log(`PASS  ${name}`);
    } catch (failure) {
        results.push(false);
        console.log(`FAIL  ${name}\n      ${String(failure.message).split('\n').slice(0, 5).join('\n      ')}`);
    }
};

const navigations = [];
const fetches = [];
const toasts = [];

global.window.location = { assign: (url) => navigations.push(url) };
global.window._yttv = { router: { instance: { resolveCommand: (command) => toasts.push(command) } } };

// The wait before the copy opens is not waited for here.
global.setTimeout = (run) => { run(); return 0; };

const answering = (body) => {
    global.fetch = (url, init) => {
        fetches.push({ url, init });
        return body instanceof Error ? Promise.reject(body) : Promise.resolve({ json: () => Promise.resolve(body) });
    };
};

const reset = () => {
    navigations.length = 0;
    fetches.length = 0;
    toasts.length = 0;
    delete global.window.UltimatiumNative;
};

const { openAniUltimatium } = await import('../../mods/aniultimatium/index.js');

const toastText = () => toasts.map((command) => command.openPopupAction.popup.overlayToastRenderer.subtitle.simpleText);

const run = async (body, bridge) => {
    reset();
    answering(body);
    if (bridge) global.window.UltimatiumNative = bridge;

    return openAniUltimatium();
};

await check('the Android app opens it in its own screen, and nothing else happens', async () => {
    const opened = [];
    const how = await run({ ok: true }, { openAni: () => opened.push(1) });

    assert.strictEqual(how, 'app');
    assert.strictEqual(opened.length, 1);
    assert.strictEqual(fetches.length, 0);
    assert.strictEqual(navigations.length, 0);
});

await check('an app too old to open it says so, rather than opening a page that is not there', async () => {
    const how = await run({ ok: true }, { exit: () => undefined });

    assert.strictEqual(how, 'old');
    assert.strictEqual(navigations.length, 0);
    assert.ok(toastText().some((text) => text.indexOf('Install the latest') !== -1), toastText().join('|'));
});

await check('a bridge that throws is treated the same', async () => {
    const how = await run({ ok: true }, { openAni: () => { throw new Error('no'); } });

    assert.strictEqual(how, 'old');
    assert.strictEqual(navigations.length, 0);
});

await check('on a Samsung TV its own app is asked for first, by the id in the settings', async () => {
    const how = await run({ ok: true });

    assert.strictEqual(how, 'installed');
    assert.strictEqual(fetches.length, 1);
    assert.strictEqual(fetches[0].url, '/__tube/launch?app=oXabc12345.EnglishAnime');
    assert.strictEqual(fetches[0].init.method, 'POST');
    assert.strictEqual(fetches[0].init.headers['X-Tube'], '1');
    assert.strictEqual(navigations.length, 0, 'the page was left even though the app started');
});

await check('another id in the settings is the one asked for', async () => {
    const before = (await import('../../framework/runtime/config.js')).configRead('aniUltimatiumAppId');
    const { configWrite } = await import('../../framework/runtime/config.js');

    configWrite('aniUltimatiumAppId', 'abcdefghij.Other');
    await run({ ok: true });
    configWrite('aniUltimatiumAppId', before);

    assert.strictEqual(fetches[0].url, '/__tube/launch?app=abcdefghij.Other');
});

await check('with the app not installed, the copy inside opens, and the viewer is told why', async () => {
    const how = await run({ ok: false, reason: 'not installed' });

    assert.strictEqual(how, 'built-in');
    assert.deepStrictEqual(navigations, ['/aniultimatium/index.html']);
    assert.ok(toastText().some((text) => text.indexOf('not installed') !== -1), toastText().join('|'));
});

await check('the same when the service cannot be reached', async () => {
    const how = await run(new Error('network'));

    assert.strictEqual(how, 'built-in');
    assert.deepStrictEqual(navigations, ['/aniultimatium/index.html']);
});

await check('and when it answers with something that is not an answer', async () => {
    const how = await run(null);

    assert.strictEqual(how, 'built-in');
    assert.deepStrictEqual(navigations, ['/aniultimatium/index.html']);
});

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
