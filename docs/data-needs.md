# Data needs

Every item from the brainstorm, mapped to a source and to the priority it serves.

| Data item | Source | Serves | One-day build | Task |
|---|---|---|---|---|
| Geographic coordinates | Curated site list (NASA NSSDCA, USGS nomenclature) | 1–3 | ✅ | S2 |
| Height / elevation | LOLA DEM | 1 (horizon), 2 | ✅ | B1–B2 |
| Lighting | Horizons Sun az/el + LOLA horizon | 1 | ✅ | A2–A3 |
| Horizon positions / solar elevation | Horizons + LOLA horizon profile | 1 | ✅ | B2, A3 |
| Distance to Earth / Earth visibility | Horizons Earth az/el + range, LOLA horizon | 1 | ✅ | A2–A3 |
| Previous landing sites & samples | NASA NSSDCA, Apollo sample catalog | 3 | ✅ | C1 |
| Water & ice | LRO (LAMP, Diviner, LEND), PSR maps via NASA PDS | 3 | Text note only | C1, B4 |
| Lunar seasons (?) | Horizons over a full year | 1 context | Stretch | — |
| Temperature | LRO Diviner | — | Stretch | — |
| Gravity anomalies (?) | GRAIL | — | Stretch | — |
| Lunar seismic events | Apollo Passive Seismic Experiment catalog | — | Stretch | — |

Task IDs refer to [tasks/BOARD.md](../tasks/BOARD.md).

## Updated problem: ground-station placement for constant Earth comms (2026-11-14)

A surface station at site *s* is connected at time *t* if **either**
- **DTE:** Earth is above *s*'s terrain horizon, **or**
- **Relay:** some relay satellite is above *s*'s terrain horizon **and** that relay can see Earth (the Moon doesn't block it).

The Earth end is not the bottleneck. DSN's three complexes, about 120° apart in longitude, keep the Moon in view almost continuously. Rank sites by % of time connected and by longest outage over a year.

| Data item | Source | Status |
|---|---|---|
| Earth position in the Moon-fixed frame, including libration | Horizons `track("earth")` | ✅ `raw/horizons/track_earth.csv` |
| Relay positions in the Moon-fixed frame | Horizons `track(id)` for orbiters it carries | ✅ LRO, Danuri, Chandrayaan-2 (as proxies: none sells relay service) |
| Queqiao-2, the only operating dedicated relay | No public ephemeris. Orbital elements from independent tracking | ⚠️ [data/relays.csv](../data/relays.csv); argp/RAAN unknown, so we sample them |
| Terrain horizon mask, south pole | LOLA `LDEM_75S_120M` (covers 75°S to the pole) | ✅ `raw/lola/` |
| Terrain horizon mask, whole Moon / far side | LOLA `LDEM_16` (~1.9 km) | ✅ `raw/lola/`; upgrade to `LDEM_64` if needed |
| Fine local terrain at shortlisted sites | PGDA 5 m DEMs | ✅ Site01, Site04; others via `data.pgda.download` |
| Ready-made DTE % map (sanity check) | Trek `AVGVISIB_*_EARTH_SP` | ✅ `raw/trek/sp/` (8-bit display rendering) |
| Future relays (Lunar Pathfinder, IM NSN, Moonlight) | Planned 2027+ | Scenario-only rows in `relays.csv` |
| Link budget (antenna gain, band, data rate) | Mission papers | Partial (Queqiao-2 only), stretch goal |

**Connector verdict:** the connectors are enough for DTE and terrain, and `horizons.track` now handles orbiters. The real gap is Queqiao-2: there is nothing to connect to, so it has to be propagated from `relays.csv` (two-body Kepler; the orbit is a frozen orbit, so this holds up for coverage statistics).
