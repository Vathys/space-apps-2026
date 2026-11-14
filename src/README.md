# src/

Static Next.js app. Created by task S4 (`bun create next-app`). See CLAUDE.md §3.

| Path | What |
|---|---|
| `app/page.tsx` | Pick two site-date scenarios (C2) |
| `app/compare/page.tsx` | Side-by-side comparison (C3, C5) |
| `components/` | sky-chart, timeline, metrics-table, site-card, `ui/` (shadcn). Render only |
| `lib/lunanav/types.ts` | The data contract shared with `scripts/` (S3) |
| `lib/lunanav/visibility.ts` | Ephemeris + horizon → windows & metrics; date shift (A3, A4) |
| `lib/lunanav/compare.ts` | Two scenarios → comparison rows (C5) |
| `lib/lunanav/units.ts` | deg/rad and time helpers |
