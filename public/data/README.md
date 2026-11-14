# public/data/

JSON the web app fetches at runtime, served as static files by Netlify's CDN. Written by
`uv run python -m data.precompute` (Dev 1, task N4). **Don't edit by hand.** Shapes:
[docs/data-contracts.md](../../docs/data-contracts.md).

| Path | Contents |
|---|---|
| `index.json` | Supported time window, frame, site list, relay configs, defaults |
| `sites/<siteId>.json` | Terrain horizon profile, Sun and Earth az/el series, provenance, uncertainty |
| `relays/<siteId>/<configId>.json` | Per-satellite az/el/range from the site + `seesEarth` series |
| `placeholder/` | Dev-only sample files marked `"placeholder": true`; deleted before the Day-1 freeze (task I3) |

Budget: < 2 MB per file, < 10 MB total.
