# Skip-bomber trajectory preview

The existing site's Skip bombers comparison tab reconstructs trajectories from
each selected aircraft and matching projectile. Each selected ship has its own
embedded controls; the ship/module selection is made in the existing editors.
Korabli baseline inputs and visual trajectory helpers were checked against the
26.11.1 client. WoWS uses the Korabli trajectory model as a labeled estimate;
its game-specific display helpers have not been independently verified. Legacy
`skips` and ordered `SkipsSequence` inputs are supported. This is not an in-game
capture, a hit-probability calculator, or an armor/damage model.

## Dispersion and playback

New salvo all rerolls the illustrative dispersion for every compared aircraft,
updates their flight durations, resets the common clock to zero and starts
shared playback immediately. It can also restart a currently playing comparison.
Reset all and later replay retain those new samples. Each ship's three timing
scenarios continue to use the same sample.

The site's card/list controls arrange multiple selected ships side by side or
in full-width rows. Same scale selects a common pixels-per-map-meter ratio
across all visible ship plots, separately for top and side views. Side-view
height uses the same scale as horizontal distance. The smallest independently
requested scale is used to fit every selected plot, including timing scenarios;
scales are recomputed after viewport and display-range changes. Turn Same scale
off to fit each ship independently. Layout and scale changes preserve samples,
controls and paused playback positions.

Play all uses one elapsed-seconds clock for every selected aircraft. Pause all,
Reset all and the shared time slider update every ship together. For example,
2 seconds means the position 2 seconds after release for every aircraft,
regardless of each flight's total duration. Completed flights hold their last
position; the shared clock stops when the longest flight ends. Individual loop
settings do not apply during shared playback. Existing salvos are retained.
An individual Play/Reset/New salvo/aim/time control exits shared playback.
Layout, scale or tab changes pause shared playback and retain its time; Play all
resumes it. Hiding the browser page also pauses the shared clock.

New salvo generates a new illustrative sample and resets the playback position.
Press Play to view it. Reset, replay and loops retain that sample. All three
release-timing comparisons use the same sample with different release origins.
Stage samples are independently stratified within the recovered footprint bounds;
the game's random-number distribution and inter-stage correlations are unknown.
Individual flight times and bounce heights depend on sampled contact geometry.

## Yamato reference and contacts

The reference is 263 x 38.9 ship meters. The native ship-to-map scale is x2;
side-view height uses the same scale as horizontal distance. Top and side
views use consistent world-space bomb positions and contact timestamps.

Orange markers stop at the earliest approximate hull contact. Misses continue.
The top-view alpha silhouette supplies lateral bounds; the side image supplies
fore/aft roof heights. The front image supplies transverse width at each height.
Intermediate-angle drawing and above-water contact both intersect these three
constraints. Upper structures no longer inherit the full hull beam at every
height. The projection can widen with rotation because the ship's longitudinal
extent becomes visible; it does not add arbitrary padding. Hidden geometry,
gaps inside each silhouette row and overhangs remain approximate. This is not a
3D collision mesh. Thin side-view rigging is excluded by the roof extraction.
Trajectory segments near the hull are sampled at no more than 0.25 map meters
and the first entry is refined by bisection; narrower features may be missed.

Waterlines follow the supplied reference images. The front waterline is at the
user-identified gray/green paint boundary (approximately y=642 in the original
587x795 image). Its image-derived submerged depth is about 10.11 m using the
38.9 m beam calibration; the image is not stretched to force nominal 10.4 m draft.
Side-image registration gives approximately 10.42 m draft. These image-derived
values are approximate. Front and side bitmaps retain their original aspect
ratios; no underwater extension is added to them. The previous x2 vertical
exaggeration has been removed from both the ship references and trajectories.
At 90 degrees the supplied side image is shown; 0 degrees uses the
front image. At 180 degrees the same front reference image is reused as a
simplified end-on silhouette; it is not a separately captured stern image.
Intermediate headings use a projection of the combined silhouette constraints. Contact geometry still
uses the selected heading, including the fore/aft reversal at 180 degrees.

Changing target position, heading, dispersion or release offset updates contacts.
Rewind and reset clear visible markers until their contact times are reached.
No armor penetration, damage, underwater-strike or verified game RNG simulation
is included. Game-derived imagery belongs to its respective rights holders.
