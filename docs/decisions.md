# Decisions

One line per decision: ID · date · what · status · who agreed. Claude reads this before
proposing to change any of them. Change a decision in a PR, not in your own copy.
**Never delete a row:** mark it *superseded by D-xx* instead.

Status: **agreed** (team said yes) · **proposed** (written down, waiting for the team) ·
**superseded** (replaced, kept for history).

## Earlier decisions (2026-11-14, morning)

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-01 | Web app: Next.js (static export) + bun + Tailwind + shadcn, deployed to Vercel | agreed in PR #1; **reaffirmed by D-11** | PR #1 approver |
| D-02 | Architecture: precompute offline, the app reads committed JSON only; no API routes, backend or database | agreed in PR #1; **reaffirmed by D-11** | PR #1 approver |
| D-03 | Data pipeline is Python (uv) in `data/`; web app is TypeScript (bun). They meet only at `data/precomputed/*.json` | agreed in PR #1; **output folder superseded by D-12** (`public/data/`) | PR #1 approver |
| D-04 | South-pole DEMs: PGDA product 78, LOLA 5 m/px (Barker et al. 2021) for Connecting Ridge and Shackleton Rim | agreed; kept as the near-field DEM (D-15) | Vathys (via `main`) |
| D-05 | One-day build: no automated tests, no Docker | **superseded by D-13** (two-day schedule); "no automated test suite, no Docker" kept | PR #1 approver |
| D-06 | Workflow: `/contribute` + `/review` skills; nobody pushes to `main` | agreed; kept | PR #1 approver |
| D-07 | Scope: three priorities (terrain-aware Sun/Earth visibility, landing suitability, side-by-side science comparison) | **superseded by D-10** | PR #1 approver |
| D-08 | Three lanes A (ephemeris/visibility), B (terrain/suitability), C (science/UI) | **superseded by D-14** | PR #1 approver |

## New scope and schedule (2026-11-14, afternoon): proposed

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-10 | **Scope:** LunaNav becomes a *Lunar Communication Network Planner* for early-stage south-pole mission planners: DTE visibility, simulated relay network, direct vs relay coverage and blackouts, with Sun/Earth sunlight kept. Landing safety, geology and science ranking move to P2 (excluded). Answers PR #2's request to confirm the relay scope | proposed | TBD |
| D-11 | **Deployment:** static-first Next.js export on Vercel; no Python, FastAPI, database, Docker, Redis or Kubernetes at runtime | proposed | TBD |
| D-12 | **Data location:** `data/precompute.py` writes to `public/data/` (index.json, sites/, relays/) so Vercel serves it from the CDN. Replaces `data/precomputed/` | proposed | TBD |
| D-13 | **Schedule:** two-day hackathon; all development, integration and first deployment finish on Day 1 (feature freeze H12); Day 2 is touch-ups only; final submission freeze 3 h before the deadline | proposed | TBD |
| D-14 | **Ownership:** Dev 1 satellite simulation & networking · Dev 2 NASA data & lunar geometry · Dev 3 frontend & Vercel (files in CLAUDE.md §4) | proposed | TBD |
| D-15 | **Terrain horizon:** PGDA 5 m near field + LOLA `LDEM_75S_120M` (120 m) far field to ≥ 150 km, 0.5° azimuth step, lunar curvature included | proposed (depends on PR #2's `lola.py`) | TBD |
| D-16 | **Relay model:** two-body Kepler + uniform Moon spin; configs are *simulated reference* orbits (P0: one Queqiao-2-like elliptical frozen orbit, elements from `relays.csv`, argp = 90°, RAAN stated); NASA LCRNS used as a reference, never presented as deployed | proposed | TBD |
| D-17 | **Connectivity rule:** a sample is connected only if DTE is clear **or** some relay is above the lander's terrain horizon + mask **and** sees Earth. Geometric line-of-sight only: no link budget, DSN scheduling or inter-satellite links | proposed | TBD |

## To decide at H0 (fill in, then mark agreed)

| Decision | Proposed value | Value |
|---|---|---|
| Deadline (local time); Day-1 freeze; final submission freeze | Day-1 freeze H12; submission freeze deadline − 3 h | TBD |
| Names for Dev 1 / Dev 2 / Dev 3 | Shaheen / Deep / Amisha (UI) | Shaheen / Deep / Amisha, per Shaheen 2026-11-14; confirm at H0 |
| P0 site + coordinates | `site01_connecting_ridge` (−89.4632, 222.5104 E), the PGDA 5 m DEM center (`data/horizons.py`) | TBD |
| P1 site | `site04_shackleton_rim` (−89.7630, 187.9976 E) | TBD |
| Supported mission window + step | 2027-01-01T00:00Z → 2027-04-01T00:00Z, 10 min (12,961 samples). Current dumps end 2026-11-28, so new ones are needed | TBD |
| Minimum link elevation mask above terrain | 0° default (geometric), user-adjustable 0–10° | TBD |
| P0 relay config | `qq2-like-elfo-1`: a = 10,335.1 km, e = 0.8073, i = 119.25°, argp = 90°, RAAN = 0° (assumed), M0 = 0° at window start | TBD |
| P1 relay configs | `elfo-2sat` (same orbit, phased 180°), `low-polar-100km` (circular, 100 km, i = 90°) | TBD |
| Moon body-fixed frame (Horizons IAU vs LOLA MOON_ME) | Treat as equal; quantify in V2 | TBD |
| Demo scenario | Site01, direct-only vs `qq2-like-elfo-1`, then the date shifted +14 days | TBD |

## Open questions

- From the brainstorm: gravity anomalies, lunar seasons, temperature, seismic events. All out of scope under D-10.
- Real orbiter tracks (LRO, Danuri, Chandrayaan-2 from PR #2): Horizons predictions end before or near 2027 (Chandrayaan-2 2026-12-11, Danuri 2027-06-03), so they can't cover the proposed window. Use them only to validate the propagator, not as relay configs?
