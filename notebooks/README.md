# notebooks/

Exploration and validation notebooks (e.g. first Horizons query, horizon-profile sanity checks).

**Owner:** TBD

| Notebook | Data | Covers |
|---|---|---|
| [01_horizons_exploration](01_horizons_exploration.ipynb) | data/raw/horizons | Ephemeris sanity checks, lunar day, rise/set windows, libration, time-to-sunset, Sun+Earth overlap (smooth horizon) |
| [02_trek_exploration](02_trek_exploration.ipynb) | data/raw/trek | Layer catalog, south-pole mosaics, tile value → physical value, which Trek layers to use as basemap |
| [03_pgda_exploration](03_pgda_exploration.ipynb) | data/raw/pgda | DEM quality and slope, terrain horizon profiles, terrain vs smooth-horizon sunlight/Earth visibility |
| [06_terrain_horizon](06_terrain_horizon.ipynb) | data/raw/pgda, data/raw/lola | G2 check: `data/terrain.py` horizon for site01, near vs far field, Malapert direction, LOLA vs PGDA height agreement |
| [07_science_sanity_check](07_science_sanity_check.ipynb) | public/data/sites, data/raw/trek/raw_files, data/raw/horizons, data/raw/lola | V2: DTE % vs Mazarico's Earth-visibility map, Earth elevation vs libration, horizon vs Shackleton, 150 m frame sensitivity (results in docs/decisions.md D-27) |

Run them from the repo root after the dumps exist: `uv run jupyter nbconvert --to notebook --execute --inplace notebooks/<name>.ipynb`.

- [x] V2 Science sanity check: Earth elevation vs libration, DTE % vs Moon Trek map, horizon vs known terrain
