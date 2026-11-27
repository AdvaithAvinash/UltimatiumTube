/* UltimatiumTube for Samsung TVs: YouTube's own TV app, loaded in the TV's own web engine.
 *
 * The way youtube-dummy does it: the TV app's page is fetched from www.youtube.com/tv, UltimatiumTube's
 * script is put at the top of it, and it is written into a window of this app. There is no container to
 * start and nothing on the TV the page has to reach before YouTube shows: if YouTube answers, the app
 * works. The app's service, where it runs, only adds the extras (phone settings, wallpapers, Stremio).
 *
 * Written for the oldest engine it may meet (Tizen 3): no arrow functions, no let, no template strings.
 */

var YOUTUBE = 'https://www.youtube.com/tv';
var SERVICE = 'http://127.0.0.1:8189';
var RETRY_AFTER = 5000;
var WATCH_EVERY = 1500;

var KEYS = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
    'MediaTrackPrevious', 'MediaTrackNext', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
    'Exit', 'Info', 'Caption', 'Search', 'Guide'];

var loader = { app: null, script: null, hash: '/', tries: 0, writing: false, written: false, writtenAt: 0, windows: 0,
    bundled: null, build: { version: '0', flavor: 'modern' }, flavour: 'browser', loads: 0, serviceDown: false, woke: '', using: 'bundled', version: '0' };

// Self-updating, as youtube-dummy keeps TizenTube's script current: UltimatiumTube's script is
// published with each version under updates/ in its GitHub repository. Once YouTube is open, the app
// asks for the newest; one newer than its own is kept on the TV and used from the next time the app
// opens. A kept script that does not start is dropped, and the app's own is used again.
var UPDATES = [
    'https://raw.githubusercontent.com/AdvaithAvinash/UltimatiumTube/main/updates/',
    'https://cdn.jsdelivr.net/gh/AdvaithAvinash/UltimatiumTube@main/updates/'
];
// What a published script expects of this loader; a script for another one is never taken.
var PROTOCOL = 1;
var CHECK_AFTER = 20000;
var STARTS_WITHIN = 30000;
var KEPT = 'tube.update.';

var LOADING = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>UltimatiumTube</title></head>'
    + '<body style="margin:0;background:#000;color:#e8e8e8;font-family:Arial,sans-serif;overflow:hidden">'
    + '<div id="say" style="position:absolute;left:0;right:0;top:42%;text-align:center;font-size:44px;font-weight:bold">UltimatiumTube</div>'
    + '<div id="detail" style="position:absolute;left:0;right:0;top:53%;text-align:center;font-size:26px;color:#9a9a9a"></div>'
    + '</body></html>';

// On the loading screen, in this page and in the app's window while YouTube is not in it yet.
function say(main, detail) {
    [document, loader.app && !loader.written ? safeDocument(loader.app) : null].forEach(function (doc) {
        if (!doc) return;
        var top = doc.getElementById('say');
        var below = doc.getElementById('detail');
        if (top) top.textContent = main;
        if (below) below.textContent = detail || '';
    });
}

function safeDocument(target) {
    try {
        return target.document;
    } catch (error) {
        return null;
    }
}

function registerKeys() {
    if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;
    KEYS.forEach(function (name) {
        try {
            tizen.tvinputdevice.registerKey(name);
        } catch (error) {
            // A key this remote does not have.
        }
    });
}

function exitApp() {
    try {
        if (loader.app && !loader.app.closed) loader.app.close();
    } catch (error) {
        // Gone already.
    }
    setTimeout(function () {
        try {
            tizen.application.getCurrentApplication().exit();
        } catch (error) {
            window.close();
        }
    }, 150);
}

// A file of the app itself. An engine answers status 0 for a packaged file, with the text.
function get(url, done, within) {
    var request = new XMLHttpRequest();
    var answered = false;
    var answer = function (text) {
        if (answered) return;
        answered = true;
        done(text);
    };

    request.onreadystatechange = function () {
        if (request.readyState !== 4) return;
        var ok = (request.status >= 200 && request.status < 300) || (request.status === 0 && request.responseText);
        answer(ok ? request.responseText : null);
    };
    request.onerror = function () { answer(null); };
    request.timeout = within || 20000;
    request.ontimeout = function () { answer(null); };

    try {
        request.open('GET', url, true);
        request.send();
    } catch (error) {
        answer(null);
    }
}

// Run first in YouTube's page, before any of YouTube's own scripts: the page is told it is
// www.youtube.com, and where the app's service is.
// What the script uses that an older engine may lack (Tizen 3 to 5.5 are Chromium 47 to 69).
var POLYFILLS = 'if (!Object.values) Object.values = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };'
    + 'if (!Object.entries) Object.entries = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); };'
    + 'if (!Object.fromEntries) Object.fromEntries = function (l) { var o = {}; Array.prototype.forEach.call(l, function (e) { o[e[0]] = e[1]; }); return o; };'
    + 'if (window.Promise && !Promise.prototype.finally) Promise.prototype.finally = function (f) {'
    + '  return this.then(function (v) { return Promise.resolve(f()).then(function () { return v; }); },'
    + '    function (e) { return Promise.resolve(f()).then(function () { throw e; }); }); };'
    + 'if (!Array.prototype.flat) Array.prototype.flat = function (d) { d = d === undefined ? 1 : d;'
    + '  return this.reduce(function (a, v) { return a.concat(Array.isArray(v) && d > 0 ? v.flat(d - 1) : [v]); }, []); };'
    + 'if (!Array.prototype.flatMap) Array.prototype.flatMap = function (f, t) { return this.map(f, t).flat(); };'
    + 'if (!String.prototype.padStart) String.prototype.padStart = function (n, p) { var s = String(this), f = "";'
    + '  p = p === undefined ? " " : String(p); if (!p) return s; while (f.length < n - s.length) f += p; return f.slice(0, Math.max(0, n - s.length)) + s; };';

function prelude(hash) {
    return POLYFILLS
        + 'history.replaceState({}, "", ' + JSON.stringify(YOUTUBE + '#' + hash) + ');'
        + 'window.__tubeHost = "wrt";'
        + 'window.__tubeFlavour = ' + JSON.stringify(loader.flavour) + ';'
        + 'window.__tubeFirstLoad = ' + (loader.loads === 1 ? 'true' : 'false') + ';'
        + 'window.__tubeServiceDown = ' + (loader.serviceDown ? 'true' : 'false') + ';'
        + 'window.__tubeStarted = false;'
        + 'window.__tubeService = ' + JSON.stringify(SERVICE) + ';'
        + 'document.addEventListener("keydown", function (event) {'
        + '  if (event.keyCode === 10182) { try { window.opener.postMessage({ tube: "exit" }, "*"); } catch (e) {} }'
        + '});';
}

// YouTube serves its TV app to the TV's web browser in a cut-down form it does not give Samsung's own
// YouTube engine: "limited animation" (lists jump instead of gliding, so the remote feels slow, and
// Shorts lose their own player), and scripts fetched in batches later (search suggestions wait on
// them). The page is told what it tells the engine instead. Full animation can be switched off in
// the settings for a TV that struggles with it.
var TUNES = [
    ['"TV_APP_QUALITY_LIMITED_ANIMATION"', '"TV_APP_QUALITY_FULL_ANIMATION"', 'animation'],
    ['"enable_animation":false', '"enable_animation":true', 'animation'],
    ['"is_limited_animation":true', '"is_limited_animation":false', 'animation'],
    ['"enable_dynamic_import_batching":true', '"enable_dynamic_import_batching":false', 'always']
];

// UltimatiumTube's settings, as the page keeps them (the app's window shares this page's storage).
function settings() {
    try {
        return JSON.parse(window.localStorage.getItem('tube.settings') || '{}') || {};
    } catch (error) {
        return {};
    }
}

function tune(html, kept) {
    var animate = kept.fullAnimation !== false;
    return TUNES.reduce(function (text, rule) {
        if (rule[2] === 'animation' && !animate) return text;
        return text.split(rule[0]).join(rule[1]);
    }, html);
}

// A script's text can never close the tag it is written in.
function safe(text) {
    return String(text).replace(/<\/(script)/gi, '<\\/$1');
}

function pageFor(html, script, hash) {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    var head = parsed.head || parsed.getElementsByTagName('head')[0];

    var first = parsed.createElement('script');
    first.textContent = prelude(hash);

    var ours = parsed.createElement('script');
    ours.textContent = safe(script);

    head.insertBefore(ours, head.firstChild);
    head.insertBefore(first, ours);

    var doctype = parsed.doctype ? new XMLSerializer().serializeToString(parsed.doctype) : '<!DOCTYPE html>';
    return doctype + parsed.documentElement.outerHTML;
}

function write(target, page) {
    target.document.open();
    target.document.write(page);
    target.document.close();
}

function retry(why, title) {
    loader.writing = false;
    say(title || 'Cannot reach YouTube', why + ' Trying again...');
    setTimeout(load, title ? 300 : RETRY_AFTER);
}

// Which TV app YouTube serves. YouTube decides from the first load of /tv: Samsung's own YouTube app
// gets the full one (Shorts in the Shorts player, one after another; search as in the app), a TV's
// web browser a cut-down one. This page can only ask as the browser it is, so the app's service on the
// TV asks for it as Samsung's YouTube app does. In YT Dummy mode, or when the service does not answer
// at once, YouTube is asked directly, as youtube-dummy asks it.
var APP_PAGE = SERVICE + '/__tube/tvpage';
var SERVICE_WITHIN = 4000;

function looksLikeYouTube(html) {
    return !!html && html.indexOf('<html') !== -1;
}

// The app's service is started by the TV when it boots or the app is installed, not when the app is
// opened, and a TV may never have started it. The app starts it itself, as a Tizen app starts its
// own service, at every opening.
var SERVICE_NAME = 'UltimatiumTubeService';
var SERVICE_STARTS_WITHIN = 8000;

function wakeService() {
    try {
        if (typeof tizen === 'undefined' || !tizen.application || !tizen.ApplicationControl) return;
        var id = tizen.application.getCurrentApplication().appInfo.packageId + '.' + SERVICE_NAME;
        tizen.application.launchAppControl(new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service'), id,
            function () { loader.woke = 'started'; }, function (error) { loader.woke = 'refused: ' + (error && error.message); });
    } catch (error) {
        loader.woke = 'refused: ' + (error && error.message);
    }
}

// Whether the service answers at all (it answers its ping with 204 and nothing).
function ping(done) {
    var request = new XMLHttpRequest();
    var answered = false;
    var answer = function (alive) {
        if (answered) return;
        answered = true;
        done(alive);
    };
    request.onreadystatechange = function () {
        if (request.readyState === 4) answer(request.status === 204 || request.status === 200);
    };
    request.onerror = function () { answer(false); };
    request.timeout = 1500;
    request.ontimeout = function () { answer(false); };
    try {
        request.open('GET', SERVICE + '/__tube/ping', true);
        request.send();
    } catch (error) {
        answer(false);
    }
}

function untilServiceAnswers(done) {
    var started = Date.now();
    var look = function () {
        ping(function (alive) {
            if (alive) done(true);
            else if (Date.now() - started > SERVICE_STARTS_WITHIN) done(false);
            else setTimeout(look, 500);
        });
    };
    look();
}

function directly(done) {
    loader.flavour = 'browser';
    get(YOUTUBE, done);
}

function fetchPage(done) {
    if (settings().uiMode === 'stock') {
        directly(done);
        return;
    }
    get(APP_PAGE, function (html) {
        if (looksLikeYouTube(html)) {
            loader.flavour = 'app';
            loader.serviceDown = false;
            done(html);
            return;
        }
        // Not answering: started now, and waited for a few seconds, before YouTube is loaded directly;
        // once in an opening of the app, not again on each page after.
        if (loader.serviceDown) {
            directly(done);
            return;
        }
        say('UltimatiumTube', 'Starting UltimatiumTube\u2019s service...');
        wakeService();
        untilServiceAnswers(function (alive) {
            if (!alive) {
                loader.serviceDown = true;
                directly(done);
                return;
            }
            get(APP_PAGE, function (again) {
                if (!looksLikeYouTube(again)) {
                    loader.serviceDown = true;
                    directly(done);
                    return;
                }
                loader.flavour = 'app';
                loader.serviceDown = false;
                done(again);
            }, SERVICE_WITHIN + 2000);
        });
    }, SERVICE_WITHIN);
}

function load() {
    if (loader.writing) return;
    loader.writing = true;
    loader.tries += 1;
    say('UltimatiumTube', loader.tries > 1 ? 'Loading YouTube (try ' + loader.tries + ')...' : 'Loading YouTube...');

    fetchPage(function (html) {
        if (!looksLikeYouTube(html)) return retry('Check that the TV is connected to the internet.');
        // The first page of this opening of the app; later ones (YouTube reloading itself after a sign-in,
        // a mode chosen) are told so, and the welcome is not shown again on them.
        loader.loads += 1;

        var page;
        try {
            page = pageFor(tune(html, settings()), loader.script, loader.hash);
        } catch (error) {
            return retry('YouTube answered with something unexpected (' + (error && error.message) + ').');
        }

        var target = loader.app && !loader.app.closed ? loader.app : openWindow();

        // An engine without windows: this page becomes YouTube instead.
        if (!target) {
            loader.app = null;
            write(window, page);
            return undefined;
        }

        loader.app = target;
        try {
            write(target, page);
        } catch (error) {
            // A window this page may no longer write into: a fresh one takes its place.
            try {
                target.close();
            } catch (closing) {
                // Gone already.
            }
            loader.app = null;
            return retry('Opening YouTube again.', 'UltimatiumTube');
        }
        loader.writing = false;
        loader.written = true;
        loader.writtenAt = Date.now();
        say('UltimatiumTube', 'YouTube is open');
        return undefined;
    });
}

// YouTube that loads a page of its own again (a sign-in, a reload) leaves our script behind: that
// page does not carry the mark our first script sets, and is written again. A window YouTube closed
// is the app being left.
function ours(app) {
    try {
        return app.__tubeHost === 'wrt';
    } catch (error) {
        return false;
    }
}

function watch() {
    var app = loader.app;
    if (!app || loader.writing || !loader.written) return;

    if (app.closed) {
        exitApp();
        return;
    }

    if (!ours(app)) {
        loader.written = false;
        load();
    }
}

window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || typeof data !== 'object') return;
    if (data.tube === 'exit' || data.action === 'exit') exitApp();
    if (data.tube === 'reload') reopen(typeof data.hash === 'string' ? data.hash : '/');
});

// A window let go of: emptied first, since YouTube's page may ask to stay when it is closed, then
// closed, and closed again a moment later in case it would not go the first time.
function retire(old) {
    if (!old) return;
    try {
        if (old.closed) return;
        old.onbeforeunload = null;
        old.document.open();
        old.document.write('<!DOCTYPE html><html><body style="background:#000"></body></html>');
        old.document.close();
    } catch (error) {
        // Not ours to empty: closed below all the same.
    }
    try {
        old.close();
    } catch (error) {
        // Gone already.
    }
    setTimeout(function () {
        try {
            if (!old.closed) old.close();
        } catch (error) {
            // Gone.
        }
    }, 1000);
}

// YouTube loaded afresh (an interface mode chosen, say), as youtube-dummy reloads it: its window is
// closed and a fresh one written, so nothing of the page before stays behind.
function reopen(hash) {
    loader.hash = hash || '/';
    var old = loader.app;
    loader.app = null;
    loader.written = false;
    loader.writing = false;
    retire(old);
    if (document.body) document.body.click();
    if (!loader.app) openWindow();
    load();
}

// The app's own pictures (wallpapers), for YouTube's page, which cannot reach the app's files itself:
// read here and handed back as an address the page can show (the page shares this page's origin).
var ASSETS = {};

window.tubeAsset = function (path, done) {
    if (!/^wallpapers\/[a-z0-9-]+\.jpg$/.test(String(path))) {
        done(null);
        return;
    }
    if (ASSETS[path]) {
        done(ASSETS[path]);
        return;
    }
    var request = new XMLHttpRequest();
    var finish = function () {
        var ok = (request.status === 0 || request.status === 200) && request.response && request.response.size;
        if (ok) {
            try {
                ASSETS[path] = URL.createObjectURL(request.response);
            } catch (error) {
                ASSETS[path] = null;
            }
        }
        done(ASSETS[path] || null);
    };
    try {
        request.open('GET', path, true);
        request.responseType = 'blob';
        request.onload = finish;
        request.onerror = function () { done(null); };
        request.send();
    } catch (error) {
        done(null);
    }
};

// A press of the app's icon while it runs brings YouTube back to the front.
document.addEventListener('visibilitychange', function () {
    if (document.hidden || !loader.app || loader.app.closed) return;
    try {
        loader.app.focus();
    } catch (error) {
        // Nothing to bring forward.
    }
});

// The window YouTube runs in. Opened from a click, as youtube-dummy does, since an engine may only
// open a window for one.
function openWindow() {
    var opened = null;
    try {
        // A new name each time: a window still closing must not be handed back.
        loader.windows += 1;
        opened = window.open('about:blank', 'app' + loader.windows, 'scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no');
    } catch (error) {
        opened = null;
    }
    if (opened) {
        loader.app = opened;
        loader.written = false;
        try {
            write(opened, LOADING);
        } catch (error) {
            // YouTube is written over it in a moment all the same.
        }
    }
    return opened;
}

// Versions as numbers, part by part: 1.15.10 is newer than 1.15.9.
function newer(one, other) {
    var a = String(one || '0').split('.');
    var b = String(other || '0').split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i += 1) {
        var x = parseInt(a[i] || '0', 10) || 0;
        var y = parseInt(b[i] || '0', 10) || 0;
        if (x !== y) return x > y;
    }
    return false;
}

function keptUpdate(flavor) {
    try {
        var kept = JSON.parse(window.localStorage.getItem(KEPT + flavor) || 'null');
        return kept && kept.protocol === PROTOCOL && typeof kept.script === 'string' && kept.version ? kept : null;
    } catch (error) {
        return null;
    }
}

function dropUpdate(flavor) {
    try {
        window.localStorage.removeItem(KEPT + flavor);
    } catch (error) {
        // Nothing kept.
    }
}

// The script to run: the app's own, or a newer one kept from an update.
function chooseScript() {
    var kept = keptUpdate(loader.build.flavor);
    if (kept && newer(kept.version, loader.build.version)) {
        loader.script = kept.script;
        loader.using = 'update';
        loader.version = kept.version;
        return;
    }
    if (kept) dropUpdate(loader.build.flavor);
    loader.script = loader.bundled;
    loader.using = 'bundled';
    loader.version = loader.build.version;
}

function tell(message) {
    try {
        if (loader.app && !loader.app.closed) loader.app.postMessage(message, '*');
    } catch (error) {
        // Said next time.
    }
}

function fetchUpdate(at) {
    if (at >= UPDATES.length) return;
    var base = UPDATES[at];
    get(base + 'manifest.json?t=' + Date.now(), function (text) {
        var manifest = null;
        try {
            manifest = text ? JSON.parse(text) : null;
        } catch (error) {
            manifest = null;
        }
        if (!manifest) return fetchUpdate(at + 1);

        var file = manifest.files && manifest.files[loader.build.flavor];
        if (manifest.protocol !== PROTOCOL || !file || !file.path) return undefined;
        if (!newer(manifest.version, loader.version)) return undefined;

        get(base + file.path + '?v=' + encodeURIComponent(manifest.version), function (script) {
            // A download cut short is not run.
            if (!script || (file.length && script.length !== file.length)) return fetchUpdate(at + 1);
            try {
                window.localStorage.setItem(KEPT + loader.build.flavor, JSON.stringify({
                    version: manifest.version, protocol: PROTOCOL, script: script, at: Date.now()
                }));
            } catch (error) {
                return undefined;
            }
            tell({ tube: 'updated', version: manifest.version });
            return undefined;
        });
        return undefined;
    });
}

function checkForUpdate() {
    if (settings().autoUpdate === false) return;
    fetchUpdate(0);
}

// A kept script that never marked the page as started is dropped, and YouTube written again with the
// app's own.
function guardUpdate() {
    var app = loader.app;
    if (loader.using !== 'update' || !loader.written || !app || app.closed) return;
    if (Date.now() - loader.writtenAt < STARTS_WITHIN) return;
    var started = false;
    try {
        started = !!app.__tubeStarted;
    } catch (error) {
        started = true;
    }
    if (started) return;
    dropUpdate(loader.build.flavor);
    chooseScript();
    loader.written = false;
    load();
}

function start() {
    registerKeys();
    wakeService();
    window.addEventListener('click', function () {
        if (!loader.app || loader.app.closed) openWindow();
    });
    setTimeout(function () {
        if (document.body) document.body.click();
    }, 50);

    get('build.json', function (text) {
        try {
            var build = JSON.parse(text || '{}');
            if (build && build.version) loader.build = { version: String(build.version), flavor: build.flavor === 'legacy' ? 'legacy' : 'modern' };
        } catch (error) {
            // The defaults: any published script is newer.
        }
        get('userScript.js', function (script) {
            if (!script) {
                say('UltimatiumTube is incomplete', 'Its script is missing from the package. Install it again.');
                return;
            }
            loader.bundled = script;
            chooseScript();
            load();
            setInterval(watch, WATCH_EVERY);
            setInterval(guardUpdate, WATCH_EVERY);
            setTimeout(checkForUpdate, CHECK_AFTER);
        });
    });
}

start();
