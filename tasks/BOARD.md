# Task board

Ordered by when work can start. **CP** marks the critical path to a live demo:
SC1 → TR1→TR2→TR3 → VS1 → VS2 → VS3 → AP2 → UI4 → DP1 → PT2 → PT4.
UI0 → UI8 → AP1 runs in parallel and must be done before UI2/UI3.

| ID | Workstream | Task | Pri | Est h | Depends on | CP | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| SC1 | 05 Science | Curated site list → data/raw/sites/sites.csv | P1 | 3 | — | ✔ | TBD | todo |
| UI0 | 06 Web app | Choose web stack (frontend, backend, hosting) | P1 | 1 | — | ✔ | TBD | todo |
| HZ1 | 01 Horizons | Horizons API query for a lunar topocentric observer | P1 | 2 | — | | TBD | todo |
| TR1 | 02 Terrain | Choose DEM products (polar + global) | P1 | 2 | — | ✔ | TBD | todo |
| LS1 | 04 Suitability | Lander constraints + sourced defaults | P2 | 1 | — | | TBD | todo |
| PT3 | 07 Pitch | Limitations & data-sources page | — | 1 | — | | TBD | todo |
| UI8 | 06 Web app | Scaffold web app + API skeleton | P1 | 2 | UI0 | ✔ | TBD | todo |
| HZ2 | 01 Horizons | Fetch script sites × dates → CSV (cached) | P1 | 3 | HZ1, SC1 | ✔ | TBD | todo |
| TR2 | 02 Terrain | Download/crop DEM tiles around sites | P1 | 3 | TR1, SC1 | ✔ | TBD | todo |
| TR5 | 02 Terrain | LROC context image per site | P2 | 2 | SC1 | | TBD | todo |
| SC2 | 05 Science | Geology per site (USGS unified map) | P3 | 3 | SC1 | | TBD | todo |
| SC3 | 05 Science | Water/ice & PSR proximity | P3 | 2 | SC1 | | TBD | todo |
| SC4 | 05 Science | Mission history & samples | P3 | 2 | SC1 | | TBD | todo |
| PT1 | 07 Pitch | Demo scenario (Site A vs B, 2-week slip) | — | 2 | SC1 | | TBD | todo |
| AP1 | 06 Web app | API endpoints serving precomputed JSON | P1 | 3 | UI8, SC1 | ✔ | TBD | todo |
| UI1 | 06 Web app | Site & date picker | P1 | 3 | UI8, AP1 | | TBD | todo |
| HZ3 | 01 Horizons | Validate ephemeris | P1 | 2 | HZ2 | | TBD | todo |
| HZ4 | 01 Horizons | Precompute tables for demo window | P1 | 2 | HZ2, SC1 | | TBD | todo |
| TR3 | 02 Terrain | DEM loader (lat/lon ↔ pixel, elevation) | P1 | 3 | TR2 | ✔ | TBD | todo |
| TR4 | 02 Terrain | Slope & roughness rasters | P2 | 3 | TR3 | | TBD | todo |
| VS1 | 03 Visibility | Horizon profile (360°, curvature) | P1 | 4 | TR3 | ✔ | TBD | todo |
| VS2 | 03 Visibility | Sun/Earth visible vs horizon (Sun as disk) | P1 | 3 | VS1, HZ2 | ✔ | TBD | todo |
| UI2 | 06 Web app | Sky/horizon chart with Sun & Earth tracks | P1 | 4 | VS2, AP1 | | TBD | todo |
| VS3 | 03 Visibility | Metrics: % sunlit, dark periods, comm windows, time to set | P1 | 3 | VS2 | ✔ | TBD | todo |
| VS4 | 03 Visibility | Validate vs published illumination map | P1 | 2 | VS3 | | TBD | todo |
| VS5 | 03 Visibility | Date-shift re-evaluation | P1 | 1 | VS3 | | TBD | todo |
| UI3 | 06 Web app | Timeline of sunlight & comm windows | P1 | 3 | VS3, AP1 | | TBD | todo |
| LS2 | 04 Suitability | Flat-patch finder in landing ellipse | P2 | 4 | TR4, LS1 | | TBD | todo |
| LS3 | 04 Suitability | Preliminary suitability indicators | P2 | 2 | LS2 | | TBD | todo |
| LS4 | 04 Suitability | Uncertainty & hazard flags | P2 | 2 | LS3 | | TBD | todo |
| SC5 | 05 Science | Science summary card per site | P3 | 2 | SC2, SC3, SC4 | | TBD | todo |
| AP2 | 06 Web app | Compare logic (two scenarios + date shift) | P3 | 2 | VS3, LS3, SC5 | ✔ | TBD | todo |
| UI4 | 06 Web app | Side-by-side compare page | P3 | 4 | AP2, UI2, UI3 | ✔ | TBD | todo |
| UI7 | 06 Web app | Responsive layout + loading/error states | — | 2 | UI4 | | TBD | todo |
| DP1 | 06 Web app | Deploy to public URL + test | — | 2 | UI4 | ✔ | TBD | todo |
| PT2 | 07 Pitch | Slides / video | — | 3 | DP1 | ✔ | TBD | todo |
| PT4 | 07 Pitch | Submit on Space Apps portal | — | 1 | PT2 | ✔ | TBD | todo |
| UI5 | 06 Web app | Planner vs public mode | Stretch | 2 | UI4 | | TBD | todo |
| UI6 | 06 Web app | Map view with slope overlay + LROC | Stretch | 3 | TR4, TR5 | | TBD | todo |
| X1 | 07 Stretch | Temperature (Diviner) | Stretch | 3 | SC1 | | TBD | todo |
| X2 | 07 Stretch | Gravity anomalies (GRAIL) | Stretch | 2 | SC1 | | TBD | todo |
| X3 | 07 Stretch | Seismic events (Apollo PSE) | Stretch | 2 | SC1 | | TBD | todo |
| X4 | 07 Stretch | Seasons view across a year | Stretch | 2 | VS3 | | TBD | todo |

**Fallback if AP2/UI4 slips:** deploy UI2 + UI3 for two sites shown next to each other. That still covers the core challenge (P1).
**Deploy early:** push the UI8 skeleton to the host on day 1 so DP1 isn't a last-minute surprise.
