# data/

The Python data pipeline (uv) and its outputs. Setup: `uv sync`.

| Path | Committed? | What |
|---|---|---|
| `<name>.py` | Yes | Connectors and build steps, each run with `uv run python -m data.<name>` |
| `raw/` | No (gitignored, except READMEs) | Downloads and caches from the connectors |
| `../public/data/` | Yes, < 2 MB per file | Output of `uv run python -m data.precompute`. **The only data the web app reads** (D-12) |

Output shapes: [docs/data-contracts.md](../docs/data-contracts.md) (→ `src/lib/lunanav/types.ts`).
Every value carries its source and uncertainty (CLAUDE.md §5).

## Connectors

Each connector re-creates its dump with `uv run python -m data.<name>`.

| Connector | Source | Dump |
|---|---|---|
| [horizons.py](horizons.py) | [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html): Sun/Earth az, el, range from a lunar site; Moon-fixed tracks of Earth and lunar orbiters | [raw/horizons/](raw/horizons/) |
| [lola.py](lola.py) | [PDS LOLA GDR](https://imbrium.mit.edu/DATA/LOLA_GDR/): south-polar 120 m and global 16 ppd DEMs for horizon masks | [raw/lola/](raw/lola/) |
| [relays.csv](relays.csv) | Hand-curated lunar relay fleet (status, orbital elements, sources). Queqiao-2 has no public ephemeris | (committed) |
| [trek.py](trek.py) | [Moon Trek](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon): layer catalog, WMTS tiles stitched to GeoTIFF, raw product files | [raw/trek/](raw/trek/) |
| [pgda.py](pgda.py) | [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78): 5 m/px LOLA DEMs for south-pole sites | [raw/pgda/](raw/pgda/) |

## Build steps (to write)

| Module | Owner | Task | Output |
|---|---|---|---|
| `sites.py` | Dev 2 | G1 | Sun + Earth az/el (+ Earth range) per site over the supported window |
| [terrain.py](terrain.py) ✅ | Dev 2 | G2 | 360° terrain horizon per site (PGDA 5 m near field + LOLA 120 m far field, curvature) → [raw/terrain/](raw/terrain/)`<site>_horizon.json`, the contract's `horizon` block |
| `geometry.py` | Dev 2 | G3 | Moon-fixed → topocentric az/el/range; relay–Earth occultation |
| `relays.py` | Dev 1 | N1 | Two-body propagation of relay configs → Moon-fixed positions |
| `precompute.py` | Dev 1 | N4 | Joins all of the above → `public/data/` (index, sites, relays), shape- and size-checked |

Exploration of each dump: [notebooks/](../notebooks/).
