# 01 · Horizons data (P1)

**Goal:** Sun and Earth azimuth/elevation/range from any lunar site, for any date range, cached locally.
**Owner:** TBD

- [ ] **HZ1** Query the Horizons API for a topocentric lunar observer (2h)
  - In: one site lat/lon. Use `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='lon,lat,alt'`, targets Sun `10` and Earth `399`, `QUANTITIES='4,20'` (az/el, range)
  - Out: a working sample request + response saved in notebooks/
- [ ] **HZ2** Fetch script: sites × date range → CSV (3h). Depends on HZ1, SC1
  - Out: `data/raw/horizons/<site>_<start>_<end>.csv` with columns time, body, az, el, range. Cache results so we don't re-query
- [ ] **HZ3** Validate ephemeris (2h). Depends on HZ2
  - Sanity checks: an Apollo near-side site has Earth high in the sky; a south-pole site has Earth near the horizon, moving with libration
- [ ] **HZ4** Precompute tables for all curated sites over the demo window (2h). Depends on HZ2, SC1
  - The web app serves these, so the demo doesn't depend on live Horizons calls
