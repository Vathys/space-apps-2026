# 04 · Landing suitability (P2)

**Goal:** A *preliminary* indicator of usable terrain inside a landing ellipse. Flag what we can't resolve. Never claim a site is "safe".
**Owner:** TBD

- [ ] **LS1** Lander-constraints input: max slope, ellipse radius, minimum flat-patch size, with sourced defaults (1h)
- [ ] **LS2** Flat-patch finder (4h). Depends on TR4, LS1
  - Within the ellipse, mask cells where slope < max and roughness < threshold, then find connected patches ≥ the minimum size
- [ ] **LS3** Suitability indicators (2h). Depends on LS2
  - % of the ellipse that is usable, largest patch, mean/95th-percentile slope. Every label says "preliminary"
- [ ] **LS4** Uncertainty & hazard flags (2h). Depends on LS3
  - DEM resolution vs lander footprint, boulders below image resolution, PSR / deep shadow in the ellipse
