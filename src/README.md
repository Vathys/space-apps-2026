# src/

Static Next.js app (`output: "export"`), deployed on Netlify. Created by task S4. See CLAUDE.md §3.

| Path | Owner | What |
|---|---|---|
| `app/page.tsx` | Dev 3 | The planner: site, dates, relay config, results, comparison |
| `components/` | Dev 3 | Timelines, metric cards, network status, scenario compare, `ui/` (shadcn). Render only |
| `lib/lunanav/types.ts` | Dev 1 | The data contract (from docs/data-contracts.md, task S3) |
| `lib/lunanav/data.ts` | Dev 3 | Fetches `/data/*.json`, narrows to types. The only fetcher |
| `lib/lunanav/visibility.ts` | Dev 2 | Terrain mask lookup, min-elevation mask, Sun-disk sunlit fraction |
| `lib/lunanav/network.ts` | Dev 1 | Complete-path logic, coverage %, blackout intervals, window slicing |
