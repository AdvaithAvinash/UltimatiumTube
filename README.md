# UltimatiumTube

<img src="app/icon.png" width="160" align="right">

Ad-free YouTube on Samsung (Tizen) TVs, with SponsorBlock, while keeping the TV's own YouTube app look.

- **The stock YouTube TV interface.** UltimatiumTube runs inside Samsung's own Cobalt engine, the one
  the built-in YouTube app uses. You get the same interface, the same playback, and the same 4K, HDR
  and 60fps your TV supports. It is not a browser page with a different skin on top.
- **No ads.** Ads are removed from YouTube's responses before the player knows they exist.
- **SponsorBlock.** Sponsor segments, intros, outros, subscribe reminders and self-promotion are
  skipped automatically. The segments are drawn on YouTube's own progress bar.
- **One settings entry.** Open YouTube's own **Settings** and scroll to the bottom. Everything
  UltimatiumTube adds is in the **UltimatiumTube** section there. YouTube's own settings are not moved
  or changed.
- **The mods ship inside the app.** Nothing is downloaded from a CDN at launch, so there is no
  "failed to load script" network error.

## Settings › UltimatiumTube

| Setting | Default |
| --- | --- |
| SponsorBlock, plus which segments to skip, which to ask about, and skip notifications | On |
| Block ads | On |
| DeArrow (community titles and thumbnails instead of clickbait) | Off |
| Return YouTube Dislike | On |
| Startup page, Who's watching prompts | YouTube's own |
| Shorts, high-quality thumbnails, hide watched videos | YouTube's own |
| Sidebar sections | All shown |
| Scroll speed, rapid press, smoother navigation | YouTube's own |
| Preferred quality, preferred codec, remember playback speed, speed steps | Highest, any |
| Subtitles in your language, hidden subtitle tracks | On, off |
| Previous/next and mini player buttons, Super Thanks, Ask | YouTube's own |
| Shopping card, end screen cards, paid promotion notice, Up next card, "Are you still watching?", sign-in reminder | YouTube's own |

Out of the box only the ads and sponsor segments are removed. Every other setting starts out the
way the stock app behaves, and you can turn it on yourself.

## Install

The ready-made widgets are in [`wgt/`](wgt):

| File | For |
| --- | --- |
| [`UltimatiumTube-tizen-5.5.wgt`](wgt/UltimatiumTube-tizen-5.5.wgt) | Tizen 5.5 and newer (2020+ TVs). Use this one if you're unsure. |
| [`UltimatiumTube-tizen-5.0.wgt`](wgt/UltimatiumTube-tizen-5.0.wgt) | Tizen 5.0 (2019 TVs) |

A Samsung TV installs a widget only if it is signed for that TV, so these files are **unsigned**.
They are signed while you install them, in one of these ways:

1. **[Tizen Homebrew](https://github.com/SushyDev/tizen-homebrew)** (easiest). Set it up once by its
   README, then load the `.wgt` through its **Upload** tab. Homebrew signs it for your TV.
2. **Apps2Samsung or Tizen Studio.** Use your own Samsung certificate, with your TV's DUID in the
   distributor certificate. Then install the `.wgt` over Developer Mode.

After installation, open **UltimatiumTube** from the TV's apps. The first launch shows a short boot
log while the app sets itself up, and then the normal YouTube home screen opens.

If something goes wrong, the boot screen shows an address you can open on a phone. That page says
what failed. Please [open an issue](https://github.com/AdvaithAvinash/UltimatiumTube/issues) and
include what it says.

## Building it yourself

You need Node 20 or newer.

```sh
npm install
npm test           # lint, types, userscript and service suites
npm run package    # release/UltimatiumTube-tizen-5.5.wgt and UltimatiumTube-tizen-5.0.wgt
```

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
