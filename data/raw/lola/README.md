# data/raw/lola/

LOLA gridded DEMs (PDS LOLA GDR, [MIT mirror](https://imbrium.mit.edu/DATA/LOLA_GDR/)) for terrain horizon masks. Earth and relay satellites sit near the horizon at the pole, and terrain 100+ km away (e.g. Malapert) can block them. PGDA's 5 m site DEMs only reach about 10 km, so horizons need these wider grids.

**Owner:** Lane B · Board: [B1](../../../tasks/BOARD.md)

| Product | Resolution | Projection | Size | Source / citation |
|---|---|---|---|---|
| `LDEM_75S_120M` | 120 m/px, 7624² int16 | South polar stereographic, R = 1737.4 km | 116 MB | LOLA GDR POLAR; Smith et al. (2010), GRL 37, L18204 |
| `LDEM_16` | 16 px/deg (~1.9 km), 5760×2880 int16 | Simple cylindrical, global | 33 MB | LOLA GDR CYLINDRICAL; Smith et al. (2010) |

Each is a PDS3 `.IMG` + `.LBL` pair. Open the `.LBL` with rasterio. Height (m) = DN × 0.5 above R = 1737.4 km.
Higher-resolution upgrades: `LDEM_80S_20M` (~1.8 GB), `LDEM_64` (531 MB), or SLDEM2015 (±60°, ~60 m, [PGDA 54](https://pgda.gsfc.nasa.gov/products/54)).

Re-download: `uv run python -m data.lola` (downloaded 2026-11-14).
