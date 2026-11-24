## UltimatiumTube Stable v1.18

**Which file:** UltimatiumTube is supported on Tizen 3.0 and newer.
- Tizen 5 or under (3.0, 4.0, 5.0): `UltimatiumTubetizen5.0.wgt`
- Tizen 5.5 or above: `UltimatiumTubetizen5.5.wgt`
- Android TV, Google TV, Fire TV: `UltimatiumTube.apk`

**Reinstall needed** on Samsung TVs: the part of the app that loads YouTube changed. **Android: uninstall the old app first**, then install this one (it is signed with a new key).

### New
- **UltimatiumTube mode is the real YouTube app.** YouTube serves a full TV app to Samsung's own YouTube app and a cut-down one to a TV's web browser. UltimatiumTube now gets the full one through its small service on the TV: Shorts in the Shorts player, one after another, with the sequence YouTube itself sends; search and results as in the app. If the service does not answer within a few seconds, YouTube is loaded directly, so the app always opens.
- **Three modes**, offered each time the app opens and under Settings > UltimatiumTube > Interface mode:
  - **UltimatiumTube**: the YouTube app as Samsung's own app gets it, with everything UltimatiumTube adds.
  - **SmartTube UI**: UltimatiumTube's own home screen in SmartTube's manner, with a side menu, rows of your videos and its own quick search (suggestions as you type, results in about a second).
  - **YT Dummy**: YouTube exactly as youtube-dummy loads it.
- **Welcome to UltimatiumTube** once each time the app opens, not again when YouTube reloads itself after a sign-in.
- **Shorts in the Shorts player in every mode.**

### Fixed
- SmartTube UI's Search stays in the SmartTube screen instead of switching to YouTube's.
- The SmartTube home screen no longer covers the Shorts player.
- SmartTube UI reads YouTube's newer card format (search results).

The `.wgt` files are unsigned: install them with Apps2Samsung, Tizen Homebrew or Tizen Studio, which sign them for your TV.
