# data/raw/pgda/

High-resolution LOLA topography for lunar south pole sites: [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78) ([README](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README)).
5 m/px GeoTIFFs (height, slope, height/slope RMS error, shot count) plus the xyzi point cloud and ROI shapefiles. South polar stereographic, sphere R = 1737.4 km, MOON_ME (DE421).

Re-download: `uv run python -m data.pgda` (Site01 Connecting Ridge and Site04 Shackleton Rim, ~375 MB). Other sites and products: `data.pgda.download(site, product)`.

Citation: Barker et al. (2021), *Planetary & Space Science* 203, 105119, https://doi.org/10.1016/j.pss.2020.105119
