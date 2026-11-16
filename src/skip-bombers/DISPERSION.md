# Aircraft-group skip-bomb dispersion (2026-11-16)

The simulator now retains the selected aircraft's attack-group structure. Each
attacking aircraft is assigned one lateral region for the entire salvo. Every
bomb from that aircraft is sampled afresh inside that region at each contact;
two bombs from the same aircraft may exchange lateral order. Stage-specific
width/depth coefficients and shared pack bounce-speed reference are retained.
Longitudinal coordinates remain sampled independently by stage.

attackerSize, projectilesPerAttack and attackCount must be positive integers.
The reconstructed attackGroup exposes aircraft, projectilesPerRelease and
releases. Each sampled bomb exposes planeIndex, releaseIndex and projectileIndex.
Multiple-release timing is not modeled. The renderer's existing payload line
shows aircraft count and total bombs per aircraft in all seven languages.

Replay evidence: Korabli 26.11.1 Nakhimov 11 salvos (7 aircraft, 1 bomb each),
WoWS 15.10 Bearn 20 salvos (2 aircraft, 2 bombs each), Immelmann 26 comparison
salvos and Shinano 23 (4 aircraft, 1 bomb each). The probable partial-aim
Immelmann salvo was excluded from the full-aim aggregate. All observed aircraft
groups retained left/right order. Bearn's individual bombs did not.

500-seed baseline comparison (C0 versus last contact, centered by salvo/stage):

| Aircraft | Replay lateral correlation | Model lateral correlation |
|---|---:|---:|
| Bearn | 0.7543 | 0.7981 |
| Immelmann | 0.9505 | 0.9518 |
| Shinano | 0.9485 | 0.9518 |
| Nakhimov | 0.9839 | 0.9824 |

These are pattern comparisons, not accuracy percentages. The Bearn difference
is retained openly; no ship-specific correlation factor is fitted. Real flight
state, builds and exact aim vary from the baseline. Equal region widths,
uniform within-region jitter and longitudinal independence remain assumptions.
The server random generator and full probability distribution are unknown.

New salvo rerolls every bomb's points. Replay/reset and timing comparisons reuse
the same seed. Shared playback continues to use actual elapsed seconds. No
armor/damage model or validated hit probability is added. No raw replay files,
player identifiers or absolute replay coordinates are included in the codebase.
