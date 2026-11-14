# data/precomputed/

One `<site-id>.json` per site, written by `scripts/build-sites.ts` (task C4). Each contains:
- the Sun/Earth ephemeris over the mission window (UTC), with the Horizons query it came from
- the 360° terrain horizon profile, with the LOLA product it came from
- the preliminary suitability indicators and hazard flags
- the science card with references

Don't edit these by hand. Re-run `bun run precompute`.
