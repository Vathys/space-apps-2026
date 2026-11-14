# Decisions

One line per decision: date · what · who agreed. Claude reads this before
proposing to change any of them. Change a decision in a PR, not in your own copy.

## Made

| Date | Decision | Agreed by |
|---|---|---|
| 2026-11-14 | Web app: Next.js (static export) + bun + Tailwind + shadcn, deployed to Vercel | TBD |
| 2026-11-14 | Architecture: precompute offline, the app reads committed JSON only; no API routes, backend or database | TBD |
| 2026-11-14 | Data pipeline is Python (uv) in `data/` (connectors on `main` by Vathys); web app is TypeScript (bun). They meet only at `data/precomputed/*.json` | TBD |
| 2026-11-14 | South-pole DEMs: PGDA product 78, LOLA 5 m/px (Barker et al. 2021) for Connecting Ridge and Shackleton Rim | Vathys (via `main`) |
| 2026-11-14 | One-day build: no automated tests, no Docker | TBD |
| 2026-11-14 | Workflow: `/contribute` + `/review` skills; nobody pushes to `main` | TBD |

## To decide at H0 (fill in, then move each row up to "Made")

| Decision | Value |
|---|---|
| Deadline (local time) and freeze time (deadline − 2h) | TBD |
| Lane owners A / B / C | TBD |
| Sites (4–6): e.g. one Apollo, IM-2 near Mons Mouton, Blue Ghost in Mare Crisium, a south-pole Artemis candidate | TBD |
| Mission window and time step (current Horizons dump: hourly, 2026-01-01 → 2027-01-01) | TBD |
| Coordinate frame for sites.json (planetocentric, east-positive longitude?) | TBD |
| LOLA product for non-polar sites (global LDEM, which resolution?) | TBD |
| Lander constraints: max slope, landing-ellipse radius, minimum flat patch (with source) | TBD |
| Demo scenario: which Site A / Site B and dates | TBD |

## Open questions from the brainstorm

- Gravity anomalies (?): do they matter to an early-stage planner? Stretch for now.
- Lunar seasons (?): separate view, or covered by a year-long window? Stretch for now.
