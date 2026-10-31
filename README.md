# UltimatiumTube

<img src="app/icon.png" width="160" align="right">

Ad-free YouTube with SponsorBlock for **Samsung (Tizen) TVs** and **Android TV, Google TV and Fire TV**,
with YouTube's own TV interface left as it is.

- **The stock YouTube TV interface.** On a Samsung TV it runs inside the TV's own YouTube engine
  (Cobalt), so you get the same interface, the same playback, and the same 4K, HDR and 60fps your TV
  supports. On Android TV it is YouTube's TV page in a full-screen WebView. Neither is a different
  skin.
- **No ads.** Ads are removed from YouTube's responses before the player knows they exist.
- **SponsorBlock, with more control.** Sponsor segments, intros, outros, subscribe reminders and
  self-promotion are skipped automatically and drawn on YouTube's own progress bar. You can mute a
  kind of segment instead of skipping it, ignore short segments, switch it off on channels you want
  to support, and see how much time it has saved you.
- **Hide channels and words.** Videos from channels you pick, or with words you list in the title,
  are left out of every shelf.
- **A speed for each channel.** Watch one channel at 1.5x and the next time it starts at 1.5x.
- **Settings from your phone.** The same settings in a page you open on a phone or computer, where
  typing a word is easy, with backup and restore.
- **One settings entry on the TV.** Open YouTube's own **Settings** and scroll to the bottom:
  everything UltimatiumTube adds is in the **UltimatiumTube** section. YouTube's own settings are not
  moved or changed.
- **UltimatiumTube Ultimate Settings.** The first row of that section, in glowing blue. Behind it:
  **Customization** (wallpaper, colours, font), **Ultimate Dev Options** (advanced settings) and
  **AniUltimatium**.
- **Back asks before leaving.** Back at the start of the app asks "Exit UltimatiumTube?" with Stay and
  Exit. It can be turned off under Startup.
- **Speed up to 15x**, from the speed button in the player and as a default speed in the settings.
- **AniUltimatium from the app.** Turn it on and an extra blue row opens
  [AniUltimatium](https://github.com/AdvaithAvinash/AniUltimatium), the anime, movie and live TV app.
  On Android it opens in a screen of the app, bundled in it. On a Samsung TV it starts AniUltimatium's
  own app, if installed (see below).
- **The mods ship inside the app.** Nothing is downloaded at launch, so there is no "failed to load
  script" network error.

## Install

Pick the file for your TV from the [releases](https://github.com/AdvaithAvinash/UltimatiumTube/releases).
[docs/INSTALL.md](docs/INSTALL.md) has the steps for each route.

| File | For |
| --- | --- |
| `UltimatiumTubetizen5.5.wgt` | Samsung TVs on Tizen 5.5 or newer (2020 and later). Use this one if you are unsure. |
| `UltimatiumTubetizen5.0.wgt` | Samsung TVs on Tizen 5.0 (2019) |
| `UltimatiumTube.apk` | Android TV, Google TV, Fire TV, or an Android phone or tablet |

A Samsung TV installs only an app signed for that TV, so the `.wgt` files are unsigned and are signed
while you install them: through [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung),
[Tizen Homebrew](https://github.com/SushyDev/tizen-homebrew) or Tizen Studio.

If something goes wrong on a Samsung TV, the boot screen shows an address you can open on a phone.
That page says what failed. Please [open an issue](https://github.com/AdvaithAvinash/UltimatiumTube/issues)
and include what it says.

### Alongside YouTube for Tizen and TizenTube

UltimatiumTube uses its own service port, folder, boot page and package id, so installing it does not
overwrite, or stop starting, YouTube for Tizen or TizenTube. One thing is shared: every one of these
apps runs in Samsung's YouTube container, and a TV has one. Close the other app (or switch the TV off
and on) before opening this one. [docs/UPSTREAM.md](docs/UPSTREAM.md) has the details.

## Settings

Out of the box only ads and sponsor segments are removed. Everything else starts the way the stock
app behaves, and you turn on what you want under **Settings > UltimatiumTube** on the TV, or from the
phone page.

| Section | What is in it |
| --- | --- |
| SponsorBlock | On or off, segments to skip, segments to ask about first, segments to mute, shortest segment to act on, channels to leave alone, skip notices, time saved |
| Ad blocking | On or off |
| DeArrow | Community titles and thumbnails instead of clickbait (off by default) |
| Return YouTube Dislike | The real dislike count |
| Startup | The page to open, who's-watching prompts |
| Channels and words | Hidden channels, hidden words, a speed for each channel, the phone page |
| Feed, Sidebar, Navigation | Shorts, hide watched videos, thumbnails, sidebar sections, scroll speed |
| Playback, Subtitles, Player controls | Quality, codec, default speed (up to 15x), remembered speed, subtitle tracks, extra player buttons |
| Overlays and prompts | Shopping card, end screen cards, up next, "Are you still watching?", sign-in reminder |

### UltimatiumTube Ultimate Settings

The first row of the UltimatiumTube section. It opens three sections.

| Section | What is in it |
| --- | --- |
| Customization | A wallpaper switch, a button that turns the wallpaper off and loads the page again, its picture (ten built-in, starting with Blue flames, or one from a web address), dimming, background colour, accent colour of the UltimatiumTube rows, font, and a reset |
| Ultimate Dev Options | Phone page on or off and how often it refreshes, a SponsorBlock server of your own, custom style rules (CSS), the version, and reset everything |
| AniUltimatium | A switch. While it is on, an **Open AniUltimatium** entry appears here, and one more blue row in the category |

Text such as a server address or style rules is typed on the phone page.

### AniUltimatium

[AniUltimatium](https://github.com/AdvaithAvinash/AniUltimatium) is bundled in the app, as its own
files, in `aniultimatium/`. `node tools/update_aniultimatium.js` brings the bundled copy up to date;
`aniultimatium/VERSION.txt` says which commit it is. It talks to its own online service, so it needs
the internet.

- **Android and Fire TV:** it opens in a screen of the app and Back returns to YouTube.
- **Samsung TV:** AniUltimatium's own Samsung app, if installed (its `.wgt` is on its releases page),
  is the best way: it runs in the TV's web engine, as AniUltimatium is written for. The blue row starts
  it. Without it, the row opens the copy bundled here, which the service serves to the TV's YouTube
  engine. That engine has no CSS variables, grid or `gap`, so the service sends AniUltimatium's
  stylesheet with its variables filled in, routes its requests to other sites through the service (it
  is written for a widget that may call any address), and starts it in its Classic, low-end look. It
  has not been seen running on a TV, and AniUltimatium's embedded movie players need frames, which
  that engine does not have. If the app was installed under another id, set it under Ultimate Dev
  Options.

### From your phone

The **Channels and words** section of the TV's settings shows the address to open (for example
`http://192.168.1.20:8189/settings`) once the app has started. On a Samsung TV it is also listed
under **Settings > About** (the TV's address, then `:8189/settings`). Open it on any phone or computer
on the same network. Changes reach the TV within a few seconds. **Back up settings** saves a file you
can restore from later.

### What is not here

Automatic frame-rate matching, which TizenTube Cobalt offers, is not in UltimatiumTube. It needs a
function that exists only in that project's own modified Cobalt build. The Samsung TV's stock engine,
which this app runs in, does not have it. Models that match frame rate for the stock YouTube app do
so here too.

## Building it yourself

You need Node 20 or newer.

```sh
npm install
npm test                  # lint, types, userscript and service suites
npm run package           # release/UltimatiumTubetizen5.5.wgt and UltimatiumTubetizen5.0.wgt
npm run package:android   # release/UltimatiumTube.apk
```

The Android app needs no Android SDK, only tools Debian and Ubuntu package:
`apt install aapt apksigner dalvik-exchange zipalign libandroid-23-java openjdk-17-jdk-headless`.
It is signed with a key made on first use, kept in `~/.ultimatiumtube/`. Keep that key: an update has
to be signed with the same one as the version it replaces.

[docs/DEVELOP.md](docs/DEVELOP.md) lists every command. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
explains how the app is put together.

## Credits and licence

GPL-3.0-only, see [LICENSE](LICENSE).

UltimatiumTube is built on
[YouTube for Tizen](https://github.com/SushyDev/tizen-youtube) by SushyDev, which was itself derived
from [TizenTube](https://github.com/reisxd/TizenTube) and
[youtube-webos](https://github.com/webosbrew/youtube-webos). The Cobalt-container approach, the
service and the mod framework come from those projects.

Sponsor segments, community titles and dislike counts come from
[SponsorBlock](https://github.com/ajayyy/SponsorBlock),
[DeArrow](https://github.com/ajayyy/DeArrow) and
[Return YouTube Dislike](https://github.com/Anarios/return-youtube-dislike).

**FAQ**
**Why Is ultimatiumtube named "ultimatiumtube"** 
See, UltimatiumTube's name was inspired by AniUltimatium, the name was supposed to be AniUltimatum but i mispelled it and didn't care much since my most starred repo is AniUltimatium, I decided to make my entire samsung collection full of Ultimatium's (except for some exceptions)
