# Wallpapers

Pictures offered under **Settings > UltimatiumTube > UltimatiumTube Ultimate Settings > Customization
> Wallpaper**. They are packed into the Samsung widgets and the Android app and shown at
`/__tube/wallpapers/<file>` (the TV's service serves them on a Samsung TV; the app does on Android).

`blue-flames.jpg` is a stand-in, drawn for this project (`tools/draw_wallpaper.py`), not a photograph.
To use a picture of your own as "Blue flames", replace `blue-flames.jpg` with it (a 1920x1080 JPEG of
a few hundred KB is right) and run `npm run package` and `npm run package:android`. To offer another
one, add the file here and list it in `WALLPAPER_FILES` in `mods/theme/index.js`.
