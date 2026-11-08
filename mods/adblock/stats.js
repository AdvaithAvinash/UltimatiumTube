import { configRead, configWrite, every } from '../../framework/index.js';

// How many adverts were taken out, and how many times playback was asked for without adverts. Counted
// in memory and written to the settings now and then, so a feed full of answers does not write the
// settings (which the phone page follows) once for each one.

const pending = { ads: 0, requests: 0 };

const FLUSH_EVERY = 20000;

const flush = () => {
    if (!pending.ads && !pending.requests) return;

    configWrite('adsBlockedCount', (configRead('adsBlockedCount') || 0) + pending.ads);
    configWrite('adRequestsBlocked', (configRead('adRequestsBlocked') || 0) + pending.requests);
    pending.ads = 0;
    pending.requests = 0;
};

const countAds = (n) => {
    if (n > 0) pending.ads += n;
};

const countRequest = () => {
    pending.requests += 1;
};

const started = { yes: false };

const startCounting = () => {
    if (started.yes) return;
    started.yes = true;
    every('ad statistics', FLUSH_EVERY, flush);
};

const adSummary = () => {
    const ads = (configRead('adsBlockedCount') || 0) + pending.ads;
    const requests = (configRead('adRequestsBlocked') || 0) + pending.requests;
    return `${ads} ${ads === 1 ? 'advert' : 'adverts'} removed, ${requests} ${requests === 1 ? 'video' : 'videos'} asked for without adverts`;
};

export { countAds, countRequest, flush, adSummary, startCounting };
