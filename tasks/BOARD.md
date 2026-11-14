# Task board: Day 1 builds everything, Day 2 is touch-ups

Scope, architecture and contracts: [CLAUDE.md](../CLAUDE.md), [docs/architecture.md](../docs/architecture.md),
[docs/data-contracts.md](../docs/data-contracts.md). Hours are relative to Day-1 kickoff (H0).
Each row is one `/contribute` branch + PR unless it says otherwise. P0 rows come before any P1 row.

**Day-1 exit condition:** anyone can open the deployed Vercel URL, pick a supported south-pole
site and date, and compare direct-to-Earth vs relay-assisted communication using computed results.

## Owners

| Role | Owns | Name |
|---|---|---|
| **Dev 1: Satellite simulation & networking** | `data/relays.py`, `data/precompute.py`, `lib/lunanav/network.ts`, `lib/lunanav/types.ts` | TBD |
| **Dev 2: NASA data & lunar geometry** | `data/horizons.py`, `lola.py`, `pgda.py`, `terrain.py`, `sites.py`, `geometry.py`, `lib/lunanav/visibility.ts` | TBD |
| **Dev 3: Frontend & Vercel** | `src/app/`, `src/components/`, `lib/lunanav/data.ts`, Vercel project | TBD |

## Checkpoints (all three stop and integrate)

| CP | When | Pass condition |
|---|---|---|
| **CP1** | H1 | "To decide at H0" table in decisions.md filled in; D-10 to D-17 agreed; `types.ts` merged; empty app live on Vercel production |
| **CP2** | H5 | Real `sites/<P0 site>.json` and `relays/<P0 site>/<P0 config>.json` merged to `main` under `public/data/` |
| **CP3** | H7 | **First end-to-end on the Vercel URL:** one site, one window, one relay, computed DTE + relay timelines and metrics |
| **CP4** | H9 | MVP complete: placeholders gone, direct-vs-relay comparison and scenario switch work |
| **CP5** | H11 | Validation done, no critical integration dependency open |
| **FREEZE** | H12 | Day-1 feature freeze: deployed, README + method written, fallback video recorded |

---

## DAY 1

### H0–H1 · Architecture & setup (everyone)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| S1 | Assign names to Dev 1/2/3; agree the MVP (P0 list in CLAUDE.md §2) | all | Names in this board and CLAUDE.md §4 | todo |
| S2 | Agree D-10 to D-17, then fill the "To decide at H0" table in docs/decisions.md: P0 site, supported window + step, min elevation mask, P0 relay config, deadline | all | No "TBD" left in those rows | todo |
| S3 | Copy docs/data-contracts.md into `src/lib/lunanav/types.ts` | Dev 1 | Merged; the other two have read it | todo |
| S4 | Next.js + bun + Tailwind + shadcn scaffold, `output: "export"`, Vercel project linked to `main`, preview deploys on PRs | Dev 3 | Production URL loads; a PR shows a preview URL | todo |
| S5 | Each dev opens their first feature branch + draft PR | all | 3 draft PRs visible | todo |

### H1–H3 · Parallel development

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| N1 | `data/relays.py`: two-body Kepler propagation in a Moon-centred inertial frame → Moon-fixed positions (uniform spin) for the P0 config over the window | Dev 1 | Positions for 12,961 samples; radius stays between perilune and apolune from relays.csv | todo |
| N2 | `network.ts` core: `connected = dte OR any(landerSeesSat AND satSeesEarth)` on `Uint8Array`s | Dev 1 | Small hand-made arrays give the expected connected series | todo |
| G1 | `data/sites.py`: Sun + Earth az/el (+ Earth range) at the P0 site over the window, from Horizons, cached | Dev 2 | Series with 12,961 samples, UTC; Earth elevation stays within about ±8° at the pole | todo |
| G2 | `data/terrain.py`: 360° terrain horizon (0.5° step) from PGDA 5 m near field + LOLA `LDEM_75S_120M` far field, with lunar curvature | Dev 2 | Profile plotted in a notebook; distant ridges (e.g. Malapert direction) visible | todo |
| F1 | App layout on placeholder JSON (`public/data/placeholder/`, banner shown) | Dev 3 | Page shows site picker, date controls, empty timelines | todo |
| F2 | `lib/lunanav/data.ts`: fetch `index.json`, site and relay files; narrow to `types.ts` | Dev 3 | Loads placeholder files with no type errors | todo |

### H3–H5 · Functional modules

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| N3 | Blackout intervals, longest blackout, coverage %, DTE %, relay gain; window slicing by start + duration; `outside-window` error | Dev 1 | Hand-checked on a 1-day slice | todo |
| N4 | `data/precompute.py`: writes `index.json`, `sites/<id>.json`, `relays/<site>/<config>.json`; checks shapes and sizes before writing | Dev 1 | Files written, each < 2 MB; merged = **CP2** | todo |
| G3 | `data/geometry.py`: Moon-fixed → topocentric az/el/range; relay–Earth occultation (`sees_earth`) | Dev 2 | Earth az/el from the Moon-fixed track matches `observer_table` to < 0.01° | todo |
| G4 | `visibility.ts`: horizon interpolation (azimuth wrap at 360°), above-terrain test with min mask, Sun-disk sunlit fraction | Dev 2 | A 7° ridge blocks Earth at 3°; a half-hidden Sun gives ~0.5 | todo |
| F3 | Controls: site selector, start date + duration (clamped to the window, limitation message outside it), relay config selector (incl. "direct only") | Dev 3 | Changing controls updates the URL search params | todo |
| F4 | Timelines: DTE, relay, connected, sunlight rows; metric cards (coverage, longest blackout, blackout count); table alternative | Dev 3 | Renders from a `ConnectivityResult` | todo |

### H5–H7 · First end-to-end integration (P0)

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| I1 | Wire real `public/data/` → `visibility.ts` → `network.ts` → UI for the P0 site + P0 relay config | all (Dev 3 drives) | **CP3** on the Vercel production URL | todo |
| I2 | Provenance + "geometric line-of-sight only" caveat shown next to every metric | Dev 3 | Every number has a source line | todo |

### H7–H9 · Complete the MVP

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| F5 | Direct vs relay comparison view, plus Scenario A vs B (site or date switch) side by side | Dev 3 | Two scenarios on screen with their metrics | todo |
| F6 | Network status view: which satellite is in view of the lander and of Earth at the selected time | Dev 3 | Updates when scrubbing the timeline | todo |
| I3 | Delete `public/data/placeholder/` and the banner path | Dev 3 | No placeholder file on `main` = **CP4** | todo |
| N5 | *(P1)* More relay configs, e.g. 2-satellite elliptical frozen orbit phased 180°, low circular polar orbit | Dev 1 | Selectable in the UI | todo |
| G5 | *(P1)* Second south-pole site (e.g. Shackleton rim, PGDA Site04) | Dev 2 | Selectable in the UI | todo |

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

## Critical path

S2 → G1 + G2 → G3 → N4 (CP2) → I1 (CP3) → F5 + I3 (CP4) → V1–V4 (CP5) → Z1–Z3 (freeze)

Parallel tracks that must land by CP3: S3 → N2 → N3 · S4 → F1 → F2 → F3 → F4 · G4.

**Fallback if CP3 slips past H8:** cut F6 and all P1 rows; ship the DTE + one-relay timeline
for one site with metrics. That still meets the exit condition.

## Excluded (P2)

Inter-satellite routing, radio link budgets, orbit optimization, AI recommendations, 3D globe,
landing safety/flatness, geology or science-value ranking.
