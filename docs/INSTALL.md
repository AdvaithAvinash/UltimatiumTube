# Installing UltimatiumTube

Three files, one for each kind of TV:

| File | For |
| --- | --- |
| `UltimatiumTubetizen5.5.wgt` | Samsung TVs on Tizen 5.5 or newer (2020 and later) |
| `UltimatiumTubetizen5.0.wgt` | Samsung TVs on Tizen 5.0 (2019) |
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

### First start

The first launch shows a short boot log while the app prepares its certificate. Then YouTube's home
screen opens. If it stays on the log, the page names what it waits on, with an address to open on a
phone that says what failed.

### Other YouTube apps on the same TV

UltimatiumTube does not clash with YouTube for Tizen or TizenTube over ports, folders or package ids.
They do all run in the TV's one YouTube container, so close the other app, or switch the TV off and
on, before opening this one.

## Android TV, Google TV, Fire TV

1. Allow installing from unknown sources: Android TV and Google TV, **Settings > Apps > Security &
   restrictions > Unknown sources** (or when the install prompts you). Fire TV, **Settings > My Fire
   TV > Developer options > Install unknown apps**.
2. Get the file onto the TV: **Downloader** (type the link to the `.apk`), a USB stick, or
   `adb install UltimatiumTube.apk` (`adb connect <the TV's address>` first).
3. Open **UltimatiumTube** from the apps row.

Back goes back. Holding Back for a second leaves the app. The coloured buttons and the media keys
on the remote work as they do on a Samsung TV (blue opens the speed menu).

An update is installed over the old version. It has to be signed with the same key, which is why the
build keeps it in `~/.ultimatiumtube/`.

## Settings from your phone

Open the address shown under **Settings > UltimatiumTube > Channels and words** on the TV, with
`/settings` at the end, on a phone or computer on the same network. It needs no internet.
