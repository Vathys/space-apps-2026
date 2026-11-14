# data/

| Path | Committed? | What |
|---|---|---|
| `raw/` | No (gitignored) | Downloads and caches: Horizons responses, LOLA tiles, USGS extracts. Rebuilt by `scripts/` |
| `sites.json` | Yes | Curated site list: id, name, lat, lon, frame, category, source URL (task S2) |
| `precomputed/<site-id>.json` | Yes, < 1 MB each | Output of `bun run precompute`. **The only data the app reads** |

The shapes of `sites.json` and `precomputed/*.json` are defined in `src/lib/lunanav/types.ts`.
Every value carries its source and uncertainty (CLAUDE.md §5).
