# public/data/

JSON the web app fetches at runtime, served as static files by Cloudflare Pages' CDN. Written by
`uv run python -m data.precompute` (Dev 1, task N4). **Don't edit by hand.** Shapes:
[docs/data-contracts.md](../../docs/data-contracts.md).

| Path | Contents |
|---|---|
| `index.json` | Supported time window, frame, site list, relay configs, defaults |
| `sites/<siteId>.json` | Terrain horizon profile, Sun and Earth az/el series, provenance, uncertainty |
| `relays/<siteId>/<configId>.json` | Per-satellite az/el/range from the site + `seesEarth` series |

Budget: < 2 MB per file, < 30 MB total (D-26). With 11 sites × 3 relay configs it is about 27 MB.
