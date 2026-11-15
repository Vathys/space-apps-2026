# data/raw/relays/

Relay satellite positions, written by `uv run python -m data.relays` from `data/relay_orbits.csv` (two-body Kepler + IAU 2015 Moon rotation, D-19). Rebuilt in seconds; the only network call is a cached Horizons query for the rotation check.

**Owner:** Dev 1 · Board: [N1](../../../tasks/BOARD.md)

| File | Contents |
|---|---|
| `<config>.npz` | One per config in `relays.CONFIGS` (`lcrns-ref-5sat`, `lcrns-ref-1sat`, `lunar-pathfinder`). `time_utc` (the window grid, ISO 8601 UTC) and one `(n_samples, 3)` array per satellite id (`sv1` … `sv5`, `lunar-pathfinder`): Moon-fixed position in km (IAU Moon body frame, the frame of `geometry.py`). For inspection only: `data/precompute.py` calls `relays.config_positions()` directly |
