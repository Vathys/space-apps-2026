# 03 · Visibility engine (P1, core of the challenge)

**Goal:** Know when the Sun and Earth are actually visible over the local terrain.
**Owner:** TBD

- [ ] **VS1** Horizon profile (4h). Depends on TR3
  - Ray-cast from the site over the DEM in 360 azimuth bins. Keep the max elevation angle and account for lunar curvature (R = 1737.4 km)
  - Out: `data/processed/<site>_horizon.json` (az, horizon_el)
- [ ] **VS2** Sun/Earth visibility vs horizon (3h). Depends on VS1, HZ2
  - A body is visible when its el > horizon_el(az). Treat the Sun as a disk (~0.27° radius) so partial sunlight is reported
- [ ] **VS3** Operational metrics over a date range (3h). Depends on VS2
  - % time sunlit, longest dark period, Earth-visibility windows, time to next sunset/Earthset
  - Out: JSON shaped for the API (see AP1)
- [ ] **VS4** Validate against a published LOLA illumination map for a known south-pole spot (2h). Depends on VS3
- [ ] **VS5** Date-shift re-evaluation: a single call reruns VS3 for a date shifted by N days (1h). Depends on VS3
  - This is the "launch slips two weeks" scenario
