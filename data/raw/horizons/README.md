# data/raw/horizons/

JPL Horizons outputs: Sun/Earth az, el, range per site and date range. File pattern: <site>_<start>_<end>.csv

Current dump (`uv run python -m data.horizons`): `<site>_<body>.csv` (body = sun | earth), columns time_utc, az_deg, el_deg, range_km, hourly 2026-01-01 → 2027-01-01, sites in `SITES` in [data/horizons.py](../../horizons.py). Elevation is against a smooth horizon (no terrain).

`track_<name>.csv` (name = earth | lro | danuri | chandrayaan2): Moon-fixed position of Earth and of each lunar orbiter. Columns are time_utc, lat_deg, lon_deg (selenographic, east) and range_km from the Moon's center, at 10-minute steps from 2025-11-28 to 2026-11-28. Produced by `data.horizons.track`. Visibility from any number of surface sites comes from these files, with no further API calls. Earth's track is the libration-driven sub-Earth point. Elevations derived this way agree with `observer_table` to within 0.02°.

**Owner:** Dev 2 · Board: [G1](../../../tasks/BOARD.md)

