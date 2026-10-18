# WoWS-Korabli Air Armament Reticle

A static comparison tool for aircraft weapon aiming areas, built for GitHub Pages.
Site: https://ch0m1n.github.io/Air-Armament-Reticle/
**This skeleton includes no real Ship, Aircraft or Projectile JSON datasets.** Both game libraries start empty.

## Local Development

Node.js 22 or later. No runtime npm packages or installation are required.

```sh
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:8776/. Builds recreate only the generated, ignored `dist/` directory.

## Data Layout

```text
GAME/
  WOWS/<version>/
    Aircraft/
    Projectiles/
    Ships/
  KORABLI/<version>/
    Aircraft/
    Projectiles/
    Ships/
```

Add a version's matching JSON references to its three directories. Folder names are case-sensitive. Builds discover versions and generate `GAME/catalog.json`; that index is not hand-maintained or committed. No data is fetched from an external game API. Uploaded JSON stays in the browser.

Optional version-local `dataset.json` fields: `dataset` (label), `snapshot`, `default` (initial version), and `defaults` (initial aircraft IDs). Without metadata, the index uses the game/version label and the first three supported entries. Version names must start with a letter or digit and contain only letters, digits, dots, underscores and hyphens. An empty GAME directory is valid.

An optional local importer accepts explicit ship codes, never a hard-coded sample list:

```sh
node tools/import-game-data.mjs /path/to/source KORABLI version-name SHIPCODE
```

The importer accepts singular `Ship`/`Projectile` source folders as well as plural names. References stay within one game version. Verify your rights to distribute datasets before adding them to a public repository.

## Interface

- Select World of Warships or Korabli in the header.
- **WoWS-MK** compares both games in one workspace. Each ship editor has its own Game and Version selectors; name suffixes such as `(WoWS)` and `(Korabli)` identify the source. Identical internal IDs remain isolated by game/version, including in shared links. Same scale still applies within each armament type. Single-game tabs keep their existing separate sessions. Local JSON import remains available in single-game tabs only, where its game context is unambiguous.
- Light mode is the default; the header theme control switches to dark mode and remembers the preference locally.
- **Add Ship** creates independent editors (up to 12), each with version, nation, type, ship, armament, research module and aircraft selectors.
- Editable ship labels, clone/remove controls and per-editor Modifiers support variant comparisons. Original values and help tooltips are provided; reset restores original inputs.
- Results have separate bomber, torpedo bomber and airstrike tabs. Attack aircraft and skip-bomber tabs are reserved; their geometry is not implemented.
- Reserved tabs display the provided animated maintenance WebP in place of results; the original animation is preserved.
- Card/list comparison layouts, same scale within each armament type, Yamato reference, illustrative airstrike drops, share links, JSON import and result export are included.
- Overrides do not mutate repository data. Edits persist in clones and shared links. Uploaded results can be exported, not shared as repository links.

## Windows Data Publisher

Double-click **Data-Publisher.exe** after building the Windows launcher with `pwsh -NoLogo -NoProfile -File tools/build-publisher.ps1`. **Data-Publisher.cmd** remains a fallback. The EXE opens the existing GUI without a console; keep it beside the `tools` and `src` folders, not by itself. Requires PowerShell 7, Node.js 22+, Git and an authenticated GitHub CLI (`gh auth login --hostname github.com`). The repository destination is fixed to `Ch0m1n/Air-Armament-Reticle`.

1. Browse to the WoWS and Korabli extracted JSON roots once. Both paths, the selected game and version are restored on the next launch. Typed edits auto-save after a short pause; the folder picker starts at the field's current folder or the last browsed folder. Settings stay in `%LOCALAPPDATA%/WoWS-Korabli-Air-Armament-Reticle/publisher-settings.json`, outside the repository, with a previous-settings backup.
2. Select `WOWS`, `KORABLI`, or `BOTH` and enter the corresponding game versions in the separate WoWS/Korabli fields. `BOTH` scans both sources sequentially, reports progress/ETA for the current game, previews combined totals and both destinations, then uploads both datasets in one commit/push. Both previews must succeed and match the upload-time recheck; either failure blocks the entire upload. Game-specific versions and the mode are remembered. A source root can contain the three data folders directly, or contain version subfolders; `15.10` can resolve a `1510` subfolder.
3. **Preview files** validates references and shows the resolved source, destination, file counts, size and skipped references. During scanning, it displays completed/total ships, percentage and estimated remaining scan time. Estimates fluctuate with file size and disk speed; repository download, validation and upload show their current stage without a fabricated ETA. Nothing is uploaded during preview.
4. **Upload to GitHub** asks for public-upload confirmation. An existing target version is refused unless **Replace existing version** is enabled.

Only supported linked ships/aircraft/projectiles are selected. ASW/DC and currently unsupported geometry are excluded. No unrelated directories, path settings or credentials are copied. The uploader works in a disposable clone, runs index/tests/build, stages only `GAME/<game>/<version>/`, and performs a normal non-force push. Other versions and your working checkout are not modified. Preview hashes block unnoticed source changes. Failed pushes preserve the committed recovery checkout; successful updates trigger the existing Pages workflow. This program does not wait for the Pages deploy to finish.

Eligibility is per usable aircraft/weapon connection, not a ship-name allowlist. Ships with no supported aviation or only ASW airstrikes are omitted. Ships that combine HE airstrikes and ASW are retained, but their DC aircraft/projectiles are not uploaded. Carrier/hybrid strike aircraft are also eligible when supported. Preview lists included and excluded ships and counts ASW-only exclusions and mixed-weapon ships retained. Input `Ship` and `Projectile` are accepted; repository folders remain the established plural `Ships` and `Projectiles`.

## Tests

Publisher **Scan workers** selects 1 (sequential), 2 (default), or 4 parallel workers and remembers the selection. Both mode processes games sequentially using that bounded worker count within each game. Each scan/recheck reads source files anew; no persistent scan-result cache is used. Worker results merge deterministically and shared-file content disagreements abort the scan. Disk speed, dataset size and worker startup overhead affect performance. CLI accepts `--workers 1|2|4` (without the option it uses up to 4 CPU workers). Runtime files must include `tools/publisher-scan-worker.mjs` alongside the publisher backend.

Ship selectors sort by ascending tier, then name. Ships whose JSON `group` is `disabled` or `preserved`, or whose filenames/codes contain those markers (case-insensitive), are excluded from publisher selection and catalog indexing. To remove them from an already published dataset, preview and upload that version again with **Replace existing version** enabled.

`npm test` uses invented values generated in ignored temporary directories. No real game dataset is needed or embedded in fixtures. Tests cover index isolation, research links, calculations, modifier validation and empty catalogs.

`node tests/browser.cjs` additionally needs an available Playwright package and Chrome (`MK_CHROME_PATH`). It checks the empty production build, then builds an isolated synthetic test site for comparison, modifiers, tooltip, sharing, import/export and responsive checks. Synthetic data is not included in `dist/`.

## GitHub Pages

The **Publish reticle viewer** workflow tests and builds on pushes to `main`, then deploys `dist/`. Set Settings -> Pages -> Source to **GitHub Actions**. Relative URLs support the repository subpath. Assets and catalog files use content-hashed names.

## Boundaries and Rights

For WoWS torpedo cards only, Yamato is rendered at an explicitly labeled approximate in-game magnification of 2 relative to map distances (physical length 263 m, displayed extent about 526 map meters), following the [official wiki map-scale explanation](https://wiki.worldofwarships.com/Ship:Maps). This changes only the reference image, not sector widths, distance axes, or arming/target center distances. Korabli and unknown-game references remain at physical scale pending verification. This correction is not applied to bomber/airstrike cards.

Calculations are estimates, not verified game RNG or ship hit probability. Terrain, build effects and full dynamic aiming are not reproduced. Inner allocation is not hit chance. Torpedo sectors use the [published reverse-engineered width model](https://www.reddit.com/r/WorldOfWarships/comments/1975jry/): formation X span and minSpread at torpedoAimDist, converted at 30 m per raw unit. Each sector extends to its own projectile maximum range; moving the target does not change the viewing scale. Same scale uses the longest compared range to fit the diagrams, while each card labels its own endpoint. Both axes use one metric scale; WoWS reference magnification is described above. No arbitrary 4-degree parallel threshold or fixed fan-width multiplier is applied. This is a full-group, fully aimed estimate, not current-client validation: client boundary padding, build modifiers, partial groups, per-aircraft payload spacing and trajectories are not reproduced. Historical disassembly also references a boundary-padding constant whose current value is not established here. Airstrike timing estimates activation to first impact; animations illustrate releases rather than real-time impact.

The calculation/drawing core is extracted from the existing offline viewer in `src/viewer-source.html`; its old UI is not used. The independent site lives in `src/shell.html`, `src/site.css` and `src/site.js`. The Yamato reference bitmap is retained as a visual asset (263 x 38.9 m), not a Ship JSON dataset.

This is an unofficial fan tool. Game-derived imagery belongs to its respective rights holders. Selected Lucide icons are vendored with their license in `src/vendor/lucide-LICENSE`. No third-party runtime scripts load from a CDN. The reference wows_ballistics project informed the interaction structure; its implementation was not copied.
