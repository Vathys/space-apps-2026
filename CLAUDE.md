# CLAUDE.md — LunaNav

Shared rules for the three of us and our three Claudes. Everything here is a
team decision: change it in a PR, never in your own copy, so all three Claudes
read the same rules.

> The LLM-wiki CLAUDE.md on the Desktop (parent folder) does **not** apply to
> this repo. Ignore its wiki/ingest/log instructions here.

**The schedule rule:** the hackathon is two days. **All development,
integration and the first Netlify deployment finish on Day 1. Day 2 is
touch-ups only** (§8). Use judgment on anything trivial, but never on the data
rules (§5) or the git rules (§4).

**Not in this build (team decision):** an automated test suite, Docker, a
backend server (FastAPI or similar), a database, Redis/Kubernetes, or Python
running on Netlify. Don't add them. Each deliverable is checked by its "done
when" line on the board, by running it and looking at the output, and on the
deployed URL (§7).

---

## 1. How Claude works here

- **Think before coding.** State assumptions. If the task has more than one
  reading, say so; don't pick silently. If a simpler approach exists, say so.
- **Simplicity first.** Minimum code that solves the problem. No "for later",
  no single-use abstractions, no configurability nobody asked for.
- **Surgical changes.** Touch only what the task needs. Match existing style.
  Every changed line traces to the task.
- **Checkable goals.** Turn each task into something you can see working:
  "relay path" → "with Earth below the ridge and the relay at 20° elevation and
  seeing Earth, that sample counts as connected; with the relay behind the
  Moon from Earth's side, it doesn't". State multi-step plans as
  `step → how I'll check it`.
- **Honesty about results.** Say what actually ran and what you actually saw.
  If a step was skipped or partial, say so. Never present a placeholder as a
  computed number (§5).

---

## 2. What LunaNav is

**LunaNav — Lunar Communication Network Planner.** Our entry for NASA Space
Apps Challenge 2026, "Lunar Landing Site Navigator".

**Target user:** early-stage lunar mission planners.

**Problem:** at the lunar south pole, direct-to-Earth (DTE) communication is
interrupted. Earth sits near the horizon, wobbles with libration, and is
blocked by terrain. Relay satellites can provide another path, but planners
can't quickly see how much they help at a given site and date.

**What the user does** (the Day-1 exit condition, §8):
1. Pick a south-pole landing site.
2. Pick a mission start date and duration inside the supported data window.
3. See DTE geometric visibility (terrain-aware) and sunlight.
4. Enable a simulated relay configuration.
5. See coverage %, blackout intervals and the longest blackout, for direct
   vs relay-assisted.
6. Change the site, date or relay config and compare scenarios side by side.

**A sample counts as connected only if a complete path exists:**
lander → Earth, or lander → relay → Earth (both legs clear at that sample).

**Pitch in one sentence:** we don't replace Horizons, LOLA or NASA's relay
studies; we put them together so a planner can see, in seconds, when a
south-pole site can talk to Earth, and how much a relay helps.

### MVP priorities (never trade P0 for P1/P2)
- **P0 (Day 1, must ship):**
  - one verified south-pole site
  - real Sun/Earth ephemeris and a terrain horizon
  - DTE visibility
  - one simulated relay orbit, with relay-path evaluation
  - coverage and blackout metrics
  - direct-vs-relay comparison
  - a working Netlify deployment
- **P1 (Day 1, only if P0 is done):** a second south-pole site, another
  mission-date comparison, multiple relay configs, a better network view,
  and the **3D lander sky view** (F7, D-21): a three.js scene of the sky seen
  from the lander (terrain horizon, Sun, Earth, relay satellites, link
  state) driven only by the files in `public/data/`, plus a decorative 3D
  first-look hero (illustration, not to scale, no data).
- **P2 (excluded):**
  - inter-satellite routing, radio link budgets, orbit optimization
  - AI recommendations, a 3D globe or whole-Moon orbit view (the F7 lander
    sky view is P1, not this)
  - landing safety/flatness, geology or science ranking

The original challenge ask (Sun and Earth position relative to the local
horizon) is kept: sunlight and Earth elevation appear on every timeline.

---

## 3. Architecture: static-first on Netlify

Full diagrams: [docs/architecture.md](docs/architecture.md). Data shapes:
[docs/data-contracts.md](docs/data-contracts.md).

**The Python pipeline runs offline and writes JSON. The Next.js app is a
static export on Netlify. The browser does the interactive analysis.** No
running backend, so the deployed app works with no Python anywhere.

```
space-apps-2026/
├── CLAUDE.md                  # this file
├── README.md                  # what it is, how to run, limitations: the judges read this
├── package.json / bun.lock    # web app: bun only, never npm or yarn
├── next.config.ts             # output: "export" (static), required for Netlify static hosting
├── pyproject.toml / uv.lock   # data pipeline: uv only
├── .claude/skills/            # contribute, review
├── data/                      # Python package, each module runs as `uv run python -m data.<name>`
│   ├── horizons.py            #   Dev 2: Sun/Earth az/el per site; Moon-fixed Earth track
│   ├── lola.py, pgda.py       #   Dev 2: LOLA 120 m polar DEM, PGDA 5 m site DEMs
│   ├── trek.py                #   Dev 2: Moon Trek layers (sanity-check maps)
│   ├── terrain.py             #   Dev 2: 360° terrain horizon per site (to write)
│   ├── sites.py               #   Dev 2: site Sun/Earth series over the window (to write)
│   ├── geometry.py            #   Dev 2: Moon-fixed → topocentric az/el; relay–Earth occultation (to write)
│   ├── relays.csv             #   relay catalog with sources
│   ├── relays.py              #   Dev 1: Kepler propagation of relay configs (to write)
│   ├── precompute.py          #   Dev 1: joins everything → public/data/ (to write)
│   └── raw/                   #   downloads and caches (gitignored except READMEs)
├── public/data/               # committed JSON the app fetches: index.json, sites/, relays/
├── notebooks/                 # exploration and validation (not part of the build)
├── docs/                      # architecture, data-contracts, decisions, data-needs, problem-and-scope
├── tasks/BOARD.md             # the Day-1 / Day-2 plan
└── src/
    ├── app/page.tsx           #   Dev 3: the planner (site, dates, relay config, results)
    ├── components/            #   Dev 3: timelines, metric cards, network status, compare, ui/ (shadcn)
    └── lib/lunanav/           #   pure TypeScript, no React, no fetch
        ├── types.ts           #     Dev 1: the contract (from docs/data-contracts.md)
        ├── visibility.ts      #     Dev 2: terrain mask lookup, min-elevation mask, sunlit fraction
        ├── network.ts         #     Dev 1: complete paths, coverage, blackouts, window slicing
        └── data.ts            #     Dev 3: fetch /data/*.json and narrow to types
```

- **Stack (kept):** Next.js App Router, TypeScript strict, Tailwind, shadcn/ui,
  three.js via `@react-three/fiber` + `@react-three/drei` for the F7 sky view
  (client-only, loaded with `next/dynamic` and `ssr: false` so the static
  export still builds), bun, Netlify. Offline: Python 3.12+, uv, NumPy, SciPy, rasterio, JPL Horizons
  (SPICE only if Horizons can't give what we need), LOLA.
- **Where code goes:**
  - Slow, networked or raster/orbit work → Python in `data/`.
  - Interactive math (masks, path logic, metrics) → `src/lib/lunanav/`, pure functions.
  - `src/components/` and `src/app/` render. They never compute a number.
- **The contract is `src/lib/lunanav/types.ts`** (copied from
  docs/data-contracts.md at H0). `precompute.py` writes exactly those shapes.
  Change it only in a PR the other two have seen, updating both sides.
- **Boundaries:** `lib/lunanav/` imports nothing from React, Next, `fs` or the
  network (`data.ts` is the only fetcher). The app reads only `public/data/`.
  It never calls Horizons or reads `data/raw/`.
- **Supported window:** the app supports only the dates in
  `public/data/index.json → window`. Outside it, the UI shows "outside the
  supported data window" and no numbers.

---

## 4. Working together: git

- **Never commit to `main` directly. Never force-push.** `main` deploys to
  Netlify production and is the demo. It must run at every moment.
- **One branch per task: `<type>/<initials>/<slug>`**, `type` ∈ `feature | fix | chore`.
  Use `/contribute`: it handles the branch, draft PR and merge flow. Every PR
  gets a Netlify preview URL; check your change there.
- **One checkout per person.** Never `git checkout <ref> -- <path>` over someone
  else's uncommitted work.
- **Open a draft PR as soon as the branch exists.**
- **Pull `main` into your branch before review and again before merge.**
- **Review:** run `/review`, fix what holds up, then one teammate approves.
  Claude's review is not the approval.
- **Squash-merge, delete the branch.** A human merges, after a human approved.
- **Commit messages:** `type(area): what changed, in plain words`.
- **Owners** (per-person checklists in `tasks/PEOPLE.md`):
  - **Dev 1 — Satellite simulation & networking (Shaheen):** `data/relays.py`,
    `data/precompute.py`, `lib/lunanav/network.ts`, `lib/lunanav/types.ts`
  - **Dev 2 — NASA data & lunar geometry (Deep):** `data/horizons.py`, `lola.py`,
    `pgda.py`, `terrain.py`, `sites.py`, `geometry.py`, `lib/lunanav/visibility.ts`
  - **Dev 3 — Frontend & Netlify (Amisha):** `src/app/`, `src/components/`,
    `lib/lunanav/data.ts`, the Netlify project
- **Shared files** (`CLAUDE.md`, `README.md`, `bun.lock`, `uv.lock`,
  `lib/lunanav/types.ts`, `public/data/index.json`): tell the channel before editing.

### Claude-specific
- Before changing anything: `git status`, `git branch --show-current`,
  `git log --oneline -5`. On `main` → branch first.
- Never `git push --force`, `git reset --hard` on shared branches, `git stash pop`
  of a stash it didn't create, or a recursive delete from the repo root.
- Commit and push only when asked. Never merge a PR.

---

## 5. Data and science rules (what the judges will test us on)

A violated data rule produces a wrong answer that looks right.

- **Never invent a number.** Every coverage %, blackout and elevation on screen
  is computed from files in `public/data/`. Placeholder files say
  `"placeholder": true` and the UI shows a **PLACEHOLDER DATA** banner. They are
  deleted before the Day-1 freeze.
- **No hard-coded results.** No coverage percentage, blackout duration or
  "connected" flag may be written by hand in TypeScript or JSON.
- **Geometric visibility ≠ guaranteed link.** Every metric is labeled
  "geometric line-of-sight". We model no link budget, no DSN scheduling and no
  interference. Never say a site "has communication". Say "has a clear line of
  sight to Earth / a relay".
- **The 3D sky view draws data, it does not invent it.** Every body's
  direction comes from `azimuthDeg`/`elevationDeg` in the files; the horizon
  ring is `horizon.elevationDeg`; link colour comes from `network.ts`.
  Scene scale is for legibility, so label it "not to scale". Starfield and
  textures are decoration and are marked as such; any texture needs a
  recorded licence. Show the same table of numbers beside the scene.
- **Relays are simulated reference configurations,** not operational
  constellations. Each config names what it's based on (e.g. Queqiao-2's
  published elements, NASA LCRNS studies) and its assumptions (two-body, assumed
  argp/RAAN). LCRNS is a reference, never presented as deployed.
- **A sample is connected only via a complete path.** The lander seeing a relay
  that can't see Earth is not connected.
- **Every result carries its source and uncertainty.** Unknown uncertainty is
  shown as "unknown", never omitted.
- **Units in names:** `elevationDeg`, `rangeKm`, `heightM`, `stepSeconds`.
  Azimuth from north, clockwise.
- **Time is UTC** in files and code; convert for display only. Horizons time
  scales are converted once, in `data/horizons.py`.
- **Coordinates:** planetocentric, east-positive longitude, Moon body-fixed.
  The frame is stated in `index.json`.
- **Outside the supported window, show a limitation, not a result.**
- **Raw data is gitignored. `public/data/` is committed and small:** < 2 MB per
  file, < 10 MB total.
- **Cache every external call** in `data/raw/`, keyed by the exact query.
- **Honest pitch:** specialists can do this analysis by hand; we make it one
  fast workflow. Never claim NASA lacks the data or capability.

---

## 6. Code conventions

- TypeScript strict; no `any`. Names carry units and frames.
- `bun run lint` before committing a TS change. Python: keep `ruff` clean if
  it's installed.
- Components render, never compute. Every chart also has a small table of the
  same numbers (projectors wash out colour; judges read numbers).
- No secrets in the repo. Horizons is open. Any key goes in `.env.local` (gitignored).
- Comments say why. A known shortcut is marked
  `// shortcut: <limit>, <when to upgrade>` (Python: `# shortcut:`) so the
  pitch can be honest about it.
- US English in UI text and identifiers.

---

## 7. How to verify a change

```bash
uv sync                                  # once per clone (data pipeline)
uv run python -m data.<module>           # e.g. horizons, lola, terrain, relays (network once, then cached)
uv run python -m data.precompute         # → public/data/ (validates shapes before writing)
bun install                              # once per clone (web app)
bun run build                            # THE gate: type-check + static export
bun run lint
bun run dev                              # http://localhost:3000
```

No automated test suite. A data change is checked by running its module and
looking at the output (a notebook is fine). **A green build is not done:** open
the app on the **Netlify preview URL**, pick the site and a date, toggle the
relay, and read the numbers. If a number can't be traced to a file in
`public/data/` and from there to a source, the task isn't finished.

---

## 8. Two-day schedule rules

### Day 1: build everything (H0–H12)
- **H0–H1:** owners, MVP freeze, contracts (`types.ts`), site and window
  decisions, empty app deployed on Netlify.
- **H5–H7: first end-to-end on Netlify** (one site, one window, one relay,
  computed DTE + relay timelines).
- **H11–H12: Day-1 feature freeze.** Working app on Netlify, README and method
  documented, fallback demo video recorded.
- **Day-1 exit condition:** anyone can open the deployed URL, pick a supported
  site and date, and compare direct vs relay-assisted communication using
  computed results. **If this isn't met, Day 2 morning is spent only on
  meeting it.**

### Day 2: touch-ups only
- **Allowed:**
  - UI polish, minor bug fixes, result sanity checks, mobile layout
  - README, presentation, demo video
  - submission and final deployment check
- **Not allowed without a team decision recorded in `docs/decisions.md`:**
  - new architecture or backend services
  - new scientific modules or major refactors
  - new third-party infrastructure or complex features
- **Final submission freeze** 3 hours before the deadline: after it, only
  submission work and a redeploy if production breaks.

### Decisions
- **Decisions go in `docs/decisions.md`:** one line each, dated, who agreed.
  Claude reads it before proposing to change any decision.
- **When Claudes disagree,** the code on `main` wins. Discuss, record the
  outcome in `docs/decisions.md`, then change the code.

---

## 9. Pointers

- Plan: `tasks/BOARD.md` · Architecture: `docs/architecture.md` · Contracts: `docs/data-contracts.md`
- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- LOLA GDR: https://imbrium.mit.edu/DATA/LOLA_GDR/ · PGDA 5 m DEMs: https://pgda.gsfc.nasa.gov/products/78
- NASA LCRNS (Lunar Communications Relay and Navigation Systems): a reference design only. Add the exact source link in `docs/decisions.md` when a config cites it
- Next.js static exports (`output: "export"`): see the Next.js docs, "Static Exports"
