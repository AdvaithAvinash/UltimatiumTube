import {
    buttonItem, configRead, configWrite, every, findResolver, overlayPanelItemListRenderer, showModal, stop
} from '../../framework/index.js';

// A notice, once, the first time the app opens after an install or an update that changed what it
// offers. Raise NOTICE when the text changes, and it is shown again.

const NOTICE = '1.6';

const BACK = { signalAction: { signal: 'POPUP_BACK' } };

const show = () => showModal(
    {
        title: 'UltimatiumTube',
        subtitle: 'YouTube without ads, with SponsorBlock. Movies, series and videos from Stremio addons and Grayjay plugins. '
            + 'It is all under Settings > UltimatiumTube.'
    },
    overlayPanelItemListRenderer([
        buttonItem({ title: 'OK' }, null, [BACK]),
        buttonItem({ title: 'Open Stremio and Grayjay' }, null, [BACK, { customAction: { action: 'OPEN_STREMIO', parameters: {} } }])
    ], 0),
    'tube-notice'
);

const NAME = 'startup notice';

const start = () => {
    if (configRead('noticeSeen') === NOTICE) return;

    // The page is not ready for a panel until YouTube's own commands can be sent.
    every(NAME, 1500, () => {
        if (!findResolver()) return;

        stop(NAME);
        configWrite('noticeSeen', NOTICE);
        show();
    });
};

export { start, NOTICE, show };
