# 02 · LOLA / LROC terrain (P1–P2)

**Goal:** Elevation around each site (for horizons and slopes) plus context imagery.
**Owner:** TBD

- [ ] **TR1** Choose DEM products (2h)
  - Polar: LOLA high-res south-pole LDEMs from PGDA (e.g. 5–20 m/px). Non-polar: global LOLA LDEM. Record resolution, projection and citation in data/raw/lola/README.md
  - The horizon needs coverage out to roughly 100+ km. Slopes need the finest resolution available
- [ ] **TR2** Download and crop tiles around the curated sites (3h). Depends on TR1, SC1
- [ ] **TR3** DEM loader: read raster, lat/lon ↔ pixel, elevation lookup (3h). Depends on TR2
- [ ] **TR4** Derive slope and roughness rasters (3h). Depends on TR3
  - Out: `data/processed/<site>_slope.tif`, `<site>_roughness.tif`, plus a downsampled PNG/tiles the web map can show
- [ ] **TR5** LROC context images per site (WAC/NAC via Quickmap export) (2h). Depends on SC1
  - Out: `data/raw/lroc/<site>.png` plus a source URL for each
