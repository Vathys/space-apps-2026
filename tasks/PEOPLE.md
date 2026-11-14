# Who does what

Per-person view of [BOARD.md](BOARD.md); task IDs and hours match it. Hours are relative to
Day-1 kickoff (H0). Every task is one `/contribute` branch + PR unless it says otherwise.

| Person | Role | Board name |
|---|---|---|
| **Amisha** | UI & Vercel | Dev 3 |
| **Deep** | NASA data & Moon geometry | Dev 2 |
| **Shaheen** | Relay satellites & network math | Dev 1 |

---

## Amisha: UI & Vercel (Dev 3)

**Owns:** `src/app/`, `src/components/`, `src/lib/lunanav/data.ts`, the Vercel project.
**Goal:** a planner opens the Vercel URL, picks a site, date and relay, and reads direct vs relay results.

**S4 · Project setup & first deploy (H0–H1)**
- [ ] `bun create next-app`: TypeScript, App Router, Tailwind
- [ ] Add shadcn/ui: button, select, card, slider, tabs, tooltip
- [ ] `output: "export"` in `next.config.ts`
- [ ] Vercel project from the GitHub repo. Preset: Next.js; install `bun install`; build `bun run build`
- [ ] Production URL loads; a PR gets a preview URL
- **Done when:** the empty app is live and the link is in the README

**F1 · Layout on placeholder data (H1–H3)**
- [ ] Page layout:
  - control bar
  - result cards: coverage %, longest blackout, blackout count, sunlit %
  - timelines area
  - comparison area
- [ ] `public/data/placeholder/` sample files shaped like [data-contracts.md](../docs/data-contracts.md), each marked `"placeholder": true`
- [ ] **PLACEHOLDER DATA** banner whenever placeholder files are loaded
- **Done when:** the full layout renders from placeholder files

**F2 · Data loader (H1–H3)**
- [ ] `data.ts` fetches `/data/index.json`, `/data/sites/<id>.json`, `/data/relays/<site>/<config>.json`
- [ ] Narrow each to `types.ts`; a missing file shows a visible error, never a blank
- **Done when:** placeholder files load with no type errors

**F3 · Controls (H3–H5)**
- [ ] Site selector from `index.json`
- [ ] Start date + duration (1–30 days), limited to the supported window
- [ ] Outside the window: "Outside supported data window", no numbers
- [ ] Relay selector: "Direct only" + each relay config
- [ ] Minimum elevation mask slider, 0–10°
- [ ] Choices stored in the URL (`?site=…&start=…&days=…&relay=…`)
- **Done when:** changing any control updates the URL and the results

**F4 · Timelines & metrics (H3–H5)**
- [ ] Timeline rows: Earth direct (DTE), Relay, Connected, Sunlight
- [ ] Metric cards, each with a "geometric line-of-sight" caveat and a source line
- [ ] Small table with the same numbers under each chart
- **Done when:** everything renders from a `ConnectivityResult`

**I1 · First real end-to-end (H5–H7), CP3**
- [ ] Switch from placeholder to real `public/data/`
- [ ] Wire controls → `visibility.ts` → `network.ts` → UI
- **Done when:** the P0 site + one relay works on the production URL

**F5 · Comparison (H7–H9)**
- [ ] Direct-only vs relay-assisted, side by side
- [ ] Scenario A vs B (different site or date), shown together

**F6 · Network status view (H7–H9)**
- [ ] At the selected time: is Earth visible, and which relay is visible to the lander and to Earth
- [ ] Simple diagram: lander → relay → Earth, links green or red

**I3 · Remove placeholders (by H9), CP4**
- [ ] Delete `public/data/placeholder/` and the banner code

**V4 · Deployed-app check (H9–H11)**
- [ ] Fresh browser, phone, out-of-window date, every relay config

**Z1 / Z2 · Freeze (H11–H12)**
- [ ] Merge README edits
- [ ] Record the fallback demo video from the production URL

---

## Deep: NASA data & Moon geometry (Dev 2)

**Owns:** `data/horizons.py`, `lola.py`, `pgda.py`, `terrain.py`, `sites.py`, `geometry.py`, `src/lib/lunanav/visibility.ts`.
**Goal:** correct Sun/Earth positions and the real terrain horizon for each site.

**G1 · Sun & Earth series (H1–H3)**
- [ ] `sites.py`: Sun + Earth az/el (+ Earth range) at the P0 site over the agreed window, every 10 min
- [ ] Use the existing Horizons connector; cache in `data/raw/`; UTC
- [ ] Also dump the Moon-fixed Earth direction for the same window (Shaheen needs it)
- **Done when:** 12,961 samples per series; Earth elevation within about ±8°

**G2 · Terrain horizon (H1–H3)**
- [ ] `terrain.py`: 360° horizon at 0.5° steps (720 values)
- [ ] Near field from the PGDA 5 m DEM; far field to ≥ 150 km from LOLA `LDEM_75S_120M`
- [ ] Include lunar curvature
- [ ] Notebook plot: distant ridges (e.g. toward Malapert) show up
- **Done when:** profile looks plausible; source and resolution recorded

**G3 · Geometry functions for Shaheen (H3–H5)**
- [ ] `geometry.py`:
  - `topocentric(site, positions_km)` → az/el/range
  - `sees_earth(positions_km, earth_unit)`: Moon (R = 1737.4 km) blocks the relay's view of Earth?
- [ ] Check: Earth az/el from the Moon-fixed track matches Horizons' direct output to < 0.01°
- **Done when:** Shaheen can call both functions

**G4 · Browser visibility functions (H3–H5)**
- [ ] `visibility.ts`:
  - horizon interpolation, azimuth wrap at 360°
  - "above terrain + mask" test → `Uint8Array`
  - sunlit fraction, Sun as a disk
- [ ] Hand checks: a 7° ridge blocks Earth at 3°; a half-hidden Sun gives ~0.5

**G5 · Second site, P1 (H7–H9)**
- [ ] Shackleton Rim (PGDA Site04): rerun G1 + G2

**V2 · Science sanity check (H9–H11)**
- [ ] DTE % vs Moon Trek's average Earth-visibility map
- [ ] Earth elevation range vs libration
- [ ] Horizon vs known terrain
- [ ] Differences written up in `docs/decisions.md`

---

## Shaheen: Relay satellites & network math (Dev 1)

**Owns:** `data/relays.py`, `data/precompute.py`, `src/lib/lunanav/network.ts`, `src/lib/lunanav/types.ts` (the shared contract).
**Goal:** simulated relay orbits, and the logic that turns visibility into coverage and blackouts.

**S3 · Shared types (H0–H1). First, because the others depend on it**
- [ ] Copy the TypeScript from [data-contracts.md](../docs/data-contracts.md) into `types.ts` and merge
- [ ] Walk Amisha and Deep through it

**N1 · Relay orbit propagation (H1–H3)**
- [ ] `relays.py`: two-body Kepler propagation of the P0 relay (Queqiao-2-like, elements from `relays.csv`)
- [ ] Convert to Moon-fixed coordinates (uniform Moon spin)
- [ ] Mark every simplification with `# shortcut:`
- **Done when:** 12,961 positions; distance from the Moon's centre stays between perilune and apolune

**N2 · Path logic (H1–H3)**
- [ ] `network.ts`: `connected = DTE OR any(lander sees relay AND relay sees Earth)`
- [ ] Check on small hand-made arrays

**N3 · Metrics (H3–H5)**
- [ ] Coverage %, DTE-only %, relay gain, blackout intervals, longest blackout, blackout count
- [ ] Slice by start + duration; `outside-window` error outside it
- [ ] Blackouts crossing the slice start/end handled
- **Done when:** a 1-day slice matches a hand count

**N4 · Write the data files (H3–H5), CP2**
- [ ] `precompute.py` writes:
  - `public/data/index.json`
  - `sites/<id>.json` (from Deep's series)
  - `relays/<site>/<config>.json` (using Deep's geometry functions)
- [ ] Shapes and sizes (< 2 MB per file) checked before writing
- **Done when:** files merged to `main`

**N5 · More relay configs, P1 (H7–H9)**
- [ ] Two satellites in the same orbit, phased 180°
- [ ] Low polar circular orbit, 100 km

**V1 / V3 · Validation (H9–H11)**
- [ ] Hand-count a 2-day slice vs `network.ts`
- [ ] Audit data files: every one has source + uncertainty; no hand-written results

---

## Handoffs

| When | From → to | What |
|---|---|---|
| H1 | Shaheen → everyone | `types.ts` merged |
| H3 | Deep → Shaheen | Sun/Earth series + Moon-fixed Earth direction |
| H5 | Deep → Shaheen | `geometry.py` functions |
| H5 | Deep → Amisha | `visibility.ts` |
| H5 | Shaheen → Amisha | real `public/data/` files + `network.ts` |
| H7 | everyone | first end-to-end on Vercel (CP3) |

## Shared tasks (everyone)

- **S1/S2 (H0–H1):** agree D-10 to D-17 and fill the "To decide at H0" table in [decisions.md](../docs/decisions.md)
- **S5 (H0–H1):** each person opens their first branch + draft PR
- **Z3 (H11–H12):** confirm the Day-1 exit condition on the production URL
- **Day 2:** the touch-up checklist in [BOARD.md](BOARD.md)
