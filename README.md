## UltimatiumTube

[![Latest Release](https://img.shields.io/github/v/release/AdvaithAvinash/UltimatiumTube?display_name=tag&style=for-the-badge&logo=github&label=Latest%20Release)](https://github.com/AdvaithAvinash/UltimatiumTube/releases/latest)
[![Release Downloads](https://img.shields.io/github/downloads/AdvaithAvinash/UltimatiumTube/total?style=for-the-badge&logo=github&label=Total%20Downloads)](https://github.com/AdvaithAvinash/UltimatiumTube/releases)

[![Downloads](https://img.shields.io/github/downloads/AdvaithAvinash/UltimatiumTube/total?style=for-the-badge&logo=github&label=Downloads)](https://github.com/AdvaithAvinash/UltimatiumTube/releases)

<img src="app/icon.png" width="160" align="right">

Ad-free YouTube with SponsorBlock for **Samsung (Tizen) TVs** and **Android TV, Google TV and Fire TV**,
with YouTube's own TV interface left as it is.

- **The stock YouTube TV interface, loaded straight.** On a Samsung TV the app fetches YouTube's own TV
  page and opens it in the TV's own web engine with UltimatiumTube on top, the way
  [youtube-dummy](https://github.com/no-cover/youtube-dummy) does. It does not start Samsung's Cobalt
  container and does not wait on a service on the TV ("host"), so if YouTube answers, the app works.
  On Android TV it is YouTube's TV page in a full-screen WebView. Neither is a different skin.
- **Like YouTube's own TV app.** YouTube gives a TV's web browser a cut-down version of its TV app
  (limited animation, scripts fetched in batches). UltimatiumTube asks for what Samsung's own YouTube
  engine gets: full animations, Shorts in their own player, search suggestions without the wait, and a
  remote that answers at once. *Full animations* can be switched off under Navigation for a slow TV.
- **Self-updating.** Like youtube-dummy, which keeps TizenTube's script current, UltimatiumTube fetches
  its newest version from this repository on GitHub while you watch, and the next time the app opens it
  runs it: no reinstall for each release. A version that fails to start is dropped and the one installed
  runs again. *Automatic updates* is under Ultimate Dev Options. (A new install file is still needed when
  the app's own package changes; the app says so in What's new.)
- **Welcome to UltimatiumTube.** Every time it opens, the app greets you and offers **Stock YouTube UI**
  (YouTube as it comes) or **SmartTube UI** (dark grey, with SmartTube red on whatever is focused); OK
  keeps the one you have, and choosing the other loads YouTube afresh in it. It is also under Settings >
  UltimatiumTube > Interface mode.
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
  **Stremio and Grayjay**.
- **Back asks before leaving.** Back at the start of the app asks "Exit UltimatiumTube?" with Stay and
  Exit. It can be turned off under Startup.
- **Zoom to fill.** Videos that are not the screen's shape no longer keep bars: pick a fit under Playback > Video fit: Zoom to fill for a video of another shape, Zoom 1.33x when the black bars are part of the video itself (most films and old clips uploaded as 16:9), or Stretch, or press Yellow while a video plays. A **Video fit** button is also in the player's own button row.
- **Stremio addons and Grayjay plugins.** A movie, series and video screen built for the TV: a hero
  banner, rows of posters, search, a library, continue watching and a player, fed by any
  [Stremio](https://www.stremio.com) addon and any [Grayjay](https://grayjay.app) plugin.
  Open it from the blue **Stremio and Grayjay** row in the UltimatiumTube settings. Add addons and
  plugins on the phone page (Ultimate Settings > Stremio and Grayjay) or in the page itself. Cinemeta, which gives the
  catalogs, is added for you. Streams come from addons that give direct links (for example one set
  up with a debrid service); a TV cannot play torrents. [More below.](#stremio-addons)
- **4K.** Preferred quality starts on *Highest available*, so a 4K (2160p) video plays in 4K on a TV
  that can show it, at 60fps where the video has it. Pick 2160p under Playback to aim for it exactly,
  and leave Preferred codec on *Any*: 4K comes as VP9 or AV1, not H.264. The quality lock for each
  channel (below) can keep one channel at 4K and another lower.
- **Ultimate statistics.** Adverts removed, videos asked for without adverts, SponsorBlock segments
  skipped and the time saved, under Ultimate Dev Options.
- **Remote buttons.** Red, Green, Yellow and Blue each do what you choose, with a second action when
  held: next video fit, the fit menu, the speed menu, bookmark this moment, open bookmarks, quality for
  this channel, add this channel to a collection, open collections, back 10 s, forward 30 s, start
  again, or open Stremio and Grayjay. As they come: Green
  bookmarks (held: the list), Yellow changes the fit (held: the menu), Blue opens speed (held: quality for
  this channel), Red is left to YouTube.
- **Video bookmarks.** Keep a moment of a video and open it later from the list, straight at that time.
- **Smart resume.** A video over two minutes starts where you stopped it last time.
- **Playback intelligence** (Settings > UltimatiumTube > Playback intelligence):
  - **Skip intro button.** When an intro, outro, recap or filler comes up, a *Skip intro* (or *Skip
    outro*, ...) button appears over the video: from SponsorBlock, and, for a video SponsorBlock knows
    nothing of, from the video's own chapters named Intro, Opening, Recap, Credits or Outro. Switch on
    *Skip intros, outros and recaps on their own* to skip them with no button.
  - **Smart search.** A search typed or said as a sentence, such as *"find videos explaining how OLED
    TVs work in simple terms"*, is turned into the words that find it (*"how OLED TVs work explained
    simply"*). It is a set of rules on the TV, not an AI service, so nothing leaves the TV.
  - **Smart Shorts filter.** Shorts longer or shorter than a length you choose, or from a hidden channel
    or with a hidden word, are passed over as they come up.
  - **Smart resume** (below).
- **Universal Media Control Center.** The first tab of the Stremio and Grayjay page (*Center*): YouTube,
  Stremio, Grayjay and AniUltimatium in one place, with continue watching across YouTube, Stremio and
  Grayjay, favourites (bookmarks and your library), a feed for each of your channel collections (the
  newest videos of its channels), smart playlists, one search for everything (including YouTube), and
  AniUltimatium's own app one press away.
- **Custom feeds and smart playlists.** Each collection becomes a feed; *Play all* or *Shuffle* plays it as
  one continuous YouTube playlist. Smart playlists ("Name: word, word" a line, under Ultimate Settings >
  Stremio and Grayjay) collect the feed videos with those words.
- **Playback profiles.** Cinema, Learning, Music and Sports (and Standard): speed, quality, fit and
  skipping in one press, under Playback intelligence.
- **A-B repeat and seek steps.** A remote button marks A, then B and loops between them; the seek steps of
  the remote's Back and Forward are yours to choose.
- **User profiles and Guest mode.** *Who is watching* (Profiles and what's new): each person their own
  settings, bookmarks, themes and filters; Guest starts as the app came and keeps nothing.
- **Content intelligence.** Duplicates and reposts shown once, clickbait hidden, and rules of your own (a
  word, `channel: name` or `regex: pattern` a line), all on the TV.
- **Shorts control center.** Shorts by length, by hidden channels and words, by words of their own, and
  only from your collections.
- **Movie covers.** A Stremio title with no picture of its own gets Cinemeta's poster and backdrop.
- **Voice.** The app now tells the TV it takes voice, so a search said to the TV's own assistant (Bixby,
  or Alexa built into the TV) can reach it as it does the stock YouTube app. Whether a given TV passes it
  on has not been seen; an Alexa speaker on its own cannot reach an app on the TV.
- **Welcome message and What's new.** A glass panel when the app opens, with *OK*, *What's new* and
  *Don't show again*; *What's new* is also under Profiles and what's new.
- **Channel collections.** Put channels in collections of your own (Favourites, Music, Learning,
  Gaming, ...) while one of their videos plays, then open a collection and go to a channel.
- **Quality lock for each channel.** A preferred quality for one channel, over the one for every video.
- **Wallpaper Studio.** Eleven pictures drawn for UltimatiumTube (electric blue, neon city, purple
  horizon, nebula, aurora over mountains, AMOLED arc, liquid waves, holographic glass, inferno, rainy
  window and the blue flames) and nine gradients, listed by collection (Ultimatium Originals,
  Cyberpunk, Space & Galaxy, Nature & Landscapes, AMOLED, Abstract & Fluid, Fire, Ambient Worlds); your
  own picture by address; dimming; shuffle (each time the app opens, every 15 minutes or every hour);
  and **Themes** that set the wallpaper and the colours together: Ultimatium Blue Flame, Cyber Purple,
  AMOLED Black, Inferno, Holographic, Neon City and Deep Space.
- **Speed up to 20x**, from the speed button in the player and as a default speed in the settings. Speeds
  beyond YouTube's own 2x carry an *UltimatiumTube* label beneath them in the menu; past what the TV's
  video engine plays (16x in most), the rest is made up by moving the video on.
- **The mods ship inside the app.** Nothing is downloaded at launch, so there is no "failed to load
  script" network error.

## Install

**UltimatiumTube is supported on Tizen 3.0 and newer.** Choose the file by your TV's Tizen version:

- **Tizen 5 or under** (Tizen 3.0, 4.0 and 5.0): choose **`UltimatiumTubetizen5.0.wgt`**.
- **Tizen 5.5 or above** (Tizen 5.5, 6, 6.5, 7, 8, 9 and newer): choose **`UltimatiumTubetizen5.5.wgt`**.

Pick the file from the [releases](https://github.com/AdvaithAvinash/UltimatiumTube/releases).
[docs/INSTALL.md](docs/INSTALL.md) has the steps for each route.

| File | For |
| --- | --- |
| `UltimatiumTubetizen5.5.wgt` | Samsung TVs on **Tizen 5.5 and above** (2020 and later, including Tizen 6, 7, 8 and 9) |
| `UltimatiumTubetizen5.0.wgt` | Samsung TVs on **Tizen 5 and under** (Tizen 3.0 to 5.0, 2017 to 2019). Its script is written for those TVs' older web engine |
| `UltimatiumTube.apk` | Android TV, Google TV, Fire TV, or an Android phone or tablet |

Not sure of your version? On the TV: Settings > Support > About This TV. A 2020 or later TV is Tizen 5.5
or above; 2017 to 2019 is Tizen 3 to 5.

A Samsung TV installs only an app signed for that TV, so the `.wgt` files are unsigned and are signed
while you install them: through [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung),
[Tizen Homebrew](https://github.com/SushyDev/tizen-homebrew) or Tizen Studio.

If YouTube cannot be reached, the app says so and tries again every few seconds. If something else goes
wrong, please [open an issue](https://github.com/AdvaithAvinash/UltimatiumTube/issues).

### Alongside YouTube for Tizen and TizenTube

UltimatiumTube no longer runs in Samsung's YouTube container, so it does not compete with YouTube for
Tizen, TizenTube Cobalt or the stock YouTube app for it, and its package id, folder and port are its own.
The app's small service still runs for the extras (phone settings page, wallpapers, the Stremio page); the
app works without it.

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
| Playback, Subtitles, Player controls | Quality, codec, video fit (original, zoom to fill, zoom 1.15x / 1.33x / 1.5x, stretch), default speed (up to 20x), remembered speed, subtitle tracks, extra player buttons |
| Overlays and prompts | Shopping card, end screen cards, up next, "Are you still watching?", sign-in reminder |

### Interface modes

The first row of the UltimatiumTube settings, **Interface mode**, switches the whole app in one press:

| Mode | What you get |
|---|---|
| **UltimatiumTube** | Everything UltimatiumTube adds, as you set it up |
| **SmartTube style** | SmartTube's look and habits over YouTube's own TV screens: dark grey with red, sponsor segments skipped with a note, DeArrow titles, dislikes, sharper thumbnails, previous/next and mini player buttons, a speed remembered per channel, no "still watching?", paid-promotion or sign-in nags |
| **YouTube as it comes (dummy)** | YouTube's own TV app untouched, the way [youtube-dummy](https://github.com/no-cover/youtube-dummy) shows it: no theme, wallpaper, extra buttons, menus, panels or welcome message. Only adverts and sponsor segments go, quietly |

Your own setup is kept while another mode is on, and comes back exactly when you choose UltimatiumTube
again. SmartTube style is SmartTube's look and defaults applied to YouTube's TV interface; SmartTube's
own screens belong to its Android app and are not copied here.

### UltimatiumTube Ultimate Settings

The first row of the UltimatiumTube section. It opens three sections.

| Section | What is in it |
| --- | --- |
| Customization | A wallpaper switch, a button that turns the wallpaper off and loads the page again, its picture (ten built-in, starting with Blue flames, or one from a web address), dimming, background colour, accent colour of the UltimatiumTube rows, font, and a reset |
| Ultimate Dev Options | Phone page on or off and how often it refreshes, a SponsorBlock server of your own, custom style rules (CSS), the version, and reset everything |
| Stremio and Grayjay | A switch (on by default), **Open Stremio and Grayjay**, the list of Stremio addons and the list of Grayjay plugins |

Text such as a server address or style rules is typed on the phone page.

### Stremio addons and Grayjay plugins

The page is bundled in the app (`stremio/`), served by the service on a Samsung TV and shown in a
screen of the app on Android. Back returns to YouTube.

- **What it reads from an addon:** its catalogs (home rows, with more loaded as you scroll), search,
  details and episodes, and streams. Addons are asked only for what they declare.
- **What plays:** a stream with a direct address, in the page's own player (HLS too). It remembers
  where you stopped, seeks with Left and Right (more the longer you press), and starts the next
  episode with the same kind of stream. A YouTube stream opens in YouTube (Samsung only). A torrent
  stream is listed but cannot be played; use an addon that turns it into a direct link.
- **Addons:** listed one to a line under **Ultimate Settings > Stremio addons** (typed on the phone),
  or added in the page's **Addons** tab. An addon that does not answer is shown as not reachable.
- **Grayjay plugins** are added by the address of their configuration (a `.json`, for example
  from [plugins.grayjay.app](https://plugins.grayjay.app), or a `grayjay://` link), under
  Ultimate Settings > Stremio and Grayjay or in the page's Addons tab. A plugin's home feed shows as a
  row of Home, its search is part of Search, and its videos open to a detail screen and the sources
  it offers. What plays is a whole video file or an HLS playlist. A plugin's requests are made by the
  service (Samsung) or the app (Android), so the headers it sets, such as User-Agent and Cookie,
  are sent, and the sites it may reach are limited to those it lists. **A plugin is a program that runs
  in the page.** The page hides its own objects from it, but that is not a sandbox: add only plugins
  you trust.
- **Grayjay, what is not there:** signing in to a site, channels, playlists, comments and
  subscriptions; video kept apart from its sound and DASH (many sites give their best quality only
  that way, so a plugin may offer only lower qualities, or nothing, here); and plugins that need a
  browser's page objects, such as an HTML parser. Plugins are written to block on their requests, which
  a page cannot do, so the page runs a plugin function again from the start with each answer it has
  fetched; a plugin that behaves differently when run twice will not work.
- **Subtitles:** from the addons that give them (the `subtitles` resource, such as OpenSubtitles) and from
  the stream itself. Press Up in the player for the list of languages and a delay (Left and Right,
  half a second a step). A language chosen in the page's Settings is turned on by itself. The page draws
  them (SRT and WebVTT, older Windows-1252 files too), in the size, colour, background and height you set.
- **Settings** (the page's last tab): accent colour, poster size, the banner on or off, how dark the
  picture behind the text is, rounded or sharp corners, ratings on posters; which tab opens first,
  whether the next episode starts by itself, and **choosing a stream** by itself (best quality, or best
  up to 1080p or 720p) so Play goes straight to the video; the subtitle language, size, colour,
  background and height, with a preview; and clearing continue watching and the library.
- **Not there:** subtitles from plugins, and addon settings pages (an addon is added by its address,
  with its own configuration in it). It has not been run on a real TV; it was run in a browser with
  addons stood in for.

### What was asked for and is not here

- **Already there:** auto skip of intros, outros and the other SponsorBlock categories (SponsorBlock
  settings), hiding Shorts and hiding channels and words (which also apply to Shorts), backup and
  restore (the phone page), and a play queue (Add to queue on a video's menu).
- **Not possible on the TV as it is:** a real *AI* search and *smart recommendations* need an AI service
  and an account or key to pay for it; Smart search above does the part that can be done on the TV, and
  YouTube's home screen already recommends from what you watch. *Watch together* and *backup sync between TVs*
  need a server for TVs to meet on. A *plugin marketplace* and a *wallpaper and theme store* with
  uploads and ratings need a hosted service too. *Video and animated wallpapers* would need a second
  video playing behind YouTube, and the TV decodes one video at a time; blur needs a filter the TV's
  engine does not have.

### From your phone

The **Channels and words** section of the TV's settings shows the address to open (for example
`http://192.168.1.20:8189/settings`) once the app has started. On a Samsung TV it is also listed
under **Settings > About** (the TV's address, then `:8189/settings`). Open it on any phone or computer
on the same network. Changes reach the TV within a few seconds. **Back up settings** saves a file you
can restore from later.

### Staying signed in

Before 1.13.1 the Tizen 5.5+ app could sign every account out at random: the app is opened at the TV's
own address on your home network, the TV keeps the sign-in under that address, and when the router
gave the TV a new address the sign-in was left behind. The app now keeps using the address it was at
for as long as the TV has it, and keeps a copy of the sign-in in its own folder on the TV: opened at a
new address, it puts the sign-in back and reloads once. The copy is only ever given to the TV itself.
Giving the TV a fixed address in your router (a DHCP reservation) avoids the change altogether.

### What is not here

Automatic frame-rate matching, which TizenTube Cobalt offers, is not in UltimatiumTube. It needs a
function that exists only in that project's own modified Cobalt build, and the TV's own web engine,
which this app runs in, does not have it.

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
[youtube-webos](https://github.com/webosbrew/youtube-webos). The mod framework and the service come
from those projects. The way the Samsung app loads YouTube (its TV page fetched and opened in the TV's
own web engine) follows [youtube-dummy](https://github.com/no-cover/youtube-dummy).

Sponsor segments, community titles and dislike counts come from
[SponsorBlock](https://github.com/ajayyy/SponsorBlock),
[DeArrow](https://github.com/ajayyy/DeArrow) and
[Return YouTube Dislike](https://github.com/Anarios/return-youtube-dislike).

**FAQ**
**Why Is ultimatiumtube named "ultimatiumtube"** 
See, UltimatiumTube's name was inspired by AniUltimatium, the name was supposed to be AniUltimatum but i mispelled it and didn't care much since my most starred repo is AniUltimatium, I decided to make my entire samsung collection full of Ultimatium's (except for some exceptions)

## 🔄 Self-Updating System

UltimatiumTube **1.16.0** introduces an independent self-updating mechanism that keeps the app's scripts and features up to date without requiring users to reinstall the `.wgt` package for every update.

Inspired by the approach used by `youtube-dummy`, UltimatiumTube checks GitHub for newer application code and downloads updates in the background.

### How It Works

Unlike a conventional app update that requires downloading and reinstalling a new WGT, UltimatiumTube separates its updateable application logic from the installed TV application.

The update process works as follows:

1. **Automatic update check:** Approximately 20 seconds after YouTube opens, UltimatiumTube checks GitHub for a newer version.
2. **Background download:** If a newer version is available, the updated script is downloaded without interrupting playback.
3. **Download validation:** The downloaded update is checked for completion before being made available.
4. **Update notification:** The app displays `UltimatiumTube updated – version X is ready`.
5. **Next-start activation:** The downloaded version becomes active the next time the app starts. Updates are never applied while the user is watching.
6. **Automatic rollback:** If an updated script fails to start, it is discarded within approximately 30 seconds and the built-in version is restored.

### Reliability and Fallback Protection

The updater is designed to avoid leaving the application unusable after a failed update.

- The original built-in script remains available as a fallback.
- Incomplete or broken updates are discarded.
- A failed startup automatically returns to the built-in version.
- Updates are activated only on a subsequent app launch.
- Automatic updates can be disabled under **Ultimate Dev Options → Automatic updates**.

### Testing and Verification

The self-updating mechanism was tested using the TV simulator.

| Test | Result |
|---|---|
| Detect a newer GitHub version | Passed |
| Download a newer script | Passed |
| Activate update on next startup | Passed |
| Reject a broken update | Passed |
| Restore built-in script after failure | Passed |
| Tizen 5.0 package update scenario | 22/22 passed |
| Tizen 5.5 package update scenario | 22/22 passed |
| Full application test suite | 527/527 passed |

**Testing note:** These results are from simulator testing. The self-updating mechanism has not yet been verified on a physical Samsung TV.

### What Can Be Updated?

The self-updater supports changes to:

- Application features and functionality
- Settings and configuration logic
- Welcome screen
- Bug fixes and improvements

Changes to the installed application itself, including permissions or the components responsible for launching YouTube, still require a new WGT installation.

**Important:** Users must install version **1.16.0 or newer** manually once to receive self-updating functionality. Older versions do not contain the updater.

---

## ⚡ Playback Speed Up to 20×

UltimatiumTube 1.16.0 also extends playback speed beyond YouTube's standard 2× limit.

### Features

- Playback speed selection up to **20×**.
- Default playback speed setting supports the extended range.
- Speeds above 2× are labelled **UltimatiumTube**.
- The speed menu displays `UltimatiumTube · up to 20x`.

### How 20× Playback Works

The Samsung TV video player has a native playback speed limit of 16×.

To support speeds above that limit, UltimatiumTube uses additional video-seeking operations to advance playback four times per second.

**Limitation:** Above 16×, playback relies on repeated video skipping rather than native continuous playback. Audio may therefore become choppy at these speeds.

---

## Release Information

- **Version:** 1.16.0
- **Self-updating:** Introduced
- **Maximum playback speed:** 20×
- **Platforms:** Samsung Tizen 5.0 and 5.5
- **Source changes:** Merged into [`main`](https://github.com/AdvaithAvinash/UltimatiumTube/pull/37)
- **Release status:** No GitHub release was created for this version at the time of documentation.

The self-updating system is designed to let UltimatiumTube evolve independently of its original WGT installation while retaining a built-in fallback for reliability.

