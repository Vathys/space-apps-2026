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
| D-16 | **Relay model:** two-body Kepler + uniform Moon spin; configs are *simulated reference* orbits (P0: one Queqiao-2-like elliptical frozen orbit, elements from `relays.csv`, argp = 90°, RAAN stated); NASA LCRNS used as a reference, never presented as deployed | **superseded by D-18 and D-19** (Queqiao-2 fails the Accords rule; uniform spin can't place LCRNS's published orbits) | — |
| D-17 | **Connectivity rule:** a sample is connected only if DTE is clear **or** some relay is above the lander's terrain horizon + mask **and** sees Earth. Geometric line-of-sight only: no link budget, DSN scheduling or inter-satellite links | proposed | TBD |

## Relays, site and mask (2026-11-14, evening): proposed in #35

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-18 | **Artemis Accords rule:** relay configs are based only on relays whose operator's country has signed the [Artemis Accords](https://www.nasa.gov/artemis-accords/). We judge by operator country, because ESA as an agency isn't a party (Lunar Pathfinder → SSTL, UK; Moonlight → Telespazio, Italy). Each relay's status and signing date are in the `operator_country`, `artemis_accords` and `accords_signed` columns of `data/relays.csv`. This rules out Queqiao-1/2, Tiandu-1/2 and the ILRS Queqiao constellation, so it replaces the Queqiao-2-based P0 relay in D-16. Consequence to state in the pitch: no Accords relay offers south-pole relay service today, so for now the app compares DTE with *planned* relays | proposed | Deep (proposer) |
| D-19 | **Relay model (replaces D-16):** P0 relay config `lcrns-ref-5sat` = NASA's [LCRNS reference constellation v3.1](https://www.nasa.gov/wp-content/uploads/2025/08/nasa-lunar-communications-relay-and-navigation-systems-lcrns-reference-constellation-3-1.pdf), using the published orbits from its Tables 1–2 (5 satellites, ~30 h elliptical frozen orbits, apolune over the south pole, epoch 2027-03-01 00:00 UTC, inside the window). Copied into `data/relay_orbits.csv`. The elements are in the Moon principal-axis frame frozen at J2000 (checked: the IAU J2000 body frame agrees within 0.03°; elements rebuilt to ICRF reproduce the published states within 10 km). Propagation is two-body (the window starts 2 months before the epoch: a stated shortcut). Rotation to Moon-fixed uses the **IAU 2015 lunar rotation model** (the frame Horizons uses), not uniform spin, because the published RAANs are tied to an inertial frame. `meanAnomalyDeg` is computed from the published true anomaly. P1 configs: `lcrns-ref-1sat` (SV-1 only: the first satellite before the full constellation) and `lunar-pathfinder` (SSTL service-guide baseline; epoch, RAAN and phase assumed). LCRNS is a government reference design for the Intuitive Machines NSN relays, never presented as deployed: IM chooses the final design | proposed | Deep (proposer) |
| D-20 | **Elevation-mask slider (changes the F3 plan):** keep a 0–10° slider, default 0° (geometric), applied to both DTE and lander→relay legs (D-17 unchanged). But it lives with the DTE results and is labeled "minimum elevation above terrain (affects direct-to-Earth most)". With `lcrns-ref-5sat`, the highest LCRNS satellite stays ≥ 47° elevation at the pole all through March 2027, while the highest terrain horizon in the 80 × 80 km polar region is 35.5° (notebook `05_relay_coverage_forecast`), so the mask barely moves relay-assisted results. Earth stays within ±7.5° of the horizon at site01 (G1), so the mask is a DTE sensitivity control. F3 done-when adds: raising the mask from 0° to 5° lowers DTE coverage, and the relay-assisted number is recomputed, not hidden | proposed | Deep (proposer) |

## To decide at H0 (fill in, then mark agreed)

| Decision | Proposed value | Value |
|---|---|---|
| Deadline (local time); Day-1 freeze; final submission freeze | Day-1 freeze H12; submission freeze deadline − 3 h | TBD |
| Names for Dev 1 / Dev 2 / Dev 3 | Shaheen / Deep / Amisha (UI) | Shaheen / Deep / Amisha, per Shaheen 2026-11-14; confirm at H0 |
| P0 site + coordinates | `site01_connecting_ridge` at **(−89.4869, 223.6980 E)**: the spot in the Site01 PGDA tile with the largest worst-case Earth clearance (notebook `04_comms_coverage`, 500 m grid; 1,887 m height, 790 m from the tile center). The old value (−89.4632, 222.5104 E) is the DEM's center, not a chosen spot: moving 350 m there flipped a day's DTE from 100% to 0%. Confirm with G2's 5 m horizon before H3, then update `SITES` in `data/horizons.py` and rerun G1/G2 | TBD |
| P1 site | `site04_shackleton_rim` (−89.7630, 187.9976 E) | TBD |
| Supported mission window + step | 2027-01-01T00:00Z → 2027-04-01T00:00Z, 10 min (12,961 samples). Current dumps end 2026-11-28, so new ones are needed | TBD |
| Minimum link elevation mask above terrain | 0° default (geometric), user-adjustable 0–10°, presented as a DTE sensitivity control (D-20) | TBD |
| P0 relay config | `lcrns-ref-5sat`: NASA LCRNS reference constellation v3.1, published orbits in `data/relay_orbits.csv` (D-19). Was `qq2-like-elfo-1` (Queqiao-2), dropped by D-18 | TBD |
| P1 relay configs | `lcrns-ref-1sat` (LCRNS SV-1 only), `lunar-pathfinder` (SSTL baseline, epoch/RAAN/phase assumed) (D-19) | TBD |
| Moon body-fixed frame (Horizons IAU vs LOLA MOON_ME) | Treat as equal; quantify in V2. Relay orbits are rotated with the IAU 2015 model, so they share Horizons' frame (D-19) | TBD |
| Demo scenario | Site01, direct-only vs `lcrns-ref-5sat`, then the date shifted +14 days | TBD |

## Open questions

- From the brainstorm: gravity anomalies, lunar seasons, temperature, seismic events. All out of scope under D-10.
- Real orbiter tracks (LRO, Danuri, Chandrayaan-2 from PR #2): Horizons predictions end before or near 2027 (Chandrayaan-2 2026-12-11, Danuri 2027-06-03), so they can't cover the proposed window. Use them only to validate the propagator, not as relay configs?
