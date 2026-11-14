# data/raw/terrain/

Terrain horizon per site, written by `uv run python -m data.terrain` from the PGDA 5 m site DEM (near field) and LOLA `LDEM_75S_120M` (far field, to 300 km), with lunar curvature. Rebuilt in ~10 s from `raw/pgda/` and `raw/lola/`.

**Owner:** Dev 2 · Board: [G2](../../../tasks/BOARD.md)

| File | Contents |
|---|---|
| `<site>_horizon.json` | The `horizon` object of `SiteData` ([docs/data-contracts.md](../../../docs/data-contracts.md)): `elevationDeg[k]` at azimuth `k × 0.5°` from north, clockwise, above the smooth local horizontal; `source` and `uncertainty` filled. `data/precompute.py` embeds it in `public/data/sites/<site>.json` |
