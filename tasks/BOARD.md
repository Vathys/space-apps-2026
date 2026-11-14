# Task board: one-day build

Three lanes, one per person, working in parallel. Hours are relative to kickoff (H0).
Deadline and freeze time go in [docs/decisions.md](../docs/decisions.md).
Each row is one `/contribute` branch + PR unless it says otherwise.

**Critical path:** H0 setup → A2 ephemeris + B2 horizon profile → A3 visibility →
C4 build-sites → C5 compare page → demo video → submit.

## H0–H1 · Everyone, together

| ID | Task | Done when | Owner | Status |
|---|---|---|---|---|
| S1 | Fill in decisions.md: sites (4–6), mission window, LOLA product, lander constraints, owners | Every "TBD" row in decisions.md has a value | all | todo |
| S2 | `data/sites.json` from S1: id, name, lat, lon, frame, category, source URL | File committed; coordinates each have a source | C | todo |
| S3 | `src/lib/lunanav/types.ts`: shapes for sites.json and `precomputed/<site>.json` | All three lanes have agreed on it | all | todo |
| S4 | Next.js + bun + Tailwind + shadcn scaffold, static export, deployed empty to Vercel | Public URL loads | C | todo |

## Lane A · When? Sun/Earth visibility (priority 1)

| ID | Task | Hours | Done when | Owner | Status |
|---|---|---|---|---|---|
| A1 | One Horizons query for one site: Sun (10) + Earth (399) az/el, observer `coord@301` | H1–H2 | Response parsed into az/el in UTC | TBD | todo |
| A2 | `scripts/fetch-horizons.ts`: all sites × mission window, cached in data/raw/ | H2–H3 | Re-run uses the cache, no network | TBD | todo |
| A3 | `lib/lunanav/visibility.ts`: visible if el > horizon(az), Sun as a disk; windows + metrics (% sunlit, longest dark, Earth windows, time to sunset/Earthset) | H3–H6 | Works on a made-up ridge (dev only, not shipped): the 7° ridge blocks the Sun at 3° | TBD | todo |
| A4 | Date shift: rerun A3 for a window shifted N days, in the browser | H6–H7 | "+14 days" changes the numbers instantly | TBD | todo |
| A5 | Sanity check: near-side Apollo site has Earth high; a south-pole site has Earth near the horizon | H7 | Noted in the PR | TBD | todo |

## Lane B · Where? Terrain + preliminary suitability (priority 1 → 2)

| ID | Task | Hours | Done when | Owner | Status |
|---|---|---|---|---|---|
| B1 | Download LOLA tiles for the sites (polar high-res + global LDEM) into data/raw/ | H1–H2 | Tiles load; resolution noted in decisions.md | TBD | todo |
| B2 | `scripts/build-terrain.ts`: 360° horizon profile per site, with lunar curvature | H2–H5 | Profile JSON per site; **hand to Lane A by H5** | TBD | todo |
| B3 | Slope + roughness inside the landing ellipse; largest flat patch vs lander constraints | H5–H7 | "% of ellipse usable", largest patch, mean slope per site | TBD | todo |
| B4 | Hazard flags: DEM resolution vs lander footprint, boulders below resolution, PSR/shadow | H7–H8 | Every suitability result lists its flags; no "safe" anywhere | TBD | todo |

## Lane C · Why? Science + the app (priority 3, plus all UI)

| ID | Task | Hours | Done when | Owner | Status |
|---|---|---|---|---|---|
| C1 | Science card per site: USGS geologic unit, mission history/samples, water-ice/PSR note, references | H1–H3 | Every claim has a link | TBD | todo |
| C2 | Home page: pick two site-date scenarios | H3–H4 | Picks go into `/compare?a=…&b=…` | TBD | todo |
| C3 | Compare page shell with components, running on sample JSON clearly labelled "demo data" | H4–H5 | Layout done before real data arrives | TBD | todo |
| C4 | `scripts/build-sites.ts`: join A2 + B2/B3 + C1 → `data/precomputed/<site>.json` | H5–H6 | Real files committed, < 1 MB each | TBD | todo |
| C5 | Compare page on real data: sky/horizon chart, sunlight & comm timeline, metrics table, suitability, science card, sources | H6–H8 | Every number shows its source; "demo data" label gone | TBD | todo |

## H8–H10 · Everyone

| ID | Task | Done when | Owner | Status |
|---|---|---|---|---|
| D1 | Demo scenario: Site A vs Site B, then the launch slips 2 weeks | Story works on the deployed URL | all | todo |
| D2 | Record the fallback demo video | Video saved | TBD | todo |
| D3 | **Freeze** (2h before deadline): README "how to run", `docs/pitch.md`, limitations, bug fixes only | — | all | todo |
| D4 | Submit on the Space Apps portal: URL + repo + video | Submitted | TBD | todo |

**Fallback if C5 slips:** show A3's timeline for two sites side by side. That still covers the core challenge (priority 1).

## Stretch (only if everything above is merged)

- Planner vs public mode (plain-language text)
- Map view with slope overlay + LROC image
- Custom lat/lon (needs on-demand precompute)
- From the brainstorm: temperature (Diviner), gravity anomalies (GRAIL), seismic events (Apollo PSE), year-long seasons view
