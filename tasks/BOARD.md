# Task board: Day 1 builds everything, Day 2 is touch-ups

Scope, architecture and contracts: [CLAUDE.md](../CLAUDE.md), [docs/architecture.md](../docs/architecture.md),
[docs/data-contracts.md](../docs/data-contracts.md). Hours are relative to Day-1 kickoff (H0).
Each row is one `/contribute` branch + PR unless it says otherwise. P0 rows come before any P1 row in review and merge order; a P1 row may start earlier on placeholder data (D-23).

**Day-1 exit condition:** anyone can open the deployed Netlify URL, pick a supported south-pole
site and date, and compare direct-to-Earth vs relay-assisted communication using computed results.

## Owners

Per-person checklists: [PEOPLE.md](PEOPLE.md).

| Role | Owns | Name |
|---|---|---|
| **Dev 1: Satellite simulation & networking** | `data/relays.py`, `data/precompute.py`, `lib/lunanav/network.ts`, `lib/lunanav/types.ts` | Shaheen |
| **Dev 2: NASA data & lunar geometry** | `data/horizons.py`, `lola.py`, `pgda.py`, `terrain.py`, `sites.py`, `geometry.py`, `lib/lunanav/visibility.ts` | Deep |
| **Dev 3: Frontend & Netlify** | `src/app/`, `src/components/`, `lib/lunanav/data.ts`, Netlify project | Amisha |

## Checkpoints (all three stop and integrate)

| CP | When | Pass condition |
|---|---|---|
| **CP1** | H1 | "To decide at H0" table in decisions.md filled in; D-10 to D-20 agreed; `types.ts` merged; empty app live on Netlify production |
| **CP2** | H5 | Real `sites/<P0 site>.json` and `relays/<P0 site>/<P0 config>.json` merged to `main` under `public/data/` |
| **CP3** | H7 | **First end-to-end on the Netlify URL:** one site, one window, one relay, computed DTE + relay timelines and metrics |
| **CP4** | H9 | MVP complete: placeholders gone, direct-vs-relay comparison and scenario switch work |
| **CP5** | H11 | Validation done, no critical integration dependency open |
| **FREEZE** | H12 | Day-1 feature freeze: deployed, README + method written, fallback video recorded |

---

## DAY 1

### H0–H1 · Architecture & setup (everyone)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| S1 | Assign names to Dev 1/2/3; agree the MVP (P0 list in CLAUDE.md §2) | all | Names in this board and CLAUDE.md §4 | todo |
| S2 | Agree D-10 to D-20, then fill the "To decide at H0" table in docs/decisions.md: P0 site, supported window + step, min elevation mask, P0 relay config, deadline | all | No "TBD" left in those rows | todo |
| S3 | Copy docs/data-contracts.md into `src/lib/lunanav/types.ts` | Dev 1 | Merged; the other two have read it | todo |
| S4 | Next.js + bun + Tailwind + shadcn scaffold, `output: "export"`, Netlify project linked to `main`, preview deploys on PRs | Dev 3 | Production URL loads; a PR shows a preview URL | done: https://lunanav.netlify.app, previews on PRs (#32, #48) |
| S5 | Each dev opens their first feature branch + draft PR | all | 3 draft PRs visible | todo |

### H1–H3 · Parallel development

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| N1 | `data/relays.py`: two-body Kepler propagation in a Moon-centred inertial frame → Moon-fixed positions (IAU rotation, D-19) for the P0 config `lcrns-ref-5sat` (`data/relay_orbits.csv`) over the window | Dev 1 | Positions for 5 × 12,961 samples; radius stays between each satellite's perilune and apolune; at the 2027-03-01 epoch, the ICRF position matches the published state in `relay_orbits.csv` to ≲ 10 km | todo |
| N2 | `network.ts` core: `connected = dte OR any(landerSeesSat AND satSeesEarth)` on `Uint8Array`s | Dev 1 | Small hand-made arrays give the expected connected series | todo |
| G1 | `data/sites.py`: Sun + Earth az/el (+ Earth range) at the P0 site over the window, from Horizons, cached | Dev 2 | Series with 12,961 samples, UTC; Earth elevation stays within about ±8° at the pole | in review (PR #8); final once the window and P0 site rows in decisions.md are agreed |
| G2 | `data/terrain.py`: 360° terrain horizon (0.5° step) from PGDA 5 m near field + LOLA `LDEM_75S_120M` far field, with lunar curvature | Dev 2 | Profile plotted in a notebook; distant ridges (e.g. Malapert direction) visible | todo |
| F1 | App layout on placeholder JSON (`public/data/placeholder/`, banner shown) | Dev 3 | Page shows site picker, date controls, empty timelines | todo |
| F2 | `lib/lunanav/data.ts`: fetch `index.json`, site and relay files; narrow to `types.ts` | Dev 3 | Loads placeholder files with no type errors | todo |

### H3–H5 · Functional modules

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| N3 | Blackout intervals, longest blackout, coverage %, DTE %, relay gain; window slicing by start + duration; `outside-window` error | Dev 1 | Hand-checked on a 1-day slice | todo |
| N4 | `data/precompute.py`: writes `index.json`, `sites/<id>.json`, `relays/<site>/<config>.json`; checks shapes and sizes before writing; `index.json → window` comes from `data.horizons.WINDOW` / `WINDOW_STEP`, so the series and the app declare the same dates | Dev 1 | Files written, each < 2 MB; `index.json` window equals `WINDOW`; merged = **CP2** | todo |
| G3 | `data/geometry.py`: Moon-fixed → topocentric az/el/range; relay–Earth occultation (`sees_earth`) | Dev 2 | Earth az/el from the Moon-fixed track matches `observer_table` to < 0.01° | todo |
| G4 | `visibility.ts`: horizon interpolation (azimuth wrap at 360°), above-terrain test with min mask, Sun-disk sunlit fraction | Dev 2 | A 7° ridge blocks Earth at 3°; a half-hidden Sun gives ~0.5 | todo |
| F3 | Controls: site selector, start date + duration (clamped to the window, limitation message outside it), relay config selector (incl. "direct only"), elevation-mask slider placed with the DTE results (D-20) | Dev 3 | Changing controls updates the URL search params; raising the mask from 0° to 5° lowers DTE coverage | todo |
| F4 | Timelines: DTE, relay, connected, sunlight rows; metric cards (coverage, longest blackout, blackout count); table alternative | Dev 3 | Renders from a `ConnectivityResult` | todo |

### H5–H7 · First end-to-end integration (P0)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| I1 | Wire real `public/data/` → `visibility.ts` → `network.ts` → UI for the P0 site + P0 relay config | all (Dev 3 drives) | **CP3** on the Netlify production URL | todo |
| I2 | Provenance + "geometric line-of-sight only" caveat shown next to every metric | Dev 3 | Every number has a source line | todo |

### H7–H9 · Complete the MVP

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| F5 | Direct vs relay comparison view, plus Scenario A vs B (site or date switch) side by side | Dev 3 | Two scenarios on screen with their metrics | todo |
| F6 | Network status view: which satellite is in view of the lander and of Earth at the selected time | Dev 3 | Updates when scrubbing the timeline | todo |
| F7 | *(P1, D-21)* 3D lander sky view (three.js): terrain horizon ring, Sun, Earth and relay satellites at their az/el, links green/red, starfield; follows the timeline scrubber. Includes the decorative first-look hero (D-21, #51). Built on placeholder data from H1; shown on production only once I1 works | Dev 3 | Sun/Earth/relay move when scrubbing; same numbers in a table beside it; `bun run build` still exports | todo |
| I3 | Delete `public/data/placeholder/` and the banner path | Dev 3 | No placeholder file on `main` = **CP4** | todo |
| N5 | *(P1)* More relay configs: `lcrns-ref-1sat` (LCRNS SV-1 only), `lunar-pathfinder` (D-19) | Dev 1 | Selectable in the UI | todo |
| G5 | *(P1)* Second south-pole site (e.g. Shackleton rim, PGDA Site04) | Dev 2 | Selectable in the UI | todo |

### P1 · Pick a point (D-24, D-25; may start in parallel under D-23)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| G6 | 9 more south-pole sites for offline browsing: coordinates and a one-line reason each in decisions.md; horizon (G2's method: PGDA 5 m where a tile exists, else LOLA 120 m only, stated in the horizon source) and Sun/Earth series (G1) for each | Dev 2 | 11 sites listed; each has a horizon and a series on the window grid | todo |
| N6 | `data/precompute.py` writes all 11 sites and their relay files | Dev 1 | All selectable in the UI; each file < 2 MB, `public/data/` < 30 MB (D-26) | todo |
| G7 | `data/point_server.py` (D-25): given lat/lon, runs the same pipeline functions as precompute and returns `SiteData` + `RelayLinkData`; input validated, CORS limited to the Netlify origins, results cached by point; exposed with `tailscale funnel` at a fixed `*.ts.net` address (tailnet name fixed before `NEXT_PUBLIC_POINT_SERVER_URL` is set in Netlify); README says how it runs and that it's optional | Dev 2 | site01's coordinates return the same numbers as `public/data/` site01 (to rounding); an out-of-range latitude returns 400 | todo |
| F8 | Pick a point: lat/lon input or click on a polar map; `data.ts` calls `NEXT_PUBLIC_POINT_SERVER_URL` with a timeout; live results labelled "computed live"; server down → "live point analysis is offline" and the 11 precomputed sites | Dev 3 | With the server down the app still works and shows the message; with it up, site01's coordinates give the site01 numbers | todo |

### P1 · Mission UI (Amisha, 2026-11-14; everything computed by `lib/lunanav/insights.ts` from the same files)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| F9 | Best window finder: coverage for every start date of the chosen duration, heat strip + table, "use best" | Dev 3 | Picking a day changes the scenario; best = highest coverage, then shortest longest blackout | done (local) |
| F10 | Mission events log (every link-state change, jump to it) + next-change countdown in the readout | Dev 3 | Direct-only blackouts in the log match `network.blackouts`; N / P jump | done (local) |
| F11 | Mask sensitivity curve (0–10°, with relay and direct only) + per-satellite complete-path hours + "Sun up and a path" hours | Dev 3 | 5° gives the same DTE % as the mask slider (12.5% at Connecting Ridge); every chart has a table | done (local) |
| F12 | Earth's and the Sun's paths over the scenario drawn on the lander's sky | Dev 3 | Dots are the site file's az/el | done (local) |
| F13 | Copy link, CSV export of the result, keyboard shortcuts (N/P, 1/2, Space) | Dev 3 | CSV has one row per sample | done (local) |
| F14 | Full-screen HUD layout: 3D fills the screen, edge panels (scenario, readout), timeline as the scrubber | Dev 3 | Nothing covers the middle of the 3D; works at 375 / 768 / 1024 / 1440 px | done (local) |
| F15 | Story mode (scroll chapters: site, touchdown, Earth sets, relay picks up, plan your own) + demo mode for the video (Z2) | Dev 3 | Every chapter number comes from the result; Skip goes to the planner; reduced motion shows the final state | done (local) |
| F16 | Site or date A vs B side by side (rest of F5) | Dev 3 | Two scenarios with their metrics and timelines | done (local) |
| F17 | 2D polar map of the sites (and the F8 pick-a-point click target) | Dev 3 | Clicking a site selects it | done (local) |
| F18 | PNG snapshot of the 3D, phone polish, light-mode check | Dev 3 | Checked at 375 px and in light mode | done (local) |

### H9–H11 · Integration & validation

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| V1 | Link + blackout logic check: hand-count a 2-day slice against `network.ts` output | Dev 1 | Counts match | todo |
| V2 | Science sanity check: DTE % vs Moon Trek `AVGVISIB_*_EARTH_SP` map; Earth elevation range vs libration; horizon vs known terrain | Dev 2 | Differences explained in docs/decisions.md | todo |
| V3 | Provenance audit: every file in `public/data/` has source + uncertainty; no hand-written results | Dev 1 + Dev 2 | Checked list in the PR | todo |
| V4 | Deployed URL test: fresh browser, phone, out-of-window date, each config | Dev 3 | Notes in the PR; criticals fixed | todo |

### H11–H12 · Day-1 feature freeze (everyone)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| Z1 | README: what it is, method, how to run, limitations, data sources | all (Dev 3 merges) | Merged | todo |
| Z2 | Record the fallback demo video from the production URL | Dev 3 | Video saved | todo |
| Z3 | Confirm the Day-1 exit condition on production; write any gap at the top of this board | all | Exit condition ✔ or the gap listed | todo |

**No feature development is scheduled after Z3.**

---

## DAY 2: touch-ups only

If the Day-1 exit condition failed, the morning goes **only** to meeting it. Otherwise:

- [ ] Scientific sanity re-check on production (fresh eyes: does each number make sense?)
- [ ] Minor bug fixes (each through `/contribute`, small PRs)
- [ ] UI polish and mobile/responsive fixes
- [ ] README improvements, method and limitations wording
- [ ] Presentation / pitch slides
- [ ] Final demo video
- [ ] Submission package: URL, repo, video, description
- [ ] **Final submission freeze: 3 h before the deadline**. After that, only submission work and a redeploy if production breaks
- [ ] Final deployment verification on production after the last merge

**Not on Day 2 without a recorded team decision:** new architecture, backend services, new
scientific modules, major refactors, new third-party infrastructure, complex features.

## Dependencies & critical path

Each person's own work runs in parallel. Dependencies sit only at handoffs. `types.ts` (S3) and
placeholder data (F1) let everyone build against the agreed shapes before real data exists.
Subtask numbers (e.g. Deep #5) refer to [PEOPLE.md](PEOPLE.md).

### Can start right after H0, nobody waits

| Person | Starts with | Needs from others |
|---|---|---|
| Amisha | S4 setup + Netlify deploy, F1 layout, F2 loader on placeholder data | Only `types.ts` (S3, ~1 h) |
| Deep | G1 Sun/Earth series, G2 terrain horizon | Nothing. Connectors are on `main` |
| Shaheen | S3 `types.ts`, N1 relay orbit, N2 path logic on hand-made arrays | Nothing |

### Real dependencies

| Task | Waits for | Why |
|---|---|---|
| Everyone's data shapes | S3 `types.ts` (Shaheen #1–2, H1) | All three read or write the same JSON |
| N1 Moon-fixed step + N4 relay files | G1 Moon-fixed Earth direction (Deep #5, H3) | Needed to test whether the Moon blocks the relay's view of Earth |
| N4 site files (Shaheen #18) | G1 + G2 (H3) | The site file *is* Deep's Sun/Earth series + horizon |
| N4 relay files (Shaheen #19) | G3 geometry functions (Deep #13–14, H5) | Turns relay positions into az/el seen from the site |
| I1 real data (Amisha #25–27) | N4 files + `network.ts` (Shaheen), `visibility.ts` (Deep), H5 | The UI shows computed results |
| F5/F6 comparison + network view | I1 working (CP3) | Needs real results to compare |
| F7 3D sky view + hero | None to start (D-23: built on placeholder data from H1); merged after the P0 frontend PRs; I1 (CP3) before it shows on production | Reads the same `SiteData` and `RelayLinkData` as F4, no new contract |
| G6 → N6 offline sites; G7 → F8 pick a point (P1, D-24/25) | G6: G1 + G2 pipelines. N6: N4. G7: G1–G3 + N1/N4 functions (it reuses them). F8: G7 + I1 (CP3) to ship | May start in parallel (D-23); the server reuses the precompute path, so no second implementation |
| G5, N5 (P1) | CP3 to ship | May start earlier on placeholder data (D-23); shipped only after P0 works end to end |
| V1–V4 validation | CP4 | Validates the finished MVP |

### Chain

```
H0    S3 types.ts (Shaheen) ─────────────┬─────────────────┐
                                         ▼                 ▼
H1–3  Deep: G1 Sun/Earth + G2 horizon    Shaheen: N1 orbit + N2 paths    Amisha: S4 deploy + F1/F2 (placeholder)
            │                                 │                                │
H3–5  Deep: G3 geometry + G4 visibility.ts ─► Shaheen: N3 metrics + N4 files ─► Amisha: F3 controls + F4 timelines
                                                  │                                │
H5–7                                              └──────► I1 FIRST END-TO-END ◄───┘   (CP3, all three)
H7–9  Amisha: F5/F6 comparison · Deep: G5 2nd site (P1) · Shaheen: N5 more relays (P1)
P1    pick a point (D-24/25): Deep G6 9 sites ─► Shaheen N6 files · Deep G7 point server ─► Amisha F8 picker
H9–12 V1–V4 validation → Z1–Z3 freeze
```

**Critical path:** S2 → G1 + G2 → G3 → N4 (CP2) → I1 (CP3) → F5 + I3 (CP4) → V1–V4 (CP5) → Z1–Z3 (freeze).
Parallel tracks that must land by CP3: S3 → N2 → N3 · S4 → F1 → F2 → F3 → F4 · G4.

### The critical path runs through Deep: two ways to reduce the risk

1. **Push G1 first (~H2), before finishing G2.** Deep merges the Sun/Earth series and the Moon-fixed
   Earth direction as soon as they exist, so Shaheen can build N1/N4 on real Earth data early.
2. **Flat-horizon fallback if G2 runs late.** Shaheen writes the first site/relay files with a flat 0°
   horizon so the pipeline and UI can be checked end to end. Rules (CLAUDE.md §5):
   - set `horizon.source.notes = "NO TERRAIN: flat 0° horizon, temporary"`
   - the UI shows a **NO TERRAIN** banner whenever it sees that note
   - G2's real horizon replaces it before CP4. A flat horizon on `main` at the Day-1 freeze is a blocker

**Fallback if CP3 slips past H8:** cut F7 (with the hero), F6 and all P1 rows; ship the DTE + one-relay timeline
for one site with metrics. That still meets the exit condition.

## Excluded (P2)

Inter-satellite routing, radio link budgets, orbit optimization, AI recommendations, 3D globe / whole-Moon orbit view (the F7 lander sky view is P1),
landing safety/flatness, geology or science-value ranking.
