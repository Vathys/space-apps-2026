# data/

The Python data pipeline (uv) and its outputs. Setup: `uv sync`.

| Path | Committed? | What |
|---|---|---|
| `<name>.py` | Yes | Connectors and build steps, each run with `uv run python -m data.<name>` |
| `raw/` | No (gitignored, except READMEs) | Downloads and caches from the connectors |
| `sites.json` | Yes | Curated site list: id, name, lat, lon, frame, category, source URL (task S2) |
| `precomputed/<site-id>.json` | Yes, < 1 MB each | Output of `uv run python -m data.precompute`. **The only data the web app reads** |

The shapes of `sites.json` and `precomputed/*.json` are defined in `src/lib/lunanav/types.ts`.
Every value carries its source and uncertainty (CLAUDE.md §5).

## Connectors

Each connector re-creates its dump with `uv run python -m data.<name>`.

| Connector | Source | Dump |
|---|---|---|
| [horizons.py](horizons.py) | [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html): Sun/Earth az, el, range from a lunar site | [raw/horizons/](raw/horizons/) |
| [trek.py](trek.py) | [Moon Trek](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon): layer catalog, WMTS tiles stitched to GeoTIFF, raw product files | [raw/trek/](raw/trek/) |
| [pgda.py](pgda.py) | [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78): 5 m/px LOLA DEMs for south-pole sites | [raw/pgda/](raw/pgda/) |

## Build steps (to write)

| Module | Lane | Task | Output |
|---|---|---|---|
| `terrain.py` | B | B2–B4 | Horizon profile, slope/flat-patch indicators, hazard flags per site |
| `precompute.py` | C | C4 | Joins Horizons + terrain + science → `precomputed/<site-id>.json` |

Exploration of each dump: [notebooks/](../notebooks/).
