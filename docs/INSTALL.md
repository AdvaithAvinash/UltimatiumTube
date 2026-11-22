# Installing UltimatiumTube

Three files, one for each kind of TV:

| File | For |
| --- | --- |
| `UltimatiumTubetizen5.5.wgt` | Samsung TVs on Tizen 5.5 and newer (2020 and later) |
| `UltimatiumTubetizen5.0.wgt` | Samsung TVs on Tizen 5.0 and older (2019 and earlier) |
| `UltimatiumTube.apk` | Android TV, Google TV, Fire TV, an Android phone or tablet |

Settings > General > About This TV shows the TV's software version. The Tizen version is not named
there, but the model year says: 2019 is Tizen 5.0, 2020 is 5.5, and later years are newer.

## Samsung TV

A Samsung TV installs only an app signed for that exact TV, so the `.wgt` files are unsigned. They
are signed when you install them. All three routes below need the TV in **Developer mode**.

### Developer mode, once

1. On the TV open **Apps**, then press `1 2 3 4 5` on the remote. A Developer mode window opens.
2. Switch Developer mode **On**, and type the IP address of the computer you will install from.
3. Restart the TV (switch it off and on with the remote, not just standby).

### Apps2Samsung

1. Open Apps2Samsung and connect to the TV's IP address.
2. Choose the `.wgt` for your TV, `UltimatiumTubetizen5.5.wgt` or `UltimatiumTubetizen5.0.wgt`, and
   install it. Apps2Samsung signs it with your certificate.
3. Open **UltimatiumTube** from the TV's apps.

The two files carry the same app id, name and icon, so a catalogue that lists both sees one app. A TV
needs only one of them.

### Tizen Homebrew

1. Set up [Tizen Homebrew](https://github.com/SushyDev/tizen-homebrew) by its README.
2. Open it on the TV and use the **Upload** tab to load the `.wgt`.

### Tizen Studio

Add a Samsung certificate profile that includes your TV's DUID, then **Device Manager** > connect the
TV > install the `.wgt`; or `tizen install -n UltimatiumTubetizen5.5.wgt -t <your TV>`.

### Which file

**UltimatiumTube is supported on Tizen 3.0 and newer.** Tizen 5 or under (3.0, 4.0, 5.0): install
`UltimatiumTubetizen5.0.wgt`. Tizen 5.5 or above: install `UltimatiumTubetizen5.5.wgt`.

### First start

The app shows *Loading YouTube...*, then YouTube's home screen with a welcome panel that asks which
interface you want: **Stock YouTube UI** or **SmartTube UI**. Change it later under Settings >
UltimatiumTube > Interface mode.

The app loads YouTube's TV page itself and opens it in the TV's own web engine (the way youtube-dummy
does), so it does not depend on Samsung's Cobalt container or on a service on the TV answering.

### "Cannot reach YouTube"

The TV could not fetch YouTube's TV page: check that the TV is online (another app streams), that a
VPN, DNS filter or router does not block www.youtube.com, and wait: the app tries again every few
seconds on its own.

### The extras: phone settings, wallpapers, Stremio

These come from the app's small service on the TV. The TV starts it at boot and after an install, not
when you press the icon: if they do not work, switch the TV off at the remote and on again (not
standby). The service needs the app signed with a Samsung certificate at the partner level (in
Apps2Samsung, **Force Samsung Certificate** and **Partner Signing**). YouTube itself works without it.

### Other YouTube apps on the same TV

UltimatiumTube no longer runs in the TV's one YouTube container, so it does not compete with YouTube for
Tizen, TizenTube Cobalt or the stock YouTube app, and its ports, folders and package id are its own.

## Android TV, Google TV, Fire TV

1. Allow installing from unknown sources: Android TV and Google TV, **Settings > Apps > Security &
   restrictions > Unknown sources** (or when the install prompts you). Fire TV, **Settings > My Fire
   TV > Developer options > Install unknown apps**.
2. Get the file onto the TV: **Downloader** (type the link to the `.apk`), a USB stick, or
   `adb install UltimatiumTube.apk` (`adb connect <the TV's address>` first).
3. Open **UltimatiumTube** from the apps row.

If YouTube can't be reached, the app says so, with the reason, and tries again every few seconds; OK
tries at once and Back leaves.

Back goes back. Holding Back for a second leaves the app. The coloured buttons and the media keys
on the remote work as they do on a Samsung TV (blue opens the speed menu).

An update is installed over the old version. It has to be signed with the same key, which is why the
build keeps it in `~/.ultimatiumtube/`.

## Settings from your phone

Open the address shown under **Settings > UltimatiumTube > Channels and words** on the TV, with
`/settings` at the end, on a phone or computer on the same network. It needs no internet.
