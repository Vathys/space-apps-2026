# notebooks/

Exploration and validation notebooks (e.g. first Horizons query, horizon-profile sanity checks).

**Owner:** TBD

| Notebook | Data | Covers |
|---|---|---|
| [01_horizons_exploration](01_horizons_exploration.ipynb) | data/raw/horizons | Ephemeris sanity checks, lunar day, rise/set windows, libration, time-to-sunset, Sun+Earth overlap (smooth horizon) |
| [02_trek_exploration](02_trek_exploration.ipynb) | data/raw/trek | Layer catalog, south-pole mosaics, tile value → physical value, which Trek layers to use as basemap |
| [03_pgda_exploration](03_pgda_exploration.ipynb) | data/raw/pgda | DEM quality and slope, terrain horizon profiles, terrain vs smooth-horizon sunlight/Earth visibility |

Run them from the repo root after the dumps exist: `uv run jupyter nbconvert --to notebook --execute --inplace notebooks/<name>.ipynb`.

- [ ] A5 Sanity check: Apollo site Earth high, south-pole Earth near horizon
