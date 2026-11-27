## UltimatiumTube Stable v1.18.2

**Which file:** UltimatiumTube is supported on Tizen 3.0 and newer.
- Tizen 5 or under (3.0, 4.0, 5.0): `UltimatiumTubetizen5.0.wgt`
- Tizen 5.5 or above: `UltimatiumTubetizen5.5.wgt`
- Android TV, Google TV, Fire TV: `UltimatiumTube.apk`

**Reinstall needed** on Samsung TVs: the part of the app that starts its service and loads wallpapers changed. Android: if you are coming from v1.17 or older, uninstall the old app first (the APK has been signed with a new key since v1.18).

### Fixed
- **Ads.** YouTube's TV app reads some of its answers a way UltimatiumTube's ad removal did not see; they are cleaned now too. YouTube also now cuts some ads on TVs straight into the video, where there is nothing to remove beforehand: while one plays it is muted, sped up to 16x, and Skip is pressed the moment it appears. Sound and speed come back after it.
- **Wallpapers** come from the app's own files, so they show even when the app's service is not running.
- **The app's service starts with the app.** The TV only started it at boot or install, so UltimatiumTube mode could not get the real YouTube app page (search and Shorts looked like a browser's). The app now starts it every time it opens; if it still does not come up within a few seconds, YouTube loads anyway and a notice says so.
- **Search as you type it.** Smart search now rewrites only clear requests and questions ("find videos about ..."), never ordinary searches.

### Also in v1.18
- Three modes: **UltimatiumTube** (the YouTube app as Samsung's own app gets it), **SmartTube UI** and **YT Dummy**.
- Welcome to UltimatiumTube with Close and Don't show again.

The `.wgt` files are unsigned: install them with Apps2Samsung, Tizen Homebrew or Tizen Studio, which sign them for your TV.
