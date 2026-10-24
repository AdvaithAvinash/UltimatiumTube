# Keeping up with YouTube for Tizen

UltimatiumTube began as a copy of [YouTube for Tizen](https://github.com/SushyDev/tizen-youtube)
at commit `02c4d8b`. YouTube changes its TV app without notice, and that project is where the fixes
appear first. This repository is not a git fork of it, so nothing merges on its own.

- `node tools/upstream.js` lists the commits and files changed upstream since the commit in
  `tools/upstream.js` (`BASE`).
- `.github/workflows/upstream.yaml` runs it every Monday and opens, or refreshes, one issue
  labelled `upstream` when there is something new.

## Bringing a change over

1. Read the upstream commit. Most fixes touch `mods/`, `framework/` or `service/lib/`.
2. Apply it here by hand. Files this project has changed (`mods/settings/`, `mods/sponsorblock/`,
   `framework/runtime/config.js`, `service/lib/ports.js`, `app/config.xml`) need the change merged
   into them rather than copied over.
3. `npm test`, then `npm run package`.
4. Set `BASE` in `tools/upstream.js` to the upstream commit you have now taken everything up to.

## Not shared with it

These are deliberately different, so both can be installed on one TV:

| | YouTube for Tizen | UltimatiumTube |
| --- | --- | --- |
| Service port | 8099 | 8189 |
| Dev port | 8097 | 8187 |
| Folder on the TV | `/home/owner/share/tube` | `/home/owner/share/ultimatiumtube` |
| Boot page | `file:///tube/boot.html` | `file:///ultimatiumtube/boot.html` |
| Dial name | `Tube` | `UltimatiumTube` |
| Widget and package id | `tUb3Xq7Lm9` | `U1tmTube55` |

TizenTube keeps its own ports (8100 and 8101) and folder as well.

One thing cannot be separated: every one of these apps claims Samsung's YouTube container slot
(`com.samsung.tv.cobalt-yt`), the only way to run inside the TV's own YouTube engine. A TV runs
one container at a time, so only one of them can be open at once. Close the other app, or switch
the TV off and on, before opening this one. The boot screen and the diagnostics page say so when
another app is holding the slot.
