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
| Sun az/el at the site, over the supported window | Horizons observer table via `data/sites.py` | Dev 2 · G1 | ✅ P0 site: `raw/horizons/site01_connecting_ridge_series_2027-01-01_2027-04-01_10m.csv` (12,961 samples, UTC); Sun angular radius from `sites.sun_angular_radius_deg` (0.26952°) |
| Earth az/el/range at the site, over the window | Horizons observer table via `data/sites.py` | Dev 2 · G1 | ✅ Same file; Earth elevation −7.53° to +6.20° |
| Earth direction, Moon-fixed (for relay–Earth occultation) | Horizons `track("earth")` → `earth_moon_fixed()` | Dev 2 · G1 | ✅ `raw/horizons/earth_moon_fixed_2027-01-01_2027-04-01_10m.csv` (x/y/z km, 12,961 samples); matches `observer_table` to 0.006° |
| Terrain horizon, near field (≤ ~10 km) | PGDA 5 m DEM (`data/pgda.py`) | Dev 2 · G2 | ✅ Site01, Site04 |
| Terrain horizon, far field (to ≥ 150 km) | LOLA `LDEM_75S_120M` (`data/lola.py`) | Dev 2 · G2 | ✅ `raw/lola/` |
| P0 site coordinates | PGDA DEM center (`SITES` in `data/horizons.py`) | all · S2 | ✅ |
| P0 relay orbital elements | `data/relays.csv` (Queqiao-2, independently tracked elements) | Dev 1 · N1 | ✅ [data/relays.csv](../data/relays.csv); argp/RAAN assumed (D-16). No public ephemeris, so it is propagated two-body from these elements (frozen orbit, fine for coverage statistics) |
| Moon GM, radius, sidereal rotation | 4902.8 km³/s², 1737.4 km, 27.3217 d (standard constants; cite in `relays.py`) | Dev 1 · N1 | To cite |

## P1: Day 1 only if P0 is done

| Data item | Source | Task |
|---|---|---|
| Second south-pole site | PGDA Site04 Shackleton rim | G5 |
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
