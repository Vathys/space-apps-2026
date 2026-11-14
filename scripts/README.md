# scripts/

Offline steps, run with `bun run precompute` before the demo. Each step caches
its downloads in `data/raw/`, so later runs work without network.

| Script | Lane | Task | Output |
|---|---|---|---|
| `fetch-horizons.ts` | A | A1–A2 | Sun/Earth az/el per site over the mission window (UTC) |
| `build-terrain.ts` | B | B1–B4 | Horizon profile, slope/flat-patch indicators, hazard flags |
| `build-sites.ts` | C | C4 | Joins the above + science → `data/precomputed/<site-id>.json` |

Output must match `src/lib/lunanav/types.ts`.
