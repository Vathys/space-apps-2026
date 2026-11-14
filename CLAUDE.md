# CLAUDE.md — LunaNav

Shared rules for the three of us and our three Claudes. Everything here is a
team decision: change it in a PR, never in your own copy, so all three Claudes
read the same rules.

> The LLM-wiki CLAUDE.md on the Desktop (parent folder) does **not** apply to
> this repo. Ignore its wiki/ingest/log instructions here.

**Tradeoff:** we have **one day**. These rules bias toward shipping a working,
honest demo. Use judgment on anything trivial — but never on the data rules
(§5) or the git rules (§4).

**Not in this build (team decision):** automated tests, Docker, a separate
backend, a database. Don't add them. Verification is the build, lint, and
using the app (§7).

---

## 1. How Claude works here

- **Think before coding.** State assumptions. If the task has more than one
  reading, say so; don't pick silently. If a simpler approach exists, say so.
- **Simplicity first.** Minimum code that solves the problem. No "for later",
  no single-use abstractions, no configurability nobody asked for.
- **Surgical changes.** Touch only what the task needs. Match existing style.
  Every changed line traces to the task.
- **Checkable goals.** Turn each task into something you can see working:
  "horizon mask" → "a site with a 7° ridge east shows the Sun as blocked at 3°
  elevation in the timeline". State multi-step plans as `step → how I'll check it`.
- **Honesty about results.** Say what actually ran and what you actually saw.
  If a step was skipped or partial, say so. Never present a placeholder as a
  computed number (§5).

---

## 2. What LunaNav is

**NASA Space Apps Challenge 2026 — "Lunar Landing Site Navigator".**

A web app that compares candidate lunar landing **sites and dates** on three
axes: *when* can we operate (terrain-aware Sun and Earth visibility), *where*
can we land (preliminary landing suitability), and *why* go there (science and
mission history). The data exists in three places; we combine it into one
site-date comparison.

| Source | Answers | What LunaNav adds |
|---|---|---|
| **JPL Horizons** | Sun/Earth az/el from a lunar location at time T | Local terrain horizon blocking Sun/Earth → power and comm windows |
| **NASA LOLA / LROC** | Elevation, slope, roughness; imagery | Flat-patch / landing-ellipse indicators with flagged hazards |
| **NASA / USGS** | Geologic units (USGS Unified Geologic Map 1:5M), mission history, resources | A per-site, source-linked science card |

**Target user:** early-stage lunar mission planners. **Scope:** we *enable* a
decision; we never output "land here".

**Worked example we design against:** a university team compares Site A (good
geology, hazardous terrain) and Site B (flat, long Earth-comm blackouts). The
launch slips two weeks. Which site is now better, and why?

**Pitch in one sentence:** we don't replace Horizons, LOLA, LROC or USGS; we're
an accessible decision layer on top of them. Specialists can do each analysis
by hand — we do them together, fast, with every number traced to its source.

### Build priorities (do not start #3 before #1 works)
1. **Terrain-aware Sun/Earth visibility** — the challenge's central ask.
2. **Preliminary landing suitability** — "preliminary", never "safe".
3. **Side-by-side comparison with science context.**

Anything else is out of scope unless the three of us agree and write it in
`docs/decisions.md`.

---

## 3. Architecture (one-day version)

**Precompute offline, serve static JSON.** Everything slow (Horizons calls,
DEM processing) runs once in `scripts/` and writes small JSON files that are
committed. The web app is a static Next.js site that only reads those files.
No API routes, no server, no database — so the demo works offline and deploys
anywhere static.

```
space-apps-2026/
├── CLAUDE.md                  # this file
├── README.md                  # how to run; the judges read this
├── package.json / bun.lock    # bun only — never npm or yarn
├── .claude/skills/            # contribute, review
├── data/
│   ├── raw/                   # downloads: Horizons responses, LOLA tiles (gitignored)
│   ├── sites.json             # curated site list (committed)
│   └── precomputed/           # <site-id>.json — the ONLY data the app reads (committed, small)
├── docs/                      # decisions.md, data-needs.md, problem-and-scope.md, pitch.md
├── scripts/                   # bun scripts, run before the demo (bun run precompute)
│   ├── fetch-horizons.ts      #   Sun/Earth az/el per site over the mission window, cached in data/raw/
│   ├── build-terrain.ts       #   LOLA → horizon profile, slope, flat patches, hazard flags
│   └── build-sites.ts         #   joins ephemeris + terrain + science → data/precomputed/<site-id>.json
├── src/
│   ├── app/
│   │   ├── page.tsx           #   pick two site-date scenarios
│   │   └── compare/page.tsx   #   the side-by-side screen (?a=site,date&b=site,date)
│   ├── components/            #   sky-chart, timeline, metrics-table, site-card, ui/ (shadcn)
│   └── lib/lunanav/           #   pure TypeScript, no React
│       ├── types.ts           #     shape of sites.json and precomputed JSON — the contract
│       ├── visibility.ts      #     ephemeris + horizon → windows & metrics (runs in the browser,
│       │                      #     so the "launch slips two weeks" re-run is instant)
│       ├── compare.ts         #     two scenarios → comparison rows
│       └── units.ts           #     deg/rad, time helpers
```

- **Stack:** Next.js (App Router, TypeScript strict, static export), React,
  Tailwind, shadcn/ui. Package manager **bun**. Deploy: Vercel (or any static
  host). Port `3000` locally.
- **Where code goes:**
  - Heavy or networked work → `scripts/`. Never in the app.
  - Math the UI needs live (date-shift re-evaluation, comparison) → `src/lib/lunanav/`, pure functions.
  - `src/components/` and `src/app/` render. They never compute a number themselves.
- **The contract is `src/lib/lunanav/types.ts`.** Scripts write JSON in that
  shape; the app reads it in that shape. Change it only in a PR the other two
  have seen.
- **Boundaries:** `lib/lunanav/` imports nothing from React, Next, `fs`, or the
  network. Scripts may import `lib/lunanav/` (types, units, visibility). The app
  never imports from `scripts/` and never calls Horizons/USGS directly.
- **Shortcut allowed:** if a terrain step is much faster to write in Python,
  it may live in `scripts/` as long as its output matches `types.ts`. Record it
  in `docs/decisions.md`.

---

## 4. Working together — git

- **Never commit to `main` directly. Never force-push.** `main` is the demo and
  must run at every moment.
- **One branch per task: `<type>/<initials>/<slug>`**, `type` ∈ `feature | fix | chore`.
  Use the `/contribute` skill — it does the branch, draft PR and merge flow.
- **One checkout per person.** Never `git checkout <ref> -- <path>` over someone
  else's uncommitted work.
- **Open a draft PR as soon as the branch exists.** Visible work prevents
  duplicate work.
- **Pull `main` into your branch before review and again before merge.**
- **Review:** run `/review`, fix what holds up, then one teammate approves.
  Claude's review is not the approval.
- **Squash-merge, delete the branch.** A human merges, after a human approved.
- **Commit messages:** `type(area): what changed, in plain words`.
- **Owners (fill in at H0):**
  - Lane A — `scripts/fetch-horizons.ts` + `lib/lunanav/visibility.ts` — `<name>`
  - Lane B — `scripts/build-terrain.ts` + suitability — `<name>`
  - Lane C — science, `build-sites.ts`, the app/UI — `<name>`
- **Shared files** (`CLAUDE.md`, `README.md`, `bun.lock`, `lib/lunanav/types.ts`,
  `data/sites.json`): tell the channel before editing.

### Claude-specific
- Before changing anything: `git status`, `git branch --show-current`,
  `git log --oneline -5`. On `main` → branch first.
- Never `git push --force`, `git reset --hard` on shared branches, `git stash pop`
  of a stash it didn't create, or a recursive delete from the repo root.
- Commit and push only when asked. Never merge a PR.

---

## 5. Data and science rules (what the judges will test us on)

A violated data rule produces a wrong answer that looks right.

- **Never invent a number.** Every figure on screen is computed from a named
  source, or labelled "not available". If the demo uses sample data, the UI
  says "demo data".
- **Every result carries its source and uncertainty.** A visibility window names
  the Horizons query and LOLA product; a slope names the DEM resolution; a
  science claim links its USGS unit or NASA reference. Unknown uncertainty is
  shown as "unknown", never omitted.
- **"Preliminary", never "safe".** The word "safe" doesn't appear in the UI or
  code. Suitability lists unresolved hazards (boulders below imagery resolution,
  DEM gaps, shadowed/PSR areas).
- **Units explicit in names:** `sunElevationDeg`, `horizonProfileDeg`,
  `distanceKm`. Degrees vs radians and metres vs km are the bugs we'll ship
  otherwise.
- **Time is UTC** in files and code; convert for display only. If Horizons
  returns TDB/TT, convert once in `fetch-horizons.ts`.
- **Coordinates state their frame** (selenographic, planetocentric vs
  planetographic) in `types.ts`.
- **Raw data is gitignored; precomputed JSON is committed** and kept small
  (aim < 1 MB per site; downsample the time step if needed).
- **Cache every external call** in `data/raw/`, keyed by the exact query.
- **Honest pitch:** "specialists can already do this by hand; we make it one
  workflow". Never claim NASA lacks the data.

---

## 6. Code conventions

- TypeScript strict; no `any`. Names carry units and frames.
- `bun run lint` before committing. Don't restate style in reviews — run the tool.
- Components render, never compute. Every chart also gets a small table of the
  same numbers (projectors wash out colour; judges read numbers).
- No secrets in the repo. Horizons and USGS are open; any key goes in
  `.env.local` (gitignored).
- Comments say why. A known shortcut is marked
  `// shortcut: <limit>, <when to upgrade>` so the pitch can be honest about it.
- US English in UI text and identifiers.

---

## 7. How to verify a change

```bash
bun install            # once per clone
bun run precompute     # scripts → data/precomputed/ (needs network the first time, then uses the cache)
bun run build          # THE gate: type-check + static build
bun run lint
bun run dev            # http://localhost:3000
```

No automated tests in this build. **Green build is not done:** open `/compare`
with two sites on two dates and read the numbers. If a number can't be traced
to a source, the task isn't finished. Check UI changes in the browser.

---

## 8. One-day rules

- **`main` is the demo.** Merge only what runs end to end.
- **Deploy the empty app in the first hour** so deployment isn't a surprise.
- **Record a fallback demo video as soon as /compare shows real numbers.**
- **Freeze two hours before the deadline:** README, pitch, video, bug fixes only.
- **Decisions go in `docs/decisions.md`** — one line each, dated, who agreed.
  Claude reads it before proposing to change any decision.
- **When Claudes disagree,** the code on `main` wins; discuss, record the
  outcome in `docs/decisions.md`, then change the code.

---

## 9. Pointers

- Task board: `tasks/BOARD.md`
- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- LOLA (PDS Geosciences): https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- LROC: https://www.lroc.asu.edu/
- USGS Unified Geologic Map of the Moon: https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020
