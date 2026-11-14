# data/raw/trek/

[NASA Moon Trek](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon) layers.

- `catalog_{eq,np,sp}.json`: the full layer catalog for each projection
- `sp/*.tif`: RGBA GeoTIFFs stitched from WMTS tiles, in south polar stereographic projection. These are 8-bit display renderings, not science values.
- `raw_files/`: original product files with true values, from `data.trek.download_raw(productLabel)`

Re-download: `uv run python -m data.trek`.
