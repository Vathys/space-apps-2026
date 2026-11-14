# data/raw/horizons/

JPL Horizons outputs. Files written by the current code: `<site>_series_<start>_<end>_10m.csv`, `earth_moon_fixed_<start>_<end>_10m.csv`, `<site>_<body>.csv` (notebooks only) and `track_<orbiter>.csv`.

Every CSV except the notebook-only `<site>_<body>.csv` writes `time_utc` as ISO 8601 UTC with `Z` (e.g. `2027-01-01T00:00:00Z`); those keep naive UTC (`2026-01-01 00:00:00`) for the notebooks.

`uv run python -m data.horizons` writes `earth_moon_fixed_<window>.csv`, the orbiter tracks and the site tables below. It no longer writes `track_earth.csv` (2025–2026, outside the supported window); a copy left from an earlier run is stale.

`<site>_<body>.csv` (body = sun | earth): columns time_utc, az_deg, el_deg, range_km, hourly 2026-01-01 → 2027-01-01, sites in `SITES`. Input for notebooks/01 and 03 only (exploration and cross-checks). Outside the supported window, so not app data.

`track_<name>.csv` (name = lro | danuri | chandrayaan2): Moon-fixed position of each lunar orbiter. Columns are time_utc, lat_deg, lon_deg (selenographic, east) and range_km from the Moon's center, at 10-minute steps from 2025-11-28 to 2026-11-28 (past year on purpose: their predicts end soon). Reference only, not app data. Produced by `data.horizons.track`.

`<site>_series_2027-01-01_2027-04-01_10m.csv` (`uv run python -m data.sites`, P0 site by default): Sun and Earth az/el/range over the supported window, 12,961 samples, UTC, smooth horizon. Produced by `data.sites.site_series`. The contract's single `sun.angularRadiusDeg` comes from `data.sites.sun_angular_radius_deg` (mean Sun range: 0.26952° at the P0 site; per-sample 0.26667°–0.27171°).

`earth_moon_fixed_2027-01-01_2027-04-01_10m.csv`: Earth's center over the supported window (`WINDOW`), 12,961 samples. Columns time_utc, lat_deg, lon_deg, range_km plus `x_km`, `y_km`, `z_km` (Moon-fixed IAU frame, from the Moon's center; x toward 0°E, z north). Produced by `data.horizons.earth_moon_fixed`, for the relay-to-Earth occultation test. Positions are apparent (light-time and aberration corrected), not geometric: see the `# shortcut:` in `track()`. Check (2026-11-14): Earth az/el at `site01_connecting_ridge` computed from these vectors matches `observer_table` to 0.006° az and 0.0006° el at every sample.

**Owner:** Dev 2 · Board: [G1](../../../tasks/BOARD.md)

