# Ordinary bomber release model — 2026-11-16

Shared implementation for the standalone viewer and MKTool. Canonical sampler: src/viewer-source.html functions bomberReleasePlan / sampleBomberSalvo / buildBomberSalvo. MKTool's generated/bomber-model.js is generated from that same function block using tools/build_bomber_model.py --source <aviation repo>/src/viewer-source.html.

## Evidence and model

WoWS 15.10 replays: Midway top, 24 attacks / 144 bombs; Hakuryu stock (actual replay ID), 18 / 54; Audacious top, 18 / 324. All 174 three-bomb network packs retain planeIndex order 1,0,2 when sorted laterally. Cross-release aircraft ranges overlap in 15/24 Midway attacks and all 18 Audacious attacks. Removing aircraft rank effects leaves first/last-release lateral correlations about .047/.055; this is not proof of independent RNG.

The candidate samples a fresh region for each release, sorts that batch laterally, and assigns bombs according to the selected aircraft's actual attack-formation X order. No exclusive aircraft bands are retained between releases. Multiple bombs from one aircraft in one release use contiguous sorted blocks, an unverified extension beyond these three replay cases. There are no ship-name branches or fitted per-ship coefficients.

Game inputs: attackerSize, projectilesPerAttack, attackCount, attackInterval, formations.attack, outer/innerSalvoSize, minSpread/maxSpread, innerBombsPercentage and speedMoveWithBomb. Missing formation or invalid payload disables the sample rather than inventing a layout. Unsupported line/mesh geometry is not sampled.

## Extents

Per-release full extent is 60 × salvo[axis] × selectedSpread[axis]. Fully aimed uses minSpread, immediate uses maxSpread. This replaces the old inverse-maxSpread normalization, which made the fully aimed region narrower than observed spans in these replays. The axis-wise multiplication is consistent with the recovered Korabli client bombing-zone calculation and these WoWS envelope observations; exact server sampling and full cross-version validation remain unavailable.

The longitudinal swept travel retains the existing estimate round(2.69 × speedMoveWithBomb × (attackCount-1) × attackInterval). Individual ellipse centers run from +travel/2 to -travel/2. The optional Combined releases envelope is the ellipse plus that line segment, containing all model release regions. The default Aiming outline view is an estimated ellipse whose longitudinal axis includes release travel, consistent in shape construction with the inspected Korabli client reticle renderer. These views are distinct; model points can extend beyond the aiming ellipse. Exact WoWS reticle projection and server sampling remain unverified.

## Probability and timing limitations

Uniform area density and Bernoulli innerBombsPercentage allocation are assumptions, not recovered server RNG. The actual aim centers/accuracy of the replay attacks were not reconstructed. Data-based regions may therefore differ from the observed cloud. Full-strength baseline only; actual plane losses and dynamic maneuvering are not modeled.

The release clock uses the raw nominal attackInterval. Network receipt times are not launch times, and no conversion was fitted from receipt intervals. Markers are planned impact positions revealed in release order; there is no fabricated airborne path, fall time, damage or hit probability.

New salvo generates a fresh uint32 seed. Replay and scrubbing retain points and seed. Aircraft identity, release index, projectile index, nominal release time and release center accompany every point and are included in JSON exports. Layout, reference and scale changes preserve the sample. Aiming-state changes invalidate it. Hidden documents/modal closure pause playback; legacy static samples remain displayable without a timeline.

## Descriptive comparison

1,000 simulated attacks per ship, seeds 1–1000. Spans are max-min per attack, in the existing BW×30 map display units. No coefficients were tuned to these medians.

| Ship | Replay median width | Model median width | Replay median length | Model median length |
|---|---:|---:|---:|---:|
| Midway | 46.2 | 45.6 | 208.8 | 187.0 |
| Hakuryu stock | 31.8 | 23.3 | 112.8 | 93.4 |
| Audacious | 102.8 | 103.6 | 521.8 | 483.2 |

The Hakuryu difference remains open. Matching lateral medians for the other two is not an accuracy percentage or validation of the full density. Model aircraft-range overlap rates are .590 / .000 / .996, versus 15/24, 0/18 (one release), 18/18 observed.

## Validation

- Aviation: 47 explicit unit tests, static build, ordinary-bomber browser tests and existing full UI browser suite.
- All 267 unique normal-bomber aircraft inputs across the four bundled versions construct a valid sample; this checks data coverage, not game fidelity.
- MKTool: shared-kernel seed/group/timing tests and exact canonical-block parity; real modal payloads, Replay/New salvo/scrubbing, seven languages, mobile and close cleanup; existing skip-bomber seven-language/compare/replay regression.
- Aggregate replay fixture contains no raw replay, player identity or absolute coordinates.

Graf Zeppelin audit: the bundled data give 2 aircraft × 1 bomb, one release and no swept travel. Generic full-aim map-space extents are 112.2 × 139.8. An official WoWS introduction calls its crosshair circular; screen projection versus map-space extent is unresolved. No forced circle or ship-name correction was introduced, and no Graf Zeppelin replay has been analyzed.
