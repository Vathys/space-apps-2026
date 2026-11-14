# Problem & scope

Status: proposed scope D-10 ([decisions.md](decisions.md)). The earlier scope (visibility + landing
suitability + science comparison, D-07) is superseded.

## Target user
Early-stage lunar mission planners deciding where and when a south-pole surface mission can keep in
touch with Earth.

## Problem
At the lunar south pole, Earth hangs within a few degrees of the horizon and moves with libration, so
direct-to-Earth (DTE) line of sight comes and goes, and nearby ridges block it for long stretches.
Relay satellites can bridge the gaps, but whether a given relay orbit helps at a given site and date
takes specialist analysis: Horizons for Earth geometry, LOLA for terrain, orbit propagation for the
relay, then path logic on top.

## What LunaNav does
A web-based communication network simulator:
1. Select a south-pole landing site.
2. Select a mission date and duration (inside the supported data window).
3. Analyze DTE geometric visibility against the real terrain horizon.
4. Simulate a lunar relay satellite configuration.
5. Compare direct vs relay-assisted communication.
6. Report coverage %, blackout intervals and the longest blackout.
7. Explore how site, date and relay configuration change those numbers.

Sunlight (Sun vs terrain horizon) is shown alongside, keeping the original challenge's Sun/Earth ask.

**Scope stance:** we *enable* a planner's decision. We show geometric line-of-sight, its sources and
its limits. We never claim a link is guaranteed, and never present a simulated relay as an operating
service.

## Data sources → question answered
| Source | Answers | What LunaNav adds |
|---|---|---|
| JPL Horizons | Where Sun and Earth are, from a lunar site, at time T | Terrain blocking, plus relay paths when Earth is blocked |
| NASA LOLA (+ PGDA 5 m) | Elevation around the site | A 360° horizon mask reaching distant ridges |
| Relay orbital elements (relays.csv, NASA LCRNS studies as reference) | What orbits relays fly | Propagated positions, lander → relay → Earth path checks, coverage metrics |

## Out of the MVP
Landing flatness and touchdown safety; geological, mineralogical and sample-value ranking; automated
research; detailed radio link budgets; full inter-satellite networking; high-fidelity mission design;
photorealistic 3D and any 3D globe. (The P1 lander sky view, D-21, is a data-driven 3D scene, not photorealism.)

## Time scale
Pre-planned analysis inside the supported window, and quick re-evaluation (e.g. "the launch slips two
weeks"): the browser recomputes instantly from precomputed samples.

## Architecture
See [architecture.md](architecture.md) (six diagrams) and [data-contracts.md](data-contracts.md).
