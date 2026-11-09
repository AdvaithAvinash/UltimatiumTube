# How this is put together

Five layers, and the directory listing is the map. Below `mods/` and `framework/`, one more rule
holds: a directory is a module, and its `index.js` — where it has one — is the only file of it
anything outside may import.

```
app/          config.xml · index.html · icon.png    what the .wgt is made of
framework/    the patch framework — knows YouTube, never knows a feature
  framework/registries/   the traversal/registration machinery — see the table below
  framework/runtime/      config, flags, switches, waitFor — state read while the app runs
  framework/ui/           modal, toast, the renderer builders
  framework/vendor/       tiny-sha256.js, vendored verbatim
mods/         one directory per feature, named for what it does
  mods/dev/       aliased out of a release build entirely
service/      the Node service that ships inside the widget
  service/dev/    aliased out of a release build entirely
tools/        every build, release and diagnostic script
  tools/lib/      shared by more than one script — config, paths, report, inject, bridge, the
                  rollup config
  tools/dev/      the dev server's injected page code
test/         the userscript suites, mirroring mods/ and framework/
  test/framework/   whitebox tests against the registries directly
  test/mods/        one file (or directory) per feature under test
```

A mod that is one file is that file named `index.js` (`mods/adblock/index.js`). A mod that is
several related files still gets one directory (`mods/dearrow/`, `mods/quality/`, `mods/dislike/`);
it gets an `index.js` once there's a natural single entry point to register through, same as
`mods/subtitles/` always has. Where there isn't one — `mods/settings/`, `mods/sponsorblock/`'s
siblings, `mods/player/`'s — `mods/index.js` still imports each file it needs directly, exactly as
it always has; nothing here forces a barrel where one wouldn't describe anything real.

## The rule

> `mods/` may import `framework/index.js`, and nothing deeper.
> A file inside `mods/<feature>/` may import another feature's `index.js`, and nothing deeper in it.
> `framework/` may import nothing above it.
> Nothing shipped may import `tools/`.
> `service/` reaches `service/dev/` only through `service/dev/index.js`, which a ship build swaps for `none.js`.

Held to this by `no-restricted-imports` in `eslint.config.js`, at two levels: `mods/**/*.js`
against `framework/`, and `mods/*/*.js` against every other mod's internals. Nothing lints the
imports in `service/`. Without those rules a deep relative import resolves perfectly well, and the
separation goes back to being a habit.

`framework/index.js` is the whole of the framework's public surface, regardless of how its own
internals are grouped underneath it — a mod that imports anything else under `framework/` directly
fails lint. The same now holds one level down: a mod's own directory is private beyond its
`index.js`, to any other mod. `mods/index.js` itself is exempt from that second rule — it's the
orchestrator, exactly as `framework/index.js` is framework's, and mechanically listing every
feature's entry point is its whole job.

A short, named list of files is exempt from all of this: `eslint.config.js`'s `PRIVACY_EXEMPT` and
`SIBLING_OWNED` constants, each commented with why — mostly files a live sibling branch owns, where
even a same-directory reshape would conflict on every restack, and one (`mods/shell/startup.js`)
where routing a single import through the tidy path would drag five unrelated player mods'
registration earlier than they're meant to run. See "Boot" below for why that timing matters.

Only `mods/feed/index.js` may name a feed container such as `sectionListRenderer`. Every other
mod registers with the walk instead, and `no-restricted-syntax` in `eslint.config.js` enforces it.

## What the framework is for

Each registry replaced something that had been written several times and leaked differently.
They live under `framework/registries/` now; the table names them by what they export, which is
what a mod actually sees through `framework/index.js`.

| Registry | What it replaced |
|---|---|
| `feed.js` — `onTile` / `keepTile` / `onShelf` / `keepShelf` / `onSurface` | Eight traversals of each shelf |
| `commands.js` — `onCommand` | Two files independently patching `resolveCommand`, racing to wrap each other |
| `keys.js` — `onKey` | Six capturing `document` key listeners serving two features, never removed |
| `player.js` — `whenPlayer` / `whenVideo` | Nine separate waits for the player, six of them `waitFor` polls, with three disagreeing selectors |
| `schedule.js` — `every` / `after` / `until` | A 500 ms interval that leaked, and an adoption window that stacked a new timer per navigation |
| `json.js` — `onResponse` / `onRequest` | One merged key set, so every handler ran for every response that matched any of them |
| `internals.js` — `findBySource` / `whenFound` | A full scan of a 3116-entry registry per call, and four hand-rolled retry loops |

## Boot

`mods/index.js` is the whole of it: imports register — some also start work there and then — and
`boot()` runs the phases.

```
network → settings → ui → intercept
```

`network` first because it takes over `fetch` and `XHR` before anything asks the network for
anything. `intercept` last because taking over `JSON.parse` seals registration — a handler
registered afterwards warns instead of silently never firing.

## Phone settings

The settings on the TV and the page for a phone are one description. `mods/settings/settingsModel.js`
lists every row once; `phoneSchema.js` turns that list into plain data, and the TV's own rows are
built from the same list. `mods/phone/` posts that data and the current settings to the service every
few seconds and applies what comes back; `service/lib/phoneSettings.js` keeps the latest of each and
the changes the phone has made since, and serves `service/lib/phonePage.js` at `/settings`. Nothing
is stored in the service: the settings themselves live in the page's `localStorage`.

A value from the phone is applied only if the setting exists and has the same shape (a list stays a
list), in `configAccepts`. The route needs an `X-Tube` header, which a page on another site cannot
send without the service agreeing to it.

## Android

`android/` is the Android TV app: one activity, a WebView, and no framework. It fetches the TV page
itself in `shouldInterceptRequest` so `PageInjector` can put the built userscript at the top of the
page's head, where it runs before anything else. The userscript is the same file the Samsung widgets
carry. `window.__TUBE_NATIVE_PROXY_PATCHES__ = false` tells it that nothing proxies the page.
`PhoneSettings.java` and `PhoneServer.java` do for the app what `phoneSettings.js` does for the
service, and the userscript reaches them through `window.UltimatiumNative` instead of `fetch`.
`tools/build-apk.js` builds it with javac, dx, aapt, zipalign and apksigner.

## Ultimate settings and customization

`mods/settings/settingsModel.js` lists the settings once. Groups marked `ultimate` are not listed in
the category: the first row ("UltimatiumTube Ultimate Settings", marked `tubeStyle: 'ultimate'`)
opens a menu of them, each section opens as a list of its settings, and each setting opens its own
list. `settingComponents.js` puts the class `tube-ultimate` on the row YouTube draws for a marked
row, and `mods/theme/` writes the stylesheet that makes that class blue and glowing, and applies the
wallpaper, colours, font and the custom rules. All of it is rebuilt when a setting changes.

The wallpaper and the background colour are styles set on the page's own elements, not rules in a
stylesheet: they are put back to exactly what each element held, and the engine is asked afterwards
whether the picture is gone (`mods/theme/`). A TV's engine may not read a stylesheet again after it
changes, and a wallpaper that goes on but never off is what that looks like.

Keeping the service alive: an error nothing caught used to end it (`process.exit(1)`), and a TV does
not start an ended service again, so it was reinstalled to. `service/lib/postmortem.js` now writes
such an error down (`survived:`, the first five in a minute in full) and goes on. `service/lib/listener.js`
listens again if the server closes or the address it chose is no longer the set's, and keeps trying
while the port is busy; `service/lib/tend.js` runs that check every twenty seconds and on every
platform wake, writes the container's boot page again if that failed, and again when the set's address
changed.

Back at the start of the app: YouTube leaves by the command `EXIT_APP`. `mods/exitConfirm/` holds that
command back and asks; Exit sends it again, marked as answered. The page's own `window.close()` is
held the same way, since an error handler may call it.

## Dev and ship

Two build-time gates, one per side.

- **Userscript**: `framework/runtime/flags.js` folds `DEV_TOOLS` to a literal `false`, terser drops the
  `if (DEV_TOOLS) { … }` block in `mods/dev/index.js`, and its `unused` pass drops the modules.
  The shape is load bearing — an array like `FEATURES.concat(DEV_TOOLS ? [...] : [])` folds the
  array and keeps the functions. Release is ~16KB smaller than `TUBE_DEV=1`.
- **Service**: `service/vite.config.mjs` resolves `./dev/index.js` to `./dev/none.js` unless
  `TUBE_DEV=1`. An alias rather than dead-code elimination, because the service is deliberately
  built unminified so it can be read on a television when something has gone wrong. A ship build
  contains no `/eval`, no `x-tube-token`, no `/__tube/dev/` and no `cors`.

## Things that will bite

- `app/` is a *source* directory. Tizen resolves `<content src>` and `<icon src>` relative to the
  **archive** root, and `service/lib/cobaltConfig.js` reads `../../config.xml` at runtime from
  `service/dist/`. `tools/lib/paths.js` stages `app/`'s contents flat for that reason.
- The proxy port is written in three places: `tizen.config.json`, `service/lib/ports.js`, and the
  `--proxy` switch in `app/config.xml`. `npm run package` fails if `app/config.xml` disagrees with
  `tizen.config.json`, or if `service/lib/ports.js` does — a mismatch is a television that shows
  nothing and says nothing.
- `tools/check-output.js` rejects any built-in newer than Cobalt 3.2.1 / node 12. Babel lowers
  syntax; it does not polyfill a library call.
- The container is launched directly, so it can come up before the service listens. `--base_url`
  is therefore `file:///tube/boot.html`, a dmesg-style boot screen.
  The page is the ES modules in `service/boot/`, which rollup bundles beside the
  userscript. `service/lib/bootScreen.js` writes it into the `web/` folder of our `--content` copy
  after staging, and Cobalt serves it from there.
  - Before the service answers, it logs the Cobalt, Evergreen and Starboard versions and the wait.
  - Once the service answers, it polls `/__tube/boot`, which gives the Patch stamp Settings shows,
    Tizen, the model, node, the userscript, and every service log line since the last.
  - It moves on to `https://www.youtube.com/tv` only when three things hold: the certificate is
    ready, the TV can reach YouTube, and `https://www.youtube.com/__tube/ping` answers through
    Cobalt's proxy and our certificate, the same path the page will take. It carries its own query
    string, which holds Cobalt's device authentication.
  - If that answer fails three times, it asks the service, once, to start the container again.
    That is what a certificate issued during the container's life needs.
  - Otherwise it stays on the log and says in red what it waits on.
- A container's claim window counts from when the service starts listening, not from the wake.
- A dev build with `TUBE_START_DELAY=<ms>` holds the port shut, so the race can be reproduced.
- `/__tube/log` is the journal: one continuous log from the service's start on, rotated file
  included. It holds the service's notes, the boot screen's own lines (`screen:`), and the page's
  (`page:`). The framework's `report()` and `warn()` send those through `/__tube/journal`, along
  with page errors, rejections and the userscript's boot line. Each distinct line goes once, and
  at most 100 per page load.
  - The service's side is noted too: `console.error`/`console.warn` (`error:`/`warning:`), node's
    own warnings, and errors thrown in a route (`route:`).
  - How the previous run ended (`uncaught:`, `exit:`) is shown again at the top of the next run
    as `previous:`. So a crash that restarts the service stays on the boot screen, which also
    says when the service's pid changes.
- The 5.0+ widget (`UltimatiumTubetizen5.0.wgt`) differs in two ways. Its service (`TUBE_TARGET=legacy`) is
  ES5 with core-js for node 4.4.3, and `service/legacy/` stands in for the Buffer, `mkdirSync`, http2,
  TLS-socket and `normalize` behaviour old node lacks. And Cobalt 20 keeps its trust store read-only
  with no `--content`, so instead of intercepting TLS it loads the page from the service:
  `--base_url=http://127.0.0.2:8189/tv`, which a gold build allows over loopback. The userscript is
  the same one — Cobalt 20 runs V8 6.5.
- Served that way, every media request must reach `/cors-bypass/`, because googlevideo answers CORS
  only for `https://www.youtube.com`. Two traps stood in the way, and both failed silently.
  - Cobalt 20 cannot construct `URL` (`TypeError: URL is not constructible`). So
    `mods/network/originRewrite.js` reads hosts with a regex, and the userscript must never call
    `new URL`.
  - Below node 7, node-fetch falls back to whatwg-url, whose tr46 rejects googlevideo's `rr2---sn-`
    hosts, so `service/legacy/url.js` stands in for it.
  - Cobalt 20 also has no `Worker`, and its `fetch` is a JavaScript polyfill over XHR.
  - Below node 8, streams have no `destroy`. `proxy.js` unpipes and drains a media stream the page
    drops instead, because calling it crashed the service. The smoke test drops one.
- googlevideo refused the PO token the served page minted until the page presented itself as
  YouTube. `mods/network/pageOrigin.js` makes `location` and `document.URL` read
  `https://www.youtube.com`. Cobalt 20 leaves location forgeable; a browser does not, so there it does
  nothing. Navigation still maps back to the real origin, and `realOrigin()` still builds the
  bypass. With that, kabuki fetches its integrity token first-party
  (`/api/jnn/v1/GenerateIT`), and googlevideo answers `protection ok`.
- googlevideo opens every media answer with `STREAM_PROTECTION_STATUS`, which the player shows only
  as a timeout. `service/lib/protection.js` logs it as `media: itag N: protection
  ok/pending/required`, so a set's log shows whether attestation was accepted.
- kabuki counts only `www.youtube.com` and `accounts.google.com` as production hosts, and draws a
  red `NO DEBUG ACCESS DOMAIN=` watermark on any other. The host is the one thing the 5.0+ widget
  cannot change, so the service redirects `/tv` to carry `env_hideWatermark=true`, kabuki's own
  exemption for exactly that check. Nothing else in kabuki reads the host list; debug mode is keyed
  to fishfood builds, `web-release-qa` and `expflag`, none of which apply.
- Three files are excluded from `tsc`, and two of them from the style rules, because live sibling
  branches own them. They come back under both when those branches land.

## Later fixes worth knowing

- **Response mods going quiet.** YouTube's later-loaded modules (player, sign-in) carry their own
  `JSON`; the framework replaces `JSON.parse` in each one it finds. It looked only for a window after
  start and after a screen change, so a module that arrived later kept the native parser and every
  response mod (ads, SponsorBlock segments, filters) stopped. It now looks every two seconds as well
  (`json adoption (ongoing)`). `mods/adblock` also sweeps advert items out of shelf and continuation
  responses as a second line.
- **Video fit** (`mods/player/zoom.js`): the TV's engine draws a video whole and in its own shape,
  centred in the `<video>` element's box, and has no `object-fit`. In Cobalt's source the video is a
  punch-through node whose rectangle, after every transform, is handed to the TV's player
  (`SbPlayerSetBounds`). So a fit is a CSS `transform: scale()` on the video element about its middle;
  the element's size and place stay as YouTube laid them out (1.8.1 to 1.10.0 rewrote them, which the
  player could fight). Every `<video>` in the page is fitted, since the first is not always the one
  playing, and a fit works even when the engine does not report the video's size (the fixed zooms
  need none). Zoom to fill and Stretch work from the video's shape, so for a 16:9 upload with bars
  inside the picture only the fixed zooms (1.15x, 1.33x, 1.5x) change anything. A MutationObserver puts
  the fit back as soon as the player changes the element. `video fit` lines in `/__tube/log` say what
  was asked and what the element became. Checked in Chromium (corners of the screen covered); a TV's
  player that clips a rectangle larger than the screen would still show no change for the zooms.
- **Stremio page** (`stremio/`): `core.js` is the protocol (manifests, catalogs, meta, streams, built
  as the addon spec says; it is what `test/stremio-core.js` runs) and `ui.js` the screens, remote
  navigation (the nearest focusable in the direction pressed) and the player. The page is drawn for
  1920x1080 and scaled to the screen; it uses flexbox, transforms and opacity only, as the TV's
  engine has no grid, gap or custom properties. Requests and pictures to other sites go by the
  service's `/cors-bypass/` on a TV (`SX.route`); the video itself is loaded directly. On a Samsung
  TV `service/lib/stremio.js` serves it; on Android `StremioActivity` shows it
  (`page=stremio`) and hands over the addon list from the settings. The list lives in the
  `stremioAddons` setting, so the phone page edits it; the page reads it from `/api/settings`.
- **Grayjay plugins** (`stremio/grayjay.js`): a plugin's script is run with the classes and packages
  it expects (`PlatformVideo`, `http`, `Type`, ...) as parameters of the function it is built into,
  with the page's own objects (`window`, `document`, `fetch`, ...) shadowed. Its `http` calls block in
  a plugin, which a page cannot do, so a call that has no answer yet stops the run (a thrown marker),
  is fetched, and the run starts again with all answers so far handed back in order; a run that
  swallowed the marker is discarded too. Requests go to `/__tube/fetch` (`service/lib/pluginFetch.js`:
  method, headers and body as sent, redirects followed, JSON back) or, on Android, to
  `AniNative.fetch` (`PluginFetch.java`), because a page may not set User-Agent or Cookie.
- **Subtitles and settings (Stremio page):** subtitle files are fetched through the same request path as
  plugins (so a file's own encoding is handled by the service: UTF-8, or Windows-1252 when that is not
  valid), parsed in `core.js` (`parseSubs`, `cueAt`) and drawn by `ui.js` into a line over the video, not
  through the engine's text tracks. Settings are kept in `localStorage` (`sx_cfg`). With no custom
  properties in the engine, the accent colour is written into the text of `style.css` (fetched, changed,
  and put back as a `<style>`), and the other look settings are rules appended to it.
- **Faults on the Stremio page:** the linked stylesheet is never removed (settings only append rules, and
  nothing is appended while every look setting is as it came); the page is scaled only when the screen
  is not 1920x1080, with `transform-origin` in the stylesheet; an error shows at the bottom of the
  screen and is sent to `/__tube/journal`, so `/__tube/log` says what failed ("stremio: ..."), including
  a line when the page starts with the screen size, and any addon, plugin or catalog that failed.
- **Speed:** the advert sweep skips parts of a feed that hold only text and pictures, and the
  search for late-loading YouTube modules runs every five seconds after the first minute.

- **AniUltimatium was taken out** (1.10.0): the bundled copy, its settings, its service routes
  (`aniultimatium.js`, `aniApi.js`, `aniShim.js`, `flattenCss.js`, `launchApp.js`) and its Android
  screen. The audit fails a widget that carries `aniultimatium/` again. The Android screen that showed
  it is now `StremioActivity`, and the page's bridge is `StremioNative`.
- **Signing in** (1.12.1): YouTube, after a sign-in or an account switch, sends the page to
  `https://www.youtube.com/tv`; loaded from there the page has no userscript (no settings, adverts
  back) until the app is opened again. Every page's policy now names only this service in
  `h5vcc-location-src`, so Cobalt refuses that navigation, reports it (`report-uri /__tube/csp`, a
  `policy:` line in the log) and fires `securitypolicyviolation`, on which the userscript loads the same
  path from the service. A redirect from YouTube to itself is rewritten to a path on the service too.
- **Video fit, again** (1.12.1): YouTube's player makes the video's box the whole screen for some
  videos and only the picture (a band) for others; a fit worked out against the box did nothing in the
  second case. The fit is now worked out against the screen: `translate()` and `scale()` with origin
  `0 0` move the picture from where it is drawn to where the fit wants it. Players smaller than most of
  the screen (previews, the mini player) are left alone.
