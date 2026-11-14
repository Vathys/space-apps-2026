# data/

Raw downloads (raw/, git-ignored except READMEs and sites.csv) and derived products (processed/).
Every dataset gets a line in its folder README: source URL, date downloaded, resolution, citation.

**Owner:** TBD

## Connectors

Python setup: `uv sync`. Each connector re-creates its dump with `uv run python -m data.<name>`.

| Connector | Source | Dump |
|---|---|---|
| [horizons.py](horizons.py) | [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html): Sun/Earth az, el, range from a lunar site | [raw/horizons/](raw/horizons/) |
| [trek.py](trek.py) | [Moon Trek](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon): layer catalog, WMTS tiles stitched to GeoTIFF, raw product files | [raw/trek/](raw/trek/) |
| [pgda.py](pgda.py) | [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78): 5 m/px LOLA DEMs for south-pole sites | [raw/pgda/](raw/pgda/) |

Exploration of each dump: [notebooks/](../notebooks/).
