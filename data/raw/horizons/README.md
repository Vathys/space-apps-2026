# data/raw/horizons/

JPL Horizons outputs: Sun/Earth az, el, range per site and date range. File pattern: <site>_<start>_<end>.csv

Current dump (`uv run python -m data.horizons`): `<site>_<body>.csv` (body = sun | earth), columns time_utc, az_deg, el_deg, range_km, hourly 2026-01-01 → 2027-01-01, sites in `SITES` in [data/horizons.py](../../horizons.py). Elevation is against a smooth horizon (no terrain).

**Owner:** Lane A · Board: [A1–A2](../../../tasks/BOARD.md)

