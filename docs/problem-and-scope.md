# Problem & scope

Source: team brainstorm (notebook photo, 2026-11-14) + [README](../README.md).

## Product
**LunaNav**, a web app: a decision layer on top of JPL Horizons, LOLA/LROC and NASA/USGS data.
It doesn't replace those tools. It combines them into one site-and-date comparison.

## Target user
Early-stage lunar mission planners (e.g. a university lunar mission team), with plain-language
explanations for educators and the public as a stretch goal.

## Scope
**We enable planners to make a decision. We don't make it for them.** LunaNav shows the trade-offs
(sunlight, Earth comms, terrain, science) with sources and uncertainty. It never outputs "land here".

## Time scale
- **Pre-planned:** compare candidate sites across a mission window.
- **On-the-spot:** re-evaluate quickly when something changes (e.g. launch slips two weeks).

## Data sources → question answered
| Source | Answers | Gap LunaNav fills |
|---|---|---|
| JPL Horizons | **When?** Sun & Earth position from a lunar site | Ignores local terrain → we add the LOLA horizon |
| NASA LOLA / LROC | **Where?** Elevation, slope, imagery | No vehicle-specific suitability → we add flat-patch analysis + hazard flags |
| NASA / USGS | **Why?** Geology, resources, mission history | Scattered → we curate a per-site science card |

## Hackathon priorities
- **P1:** Terrain-aware Sun/Earth visibility: Horizons + LOLA horizon profile, including libration.
- **P2:** Preliminary landing suitability: slope, roughness and flat-patch size. Unresolved hazards are flagged, never declared safe.
- **P3:** Side-by-side site/date comparison with evidence-linked science context.

## Architecture (stack TBD, see [open-questions](open-questions.md))
```
data/raw  ──►  src/ingest ──► src/visibility ─┐
(Horizons,                  ► src/suitability ├─► src/compare ─► src/api ─► app/ (web UI)
 LOLA, LROC, USGS, sites)   ► src/science ────┘
```
Heavy computation (horizon profiles, slopes) is precomputed into data/processed for the curated
sites, so the web app stays fast during the demo. Custom lat/lon is computed on demand if time allows.
