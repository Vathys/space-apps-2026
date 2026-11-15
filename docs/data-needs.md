# Data needs

What the communication-network planner needs, in priority order. Scope: [decisions.md](decisions.md) D-10.
Task IDs refer to [tasks/BOARD.md](../tasks/BOARD.md). Shapes: [data-contracts.md](data-contracts.md).

## Connectivity rule (D-17)

A surface station at site *s* is **connected** at time *t* if **either**
- **DTE:** Earth is above *s*'s terrain horizon (+ mask), **or**
- **Relay:** some relay satellite is above *s*'s terrain horizon (+ mask) **and** that relay can see Earth (the Moon doesn't block it).

The Earth end isn't the bottleneck: DSN's three complexes, about 120° apart in longitude, keep the
Moon in view almost continuously. Geometric line-of-sight only. Link budgets are out of scope.

## P0: needed on Day 1

| Data item | Source | Owner / task | Status |
|---|---|---|---|
| Sun az/el at the site, over the supported window | Horizons observer table via `data/sites.py` | Dev 2 · G1 | ✅ for the *proposed* window and P0 site (decisions.md rows still TBD; rerun if they change): `raw/horizons/site01_connecting_ridge_series_2027-01-01_2027-04-01_10m.csv` (12,961 samples, UTC); Sun angular radius from `sites.sun_angular_radius_deg` (0.26952°) |
| Earth az/el/range at the site, over the window | Horizons observer table via `data/sites.py` | Dev 2 · G1 | ✅ Same file; Earth elevation −7.53° to +6.20°. **At the old DEM-center coordinate: rerun at the new P0 site** (−7.50° to +6.23° there, D-20 check) |
| Earth direction, Moon-fixed (for relay–Earth occultation) | Horizons `track("earth")` → `earth_moon_fixed()` | Dev 2 · G1 | ✅ `raw/horizons/earth_moon_fixed_2027-01-01_2027-04-01_10m.csv` (x/y/z km, 12,961 samples); matches `observer_table` to 0.006° |
| Terrain horizon, near field (≤ ~10 km) | PGDA 5 m DEM (`data/pgda.py`) | Dev 2 · G2 | ✅ Site01, Site04 |
| Terrain horizon, far field (to ≥ 150 km) | LOLA `LDEM_75S_120M` (`data/lola.py`) | Dev 2 · G2 | ✅ `raw/lola/` |
| Terrain horizon profile, 720 azimuths | `data/terrain.py` (both DEMs above, ray-cast to 300 km) | Dev 2 · G2 | ✅ `raw/terrain/<site>_horizon.json`; checked in [notebooks/06](../notebooks/06_terrain_horizon.ipynb). **At the old DEM-center coordinate: rerun at the new P0 site** |
| P0 site coordinates | Best Earth-clearance spot in the Site01 tile, (−89.4869, 223.6980 E) (decisions.md H0 table, notebook 04) | all · S2 | Proposed; in `SITES` in `data/horizons.py` and in `public/data/` since #54 (G1 and G2 rerun there) |
| P0 relay orbital elements | NASA LCRNS reference constellation v3.1, Tables 1–2 (D-19) | Dev 1 · N1 | ✅ [data/relay_orbits.csv](../data/relay_orbits.csv): 5 satellites, elements + ICRF states at 2027-03-01, joined to `relays.csv` by `relay`. Accords-only (D-18) |
| Moon GM, radius, rotation | 4902.8 km³/s², 1737.4 km, IAU 2015 lunar rotation model (Archinal et al. 2018; cite in `relays.py`) | Dev 1 · N1 | To cite |

## P1: Day 1 only if P0 is done

| Data item | Source | Task |
|---|---|---|
| Second south-pole site | PGDA Site04 Shackleton rim at (−89.7849, 204.0405 E): the flattest of PGDA's Site04 ROI points (`pgda.roi_points`; 1,737 m, 2.2° slope; the highest ground within 1 km is 1,739 m). The old DEM-center coordinate sat on Shackleton's inner wall (762 m, 33° slope; terrain horizon up to 34°). The tile's highest pixel, 1,805 m, is 8.2 km away, off the rim | G5 (#55) |
| More relay configurations | Reference orbits (2-satellite frozen elliptical, low polar circular) | N5 |
| DTE % sanity map | Moon Trek `AVGVISIB_*_EARTH_SP` (`data/trek.py`, 8-bit rendering) | V2 |
| Propagator check | Real LRO/Danuri/Chandrayaan-2 tracks from Horizons `track(id)` (`raw/horizons/track_*.csv`), over their available dates | V1/V2 |

## Future scope (excluded under D-10)

| Data item | Source | Why excluded |
|---|---|---|
| Landing flatness, slope, touchdown hazards | LOLA/LROC | Landing safety is P2 |
| Geology, mineralogy, sample value | USGS Unified Geologic Map, NASA mission data | Science ranking is P2 |
| Water & ice / PSR | LRO LAMP, Diviner, LEND | Science ranking is P2 |
| Previous landing sites & samples | NASA NSSDCA | Science ranking is P2 |
| Radio link budget (gain, band, data rate) | Mission papers (Queqiao-2 partial in relays.csv) | Link budgets are P2 |
| Inter-satellite links, future constellations (Moonlight, Pathfinder, LNSS) | relays.csv scenario rows | P2 |
| Temperature, gravity anomalies, seismic events, seasons | Diviner, GRAIL, Apollo PSE | From the brainstorm; P2 |
