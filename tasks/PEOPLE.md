# Who does what

Per-person subtask lists. Task IDs (S4, F1, G1, N1…) and hours match [BOARD.md](BOARD.md); hours are
relative to Day-1 kickoff (H0). Refer to a subtask by name + number, e.g. "Amisha #17".
Shapes: [docs/data-contracts.md](../docs/data-contracts.md). Each board task is one `/contribute` branch + PR.

> **Tick boxes in the GitHub issues, not here.** Checkboxes in this file can't be clicked on
> GitHub. The issues below hold the same lists as clickable checklists and show progress.

| Person | Role | Board name | Checklist | Owns |
|---|---|---|---|---|
| **Amisha** | UI & Vercel | Dev 3 | [#4](https://github.com/Vathys/space-apps-2026/issues/4) | `src/app/`, `src/components/`, `src/lib/lunanav/data.ts`, the Vercel project |
| **Deep** | NASA data & Moon geometry | Dev 2 | [#5](https://github.com/Vathys/space-apps-2026/issues/5) | `data/horizons.py`, `lola.py`, `pgda.py`, `terrain.py`, `sites.py`, `geometry.py`, `src/lib/lunanav/visibility.ts` |
| **Shaheen** | Relay satellites & network math | Dev 1 | [#6](https://github.com/Vathys/space-apps-2026/issues/6) | `data/relays.py`, `data/precompute.py`, `src/lib/lunanav/network.ts`, `src/lib/lunanav/types.ts` |

---

## Amisha: UI & Vercel

**S4 · Setup & deploy (H0–H1)**
- [ ] 1. Create the Next.js app with bun, TypeScript, App Router and Tailwind
- [ ] 2. Add shadcn/ui components: button, select, card, slider, tabs, tooltip
- [ ] 3. Set `output: "export"` in `next.config.ts`
- [ ] 4. Create the Vercel project from the GitHub repo (preset Next.js, `bun install`, `bun run build`)
- [ ] 5. Check the production URL loads and a PR gets a preview URL
- [ ] 6. Add the live link to the README

**F1 · Layout (H1–H3)**
- [ ] 7. Control bar
- [ ] 8. Metric cards: coverage %, longest blackout, blackout count, sunlit %
- [ ] 9. Timelines area
- [ ] 10. Comparison area
- [ ] 11. Placeholder JSON files in `public/data/placeholder/`, each marked `"placeholder": true`
- [ ] 12. PLACEHOLDER DATA banner

**F2 · Data loader (H1–H3)**
- [ ] 13. Fetch `index.json`, the site files and the relay files
- [ ] 14. Check each against the shared types
- [ ] 15. Show a visible error when a file is missing

**F3 · Controls (H3–H5)**
- [ ] 16. Site selector
- [ ] 17. Start date + duration (1–30 days), limited to the supported window
- [ ] 18. "Outside supported data window" message (no numbers)
- [ ] 19. Relay selector, including "Direct only"
- [ ] 20. Elevation mask slider, 0–10°, default 0°, placed with the DTE results and labeled as affecting DTE most (D-20)
- [ ] 21. Save choices in the URL (`?site=…&start=…&days=…&relay=…`)

**F4 · Timelines & metrics (H3–H5)**
- [ ] 22. Timeline rows: Earth direct, Relay, Connected, Sunlight
- [ ] 23. Metric cards with a source line and the "geometric line-of-sight" caveat
- [ ] 24. A table with the same numbers under each chart

**I1 · First end-to-end (H5–H7), CP3**
- [ ] 25. Switch from placeholder to real data
- [ ] 26. Wire controls → `visibility.ts` → `network.ts` → UI
- [ ] 27. Check it on the production URL

**F5 / F6 · Comparison & network view (H7–H9)**
- [ ] 28. Direct vs relay, side by side
- [ ] 29. Scenario A vs B (different site or date)
- [ ] 30. Network diagram: lander → relay → Earth, links green or red

**I3 · Cleanup (by H9), CP4**
- [ ] 31. Delete placeholder files and the banner

**V4 / Z1 / Z2 · Check & freeze (H9–H12)**
- [ ] 32. Test in a fresh browser, on a phone, out of window, and with each relay
- [ ] 33. Merge README edits
- [ ] 34. Record the fallback demo video

---

## Deep: NASA data & Moon geometry

**G1 · Sun & Earth (H1–H3)**
- [ ] 1. Run Horizons for the P0 site over the agreed window, every 10 min
- [ ] 2. Sun az/el series
- [ ] 3. Earth az/el/range series
- [ ] 4. Cache responses in `data/raw/` and convert times to UTC
- [ ] 5. Moon-fixed Earth direction (Shaheen needs it)
- [ ] 6. Check: 12,961 samples, Earth elevation within about ±8°

**G2 · Terrain horizon (H1–H3)**
- [ ] 7. Load the PGDA 5 m DEM for the near field
- [ ] 8. Load LOLA `LDEM_75S_120M` out to ≥ 150 km for the far field
- [ ] 9. Ray-cast 720 azimuths at 0.5° steps
- [ ] 10. Add lunar curvature
- [ ] 11. Plot in a notebook and check distant ridges show up (e.g. toward Malapert)
- [ ] 12. Record source and resolution

**G3 · Geometry functions (H3–H5)**
- [ ] 13. `topocentric()`: satellite position → az/el/range from the site
- [ ] 14. `sees_earth()`: does the Moon (R = 1737.4 km) block the relay's view of Earth
- [ ] 15. Check it against Horizons to within 0.01°
- [ ] 16. Hand both functions to Shaheen

**G4 · Browser visibility (H3–H5)**
- [ ] 17. Horizon interpolation with azimuth wrap at 360°
- [ ] 18. "Above terrain + mask" test
- [ ] 19. Sunlit fraction, treating the Sun as a disk
- [ ] 20. Hand checks: a 7° ridge blocks Earth at 3°; a half-hidden Sun gives ~0.5

**G5 · Second site, P1 (H7–H9)**
- [ ] 21. Rerun G1 and G2 for Shackleton Rim (PGDA Site04)

**V2 · Science check (H9–H11)**
- [ ] 22. DTE % vs Moon Trek's average Earth-visibility map
- [ ] 23. Earth elevation range vs libration
- [ ] 24. Horizon vs known terrain
- [ ] 25. Write up any differences in `docs/decisions.md`

---

## Shaheen: Relay satellites & network math

**S3 · Shared types (H0–H1). First, because the others depend on it**
- [ ] 1. Copy the data contract into `types.ts`
- [ ] 2. Merge it
- [ ] 3. Walk Amisha and Deep through it

**N1 · Relay orbit (H1–H3)**
- [ ] 4. Read the LCRNS SV-1…5 elements from `data/relay_orbits.csv` (D-19)
- [ ] 5. Two-body Kepler propagation
- [ ] 6. Convert to Moon-fixed coordinates with the IAU 2015 rotation model (elements are in the Moon frame frozen at J2000)
- [ ] 7. Mark every simplification with `# shortcut:`
- [ ] 8. Check: 12,961 positions, distance staying between perilune and apolune

**N2 · Path logic (H1–H3)**
- [ ] 9. `connected = DTE OR (lander sees relay AND relay sees Earth)`
- [ ] 10. Check it on small hand-made arrays

**N3 · Metrics (H3–H5)**
- [ ] 11. Coverage %, DTE-only %, and the relay's gain over DTE
- [ ] 12. Blackout intervals, longest blackout, blackout count
- [ ] 13. Slice by start date and duration
- [ ] 14. Outside-window error
- [ ] 15. Handle blackouts at the start or end of the slice
- [ ] 16. Hand-check a 1-day slice

**N4 · Data files (H3–H5), CP2**
- [ ] 17. Write `public/data/index.json`
- [ ] 18. Write `sites/<id>.json` from Deep's data
- [ ] 19. Write `relays/<site>/<config>.json` using Deep's geometry functions
- [ ] 20. Check shapes and sizes (under 2 MB each)
- [ ] 21. Merge to `main`

**N5 · More relays, P1 (H7–H9)**
- [ ] 22. Two satellites in the same orbit, 180° apart
- [ ] 23. Low polar orbit at 100 km

**V1 / V3 · Validation (H9–H11)**
- [ ] 24. Hand-count a 2-day slice and compare with `network.ts`
- [ ] 25. Check every data file has a source and an uncertainty

---

## Handoffs

| When | From → to | What |
|---|---|---|
| H1 | Shaheen → everyone | `types.ts` merged (Shaheen #2) |
| H3 | Deep → Shaheen | Sun/Earth series + Moon-fixed Earth direction (Deep #1–5) |
| H5 | Deep → Shaheen | `geometry.py` functions (Deep #16) |
| H5 | Deep → Amisha | `visibility.ts` (Deep #17–20) |
| H5 | Shaheen → Amisha | real `public/data/` files + `network.ts` (Shaheen #21) |
| H7 | everyone | first end-to-end on Vercel (Amisha #27) |

## Everyone

- [ ] H0–H1: agree decisions D-10 to D-17 and fill the H0 table in [decisions.md](../docs/decisions.md)
- [ ] H0–H1: each person opens a branch + draft PR
- [ ] H7: first end-to-end check on Vercel
- [ ] H11–H12: confirm the Day-1 exit condition on production
- [ ] Day 2: touch-ups only (checklist in [BOARD.md](BOARD.md))
