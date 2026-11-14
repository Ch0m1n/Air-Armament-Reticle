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

New salvo generates a new illustrative sample and resets the playback position.
Press Play to view it. Reset, replay and loops retain that sample. All three
release-timing comparisons use the same sample with different release origins.
Stage samples are independently stratified within the recovered footprint bounds;
the game's random-number distribution and inter-stage correlations are unknown.
Individual flight times and bounce heights depend on sampled contact geometry.

## Yamato reference and contacts

The reference is 263 x 38.9 ship meters. The native ship-to-map scale is x2;
side-view height is additionally exaggerated x2 for visibility. Top and side
views use consistent world-space bomb positions and contact timestamps.

Orange markers stop at the earliest approximate hull contact. Misses continue.
The top-view alpha silhouette supplies lateral bounds; the side image supplies
fore/aft roof heights. These heights are extended across the top-view width,
which can overestimate superstructure width and fills gaps and overhangs.
This is a solid height envelope, not a 3D collision mesh. Thin rigging is excluded.
Trajectory segments near the hull are sampled at no more than 0.25 map meters
and the first entry is refined by bisection; narrower features may be missed.

Waterlines are estimated from the supplied reference images. Side-image length
registration gives approximately 10.42 m draft, compared with 10.4 m in the front
reference. At 90 degrees the supplied side image is shown; 0 degrees uses the
front image. Other headings use a projected roof silhouette.

Changing target position, heading, dispersion or release offset updates contacts.
Rewind and reset clear visible markers until their contact times are reached.
No armor penetration, damage, underwater-strike or verified game RNG simulation
is included. Game-derived imagery belongs to its respective rights holders.
