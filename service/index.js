'use strict';

const os = require('os');

const postmortem = require('./lib/postmortem.js');
const lastRun = require('./lib/lastRun.js');
const printed = require('./lib/printed.js');

lastRun.recall();
postmortem.watch();
printed.attach();

const ports = require('./lib/ports.js');
const { USER_SCRIPT, sized } = require('./lib/shipped.js');
const proxy = require('./lib/proxy.js');
const { STAMP } = require('./lib/stamp.js');
const { capability } = require('./lib/platform.js');
const claimants = require('./lib/claimants.js');
const bootRoutes = require('./lib/bootRoutes.js');
const journalRoutes = require('./lib/journalRoutes.js');
const diagRoutes = require('./lib/diagRoutes.js');
const phoneSettings = require('./lib/phoneSettings.js');
const stremio = require('./lib/stremio.js');
const pluginFetch = require('./lib/pluginFetch.js');
const launchApp = require('./lib/launchApp.js');
const youtubePlaylist = require('./lib/youtubePlaylist.js');
const keep = require('./lib/keep.js');
const wallpapers = require('./lib/wallpapers.js');
const routeErrors = require('./lib/routeErrors.js');
const dev = require('./dev/index.js');
const upgrade = require('./lib/upgrade.js');
const { serviceAddress } = require('./lib/serviceAddress.js');
const tender = require('./lib/tend.js');
const knobs = require('./lib/knobs.js');

// A cobalt.js that will not load must not stop the proxy starting.
const cobalt = require('./lib/cobaltIfItLoads.js')();

const isTV = typeof tizen !== 'undefined';

const containerRoute = cobalt ? cobalt.container() : null;

const platformVersion = isTV
    ? tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version')
    : (process.env.TUBE_PLATFORM_VERSION || null);

postmortem.note('platform', `tizen ${platformVersion || 'none'}, node ${process.version}, `
    + `${capability('http://tizen.org/system/model_name') || 'unknown model'}, patch ${STAMP}`);

claimants.survey();

const app = proxy.create();

// Cobalt denies a document that arrives without a Content-Security-Policy, and which policies it
// accepts varies by version.
const POLICIES = {
    wide: [
        "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
        'img-src * data: blob:',
        'media-src * data: blob:',
        "script-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
        "style-src * data: blob: 'unsafe-inline'",
        'connect-src *',
        'font-src * data:',
        // Cobalt refuses a navigation its policy does not name. Only this service's own pages are
        // named: YouTube, after a sign-in, sends the page to https://www.youtube.com/tv, which would
        // load it from YouTube itself, without UltimatiumTube, until the app was opened again. That is
        // refused now, reported (report-uri), and the userscript loads /tv from here instead.
        // HOST is filled in for each answer, as the address the page was asked for at.
        "h5vcc-location-src 'self' http://HOST",
        'report-uri /__tube/csp'
    ].join('; '),

    plain: "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; h5vcc-location-src *",

    none: null
};

const state = { policy: 'wide' };

app.use((req, res, next) => {
    const chosen = POLICIES[state.policy];
    const host = String(req.headers.host || '').replace(/[^A-Za-z0-9.:[\]-]/g, '') || '127.0.0.1';

    if (chosen) res.setHeader('Content-Security-Policy', chosen.replace('HOST', host));
    else res.removeHeader('Content-Security-Policy');

    next();
});

const userScript = () => sized(USER_SCRIPT);

app.get('/__tube/state', (_, res) => res.json({ script: userScript(), platformVersion, container: containerRoute }));

const retraceOnBoot = (line) => {
    if (line.indexOf('booted ') === 0) proxy.retrace();
};

journalRoutes.attach(app, { heard: retraceOnBoot });
bootRoutes.attach(app, { cobalt, script: userScript });
diagRoutes.attach(app);
phoneSettings.attach(app);
stremio.attach(app);
pluginFetch.attach(app);
launchApp.attach(app);
youtubePlaylist.attach(app);
keep.attach(app);

// What the engine refused under the policy above: one line in the log for each, so a navigation that
// was kept on this service shows up in /__tube/log.
app.post('/__tube/csp', (req, res) => {
    const parts = [];
    req.on('data', (chunk) => { if (parts.length < 16) parts.push(chunk); });
    req.on('end', () => {
        const text = Buffer.concat(parts).toString('utf8').slice(0, 2000);
        const blocked = /"blocked-uri"\s*:\s*"([^"]*)"/.exec(text);
        const directive = /"violated-directive"\s*:\s*"([^"]*)"/.exec(text);
        postmortem.note('policy', `refused ${blocked ? blocked[1] : '?'} (${directive ? directive[1] : '?'})`);
        res.status(204).end();
    });
});
wallpapers.attach(app);

// dev/ may not know about the container route, and on a set without one it is absent.
dev.routes(app, {
    policies: POLICIES,
    state,
    knobs,
    relaunch: cobalt ? cobalt.relaunch : null
});

dev.attach(app);
proxy.attachFallback(app);
routeErrors.attach(app);

// Every interface: the container reaches us on this set's own address, never loopback.
const BIND = '0.0.0.0';
const RETRY_LISTEN_AFTER = 5000;
const CHECK_LISTENING_EVERY = 20000;
const REPEAT_AFTER = 60000;

const repeated = { text: '', at: 0 };

// The same refusal every five seconds fills a 64KB log with itself and pushes out what explains it.
const noteRarely = (what, text) => {
    const now = Date.now();
    if (text === repeated.text && now - repeated.at < REPEAT_AFTER) return;

    repeated.text = text;
    repeated.at = now;
    postmortem.note(what, text);
};

// A LAN address still binds while another server holds the port on loopback.
const candidates = () => {
    const interfaces = os.networkInterfaces();

    return Object.keys(interfaces).reduce((found, device) => found.concat(
        interfaces[device].filter((a) => !a.internal && a.family === 'IPv4').map((a) => a.address)
    ), [BIND]);
};

const listener = require('./lib/listener.js').create({
    app,
    port: ports.PROXY,
    bind: BIND,
    addresses: candidates,
    note: postmortem.note,
    noteRarely,
    retryAfter: RETRY_LISTEN_AFTER,
    // An upgrade is not a request express ever sees, and an unanswered one hangs rather than fails.
    setup: (server) => upgrade.attach(server, { rewrite: dev.upgradeRewrite }),
    listening: (address) => {
        console.log(`tube service on ${address}:${ports.PROXY}`);
        if (!isTV) console.log('Running off-TV: proxy and userscript are live.');
    }
});

const tending = tender.create({ listener, cobalt, serviceAddress, note: postmortem.note });

const holdFor = dev.startDelay();
if (holdFor) postmortem.note('listen', `held shut for ${holdFor / 1000}s by TUBE_START_DELAY`);

setTimeout(() => {
    listener.start();

    const timer = setInterval(tending.tend, CHECK_LISTENING_EVERY);
    // Never what keeps the process alive.
    if (timer && timer.unref) timer.unref();
}, holdFor);

// Tizen's service runner calls these on every wake message, and a missing one kills the service.
module.exports = {
    onStart: () => {},

    onRequest: () => {
        // A wake (boot, standby, an install) is the moment an address or a socket may have changed.
        tending.tend();

        if (!cobalt) return;
        try { cobalt.wake(); } catch (e) { postmortem.note('cobalt', e); }
    },

    onStop: () => {}
};

// Staging a directory and issuing a certificate must not be able to stop the proxy answering.
if (cobalt) {
    try {
        cobalt.prepare();
    } catch (e) {
        postmortem.note('cobalt', `prepare threw: ${postmortem.describe(e)}`);
    }
}
