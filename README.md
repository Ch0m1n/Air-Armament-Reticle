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
- Light mode is the default; the header theme control switches to dark mode and remembers the preference locally.
- **Add Ship** creates independent editors (up to 12), each with version, nation, type, ship, armament, research module and aircraft selectors.
- Editable ship labels, clone/remove controls and per-editor Modifiers support variant comparisons. Original values and help tooltips are provided; reset restores original inputs.
- Results have separate bomber, torpedo bomber and airstrike tabs. Attack aircraft and skip-bomber tabs are reserved; their geometry is not implemented.
- Reserved tabs display the provided animated maintenance WebP in place of results; the original animation is preserved.
- Card/list comparison layouts, same scale within each armament type, Yamato reference, illustrative airstrike drops, share links, JSON import and result export are included.
- Overrides do not mutate repository data. Edits persist in clones and shared links. Uploaded results can be exported, not shared as repository links.

## Windows Data Publisher

Double-click **Data-Publisher.cmd**. Requires PowerShell 7, Node.js 22+, Git and an authenticated GitHub CLI (`gh auth login --hostname github.com`). The repository destination is fixed to `Ch0m1n/Air-Armament-Reticle`.

1. Browse to the WoWS and Korabli extracted JSON roots once. Settings stay in `%LOCALAPPDATA%/WoWS-Korabli-Air-Armament-Reticle/publisher-settings.json`, outside the repository.
2. Select the game and enter a version name. A source root can contain the three data folders directly, or contain version subfolders; `15.10` can resolve a `1510` subfolder.
3. **Preview files** validates references and shows the resolved source, destination, file counts, size and skipped references. Nothing is uploaded.
4. **Upload to GitHub** asks for public-upload confirmation. An existing target version is refused unless **Replace existing version** is enabled.

Only supported linked ships/aircraft/projectiles are selected. ASW/DC and currently unsupported geometry are excluded. No unrelated directories, path settings or credentials are copied. The uploader works in a disposable clone, runs index/tests/build, stages only `GAME/<game>/<version>/`, and performs a normal non-force push. Other versions and your working checkout are not modified. Preview hashes block unnoticed source changes. Failed pushes preserve the committed recovery checkout; successful updates trigger the existing Pages workflow. This program does not wait for the Pages deploy to finish.

## Tests

`npm test` uses invented values generated in ignored temporary directories. No real game dataset is needed or embedded in fixtures. Tests cover index isolation, research links, calculations, modifier validation and empty catalogs.

`node tests/browser.cjs` additionally needs an available Playwright package and Chrome (`MK_CHROME_PATH`). It checks the empty production build, then builds an isolated synthetic test site for comparison, modifiers, tooltip, sharing, import/export and responsive checks. Synthetic data is not included in `dist/`.

## GitHub Pages

The **Publish reticle viewer** workflow tests and builds on pushes to `main`, then deploys `dist/`. Set Settings -> Pages -> Source to **GitHub Actions**. Relative URLs support the repository subpath. Assets and catalog files use content-hashed names.

## Boundaries and Rights

Calculations are estimates, not verified game RNG or ship hit probability. Terrain, build effects and full dynamic aiming are not reproduced. Inner allocation is not hit chance. Torpedo horizontal geometry remains schematic. Airstrike timing estimates activation to first impact; animations illustrate releases rather than real-time impact.

The calculation/drawing core is extracted from the existing offline viewer in `src/viewer-source.html`; its old UI is not used. The independent site lives in `src/shell.html`, `src/site.css` and `src/site.js`. The Yamato reference bitmap is retained as a visual asset (263 x 38.9 m), not a Ship JSON dataset.

This is an unofficial fan tool. Game-derived imagery belongs to its respective rights holders. Selected Lucide icons are vendored with their license in `src/vendor/lucide-LICENSE`. No third-party runtime scripts load from a CDN. The reference wows_ballistics project informed the interaction structure; its implementation was not copied.
