import { configRead, showToast } from '../../framework/index.js';

// Opening Aniultimatium. Where there is a way that shows it properly, that is used first:
//  - the Android app opens it in a screen of its own;
//  - on a Samsung TV, Aniultimatium's own app, if installed, is started by the service, and runs in
//    the TV's web engine, which draws it as intended;
//  - otherwise the copy bundled here, a page of the service. It is shown by YouTube's TV engine,
//    which supports less of the web than Aniultimatium's styles ask for, so it may look wrong.

const BUILT_IN = '/aniultimatium/index.html';
const LAUNCH = '/__tube/launch?app=';

const TITLE = 'AniUltimatium';

const viaApp = () => {
    const bridge = window.UltimatiumNative;
    if (!bridge) return 'absent';

    try {
        if (!bridge.openAni) return 'old';

        bridge.openAni();
        return 'opened';
    } catch (error) {
        return 'old';
    }
};

const startInstalled = (id) => fetch(`${LAUNCH}${encodeURIComponent(id)}`, { method: 'POST', headers: { 'X-Tube': '1' } })
    .then((response) => response.json())
    .then((answer) => !!(answer && answer.ok))
    .catch(() => false);

const openBuiltIn = () => window.location.assign(BUILT_IN);

const openAniUltimatium = () => {
    const app = viaApp();

    if (app === 'opened') return Promise.resolve('app');
    if (app === 'old') {
        showToast(TITLE, 'This version of the app cannot open it. Install the latest UltimatiumTube');
        return Promise.resolve('old');
    }

    showToast(TITLE, 'Opening...');

    return startInstalled(configRead('aniUltimatiumAppId')).then((started) => {
        if (started) return 'installed';

        showToast(TITLE, 'Its own app is not installed on this TV, so the copy inside UltimatiumTube opens. It may not look right here');
        setTimeout(openBuiltIn, 2500);

        return 'built-in';
    });
};

export { openAniUltimatium, BUILT_IN, LAUNCH };
