---
name: contribute
description: Use when starting any feature, fix or change to LunaNav — creates the branch, opens a draft PR, and walks the change through build, review and a human-approved squash merge. Three people share this repo; this skill is what keeps main runnable.
---

# Contribute

The branch → draft PR → commit → review → merge lifecycle. Nobody pushes to
`main`. `main` is the demo.

## Step 1: Where am I?

Run `git status`, `git branch --show-current`, `git log --oneline -5`.

- On `main` → continue to Step 2.
- Already on a `<type>/<initials>/<slug>` branch → ask: "Continue on
  `<branch>`, or start a new one?" If continuing, skip to Step 6.
- Uncommitted work from someone else in this checkout → stop. One checkout
  per person; ask whose it is.

## Step 2: What kind of change?

From the arguments, or ask:
1. **Type**: `feature` (new capability), `fix` (something wrong → right), `chore` (docs, config, deps).
2. **Slug**: short kebab-case, e.g. `horizon-mask`, `slope-units`.
3. **Initials**: two or three lowercase letters.

Branch name: `<type>/<initials>/<slug>`.

## Step 3: One line of usability

Ask: "In one line, what can a user do on LunaNav after this that they
couldn't before?" For a `fix`: what was wrong → what now works. This line
goes in the PR body. If the answer is only code-level ("refactored the tile
loader"), ask once more for the user-facing effect.

## Step 4: Which of the three does it serve?

Every change names which MVP area it advances (CLAUDE.md §2) and whether it is P0 or P1:
1. Lunar geometry & terrain: Sun/Earth ephemeris, terrain horizon, DTE visibility (Dev 2)
2. Relay simulation & networking: orbits, complete paths, coverage, blackouts (Dev 1)
3. Mission planning frontend & Netlify: controls, timelines, comparison, deployment (Dev 3)

Or `infra` (repo, tooling, demo). A P2 change (landing safety, geology,
link budgets, inter-satellite routing, 3D) is out of scope — say so and stop
unless the team agreed in `docs/decisions.md`. On Day 2 (CLAUDE.md §8), only
touch-ups are in scope: say so and stop for anything bigger.

## Step 5: Branch, seed commit, draft PR

```bash
git checkout main
git pull origin main
git checkout -b <type>/<initials>/<slug>
git commit --allow-empty -m "chore: open PR for <slug>"
git push -u origin <type>/<initials>/<slug>
gh pr create --draft --base main --title "<type>: <slug in words>" --body "$(cat <<'EOF'
## Serves

<area 1 / 2 / 3 / infra> · <P0 / P1> · board task <ID>

## What a user can now do

- <the one line from Step 3>

## Summary

- <what changes, in plain words>

## Checked

- [ ] `bun run build` clean
- [ ] `bun run lint` clean
- [ ] Data change: ran the module and looked at the output
- [ ] Used it on the Netlify preview URL: picked the site and a date, toggled the relay, read the numbers
- [ ] Every number shown traces to a file in public/data/ and a source (CLAUDE.md §5)
EOF
)"
```

Tell the user: "Draft PR open. Push commits as you go; they show on the PR.
Say 'ready' when it's time for review."

## Step 6: Reuse before building

Before new code, search `src/lib/lunanav/`, `data/*.py`, `notebooks/` and `src/components/`
for what already does — or half does — this. Extend it; never add a second
copy. If a genuinely new module is unavoidable, say so before writing it.

Shared files (`CLAUDE.md`, `README.md`, `bun.lock`, `uv.lock`,
`src/lib/lunanav/types.ts`, `public/data/index.json`): tell the channel before
editing — these are where three people collide.

## Step 7: Build it (CLAUDE.md §1, §3, §5, §6)

- Slow, networked, raster or orbit work in Python modules in `data/` (uv);
  masks, path logic and metrics in `src/lib/lunanav/`; components render only.
  The app only reads `public/data/`. It never calls Horizons.
- `data/precompute.py` output matches `src/lib/lunanav/types.ts` exactly.
- A data change: run its module and look at the output. An app change: build
  and use it on the Netlify preview.
- Every number carries its source and uncertainty. No hard-coded coverage or
  blackout values. "Geometric line-of-sight", never "guaranteed link".
- Units and frames in names. UTC in files.
- No automated test suite, no Docker, no backend except the optional point server (D-25) (team decision).

## Step 8: Commit and push on request

```bash
git add <files you changed>        # never `git add -A` from the root
git commit -m "<type>(<area>): <what changed, plain words>"
git push
```

Commit only when asked. Push only when asked. Never force-push.

## Step 9: Ready for review

When the user says ready:
1. `git fetch origin main && git merge origin/main`; resolve conflicts on the
   branch; `bun run build && bun run lint`.
2. Run `/review`. Fix every finding that holds up, in this PR. Push.
3. Fill the PR's "Checked" list with what actually ran — tick only what you saw pass.
4. `gh pr ready <n>`; tell the user: "Ready. Ask <teammate> to review."

## Step 10: Merge — human-gated, every time

Only after a teammate approved (`gh pr view --json reviewDecision`). Then:

```bash
git fetch origin main && git merge origin/main     # again, even if GitHub says clean
bun run build
```

Show the user the PR title, URL, who approved, and the check status. Ask
exactly: **"Ready to merge?"** Stop. Only on an explicit yes:

```bash
gh pr merge <n> --squash --delete-branch
git checkout main && git pull origin main
```

Then `git branch -D <branch>` locally. Never merge without the yes; approval
and the user's go-ahead are two different things.

## Rules

- Never commit to `main`. Never force-push. Never merge your own PR without a
  teammate's approval and the user's explicit yes.
- Always squash. Always delete the branch after merge.
- Pull `main` before review and again before merge.
- Open the draft PR immediately — visible work prevents duplicate work.
- A finding from review is fixed in the same PR, never filed for later.
- Freeze two hours before the deadline: fixes, README and pitch only.
