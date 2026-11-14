---
name: review
description: Use before marking a LunaNav PR ready, or when asked to review a branch or PR number — runs the build and lint gates, then an independent adversarial read of the diff against CLAUDE.md's rules (data rules first), and reports findings with file:line and the smallest fix.
---

# Review

One review round per PR, then fix what it finds in the same PR. The gates
run first so the reader sees a clean diff. This build has no automated tests
(team decision) — don't ask for them.

## Step 1: Gates (never skip)

```bash
git fetch origin main
git diff --stat $(git merge-base HEAD origin/main)..HEAD    # what this branch changes
bun run build        # the compile gate
bun run lint
```

Report each as pass/fail with the one line that matters. A failing gate ends
the review: fix it first.

## Step 2: Read the diff like a hostile judge

Read the full diff (`git diff <merge-base>..HEAD`), then the files it touches
in full where the change is more than a few lines. Check, in this order:

**Data and science (CLAUDE.md §5) — a wrong number that looks right is the
worst bug we can ship:**
- Any coverage %, blackout duration or "connected" flag written by hand in TS
  or JSON instead of computed? Any placeholder file without
  `"placeholder": true`, or without the PLACEHOLDER DATA banner?
- Wording that turns geometry into a promise ("has communication",
  "guaranteed link")? Must say "geometric line-of-sight". A simulated relay
  presented as an operating satellite, or LCRNS presented as deployed?
- Does every result carry source and uncertainty? Is uncertainty ever omitted
  rather than "unknown"?
- Units: degrees/radians, m/km, elevation/altitude, TDB/UTC — mixed anywhere?
  Does the name say its unit? Azimuth from north, clockwise?
- Coordinate frame stated? Planetocentric vs planetographic, east vs west
  longitude mixed?
- External calls cached in `data/raw/`? Does the app read only `public/data/`?
- Anything under `data/raw/` committed? A `public/data/` file over 2 MB?

**Architecture (CLAUDE.md §3):**
- Anything that breaks the static export on Vercel: an API route, server
  action, `fs` in app code, dynamic route without static params?
- The app (`src/app`, `src/components`) calling Horizons or reading `data/raw/`?
- A component computing a number instead of formatting one? Move the math to
  `src/lib/lunanav/`.
- `src/lib/lunanav/` importing React, Next, `fs`, or doing network calls?
- `data/precompute.py` output that doesn't match `src/lib/lunanav/types.ts`?
  (One drift = a silent `undefined` in the UI.)
- A connector that hits the network without caching in `data/raw/`?
- `types.ts` changed without the other lanes knowing?

**Correctness:**
- Off-by-one on date ranges; inclusive/exclusive window and blackout ends.
- A date range outside `index.json → window` returns results instead of the
  "outside supported window" limitation?
- Horizon mask: azimuth wrap at 360°, elevation sign, interpolation between
  profile samples, Sun treated as a disk not a point.
- Complete path: counted connected when the lander sees a relay that can't see
  Earth? Min elevation mask applied to both DTE and lander→relay?
- Relay–Earth occultation uses the Moon radius 1737.4 km and the Moon-fixed
  Earth direction for the same sample?
- Blackouts spanning the slice start/end handled (not dropped, not merged wrongly)?
- Missing data handled visibly ("not available"), not as 0.

**Simplicity and scope (CLAUDE.md §1, §2):**
- Anything built that no P0/P1 item asked for (P2: landing safety, geology,
  link budgets, inter-satellite routing, 3D)? Name it; propose deleting it.
- On Day 2: anything beyond a touch-up (CLAUDE.md §8)? Flag it.
- A single-use abstraction, a config nobody set, "for later" code?
- A test suite, Docker, a backend or a database added? Out of scope — flag it.
- Changes to lines the task did not need?

## Step 3: Report

Findings only when confident, each as:

`<severity> · <file>:<line> — <what is wrong> → <why it matters> → <smallest fix>`

Severity: `critical` (wrong number / data loss / main breaks), `high`
(wrong behaviour a user hits), `medium`, `low`. Most severe first. Then one
short list of what you checked and found fine, so the reader knows the
coverage. Under 600 words.

Fix every finding that holds up, in this PR, before `gh pr ready`. Answer a
finding you judge wrong with your reasoning rather than ignoring it. Recheck
each fix (fixes overcorrect). Ask before a second review round.
