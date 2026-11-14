"""Sun and Earth seen from a landing site over the supported window: az/el (smooth horizon) and range.

Joins two cached Horizons observer tables on one 10-minute UTC grid. Terrain is not applied here (data/terrain.py).
precompute.py turns this into the `sun` and `earth` blocks of public/data/sites/<siteId>.json, taking
`sun.angularRadiusDeg` from sun_angular_radius_deg() below.

    uv run python -m data.sites [site_id ...]   # default: the P0 site; writes data/raw/horizons/<site>_series_<window>.csv
"""

import sys

import numpy as np
import pandas as pd

from data.horizons import (
    RAW,
    SITES,
    WINDOW,
    check_window_grid,
    observer_table,
    write_csv,
)

P0_SITE = "site01_connecting_ridge"  # proposed in docs/decisions.md (H0)
SUN_RADIUS_KM = 695700.0  # IAU 2015 nominal solar radius (Resolution B3)
POLAR_LAT_DEG = -85.0  # south of this, Earth must stay near the horizon (sanity check only)


def site_series(site_id: str, start: str = WINDOW[0], stop: str = WINDOW[1], step: str = "10m") -> pd.DataFrame:
    """time_utc (tz-aware UTC), sun/earth az/el (deg, az from north clockwise) and ranges (km)."""
    lat, lon = SITES[site_id]
    sun = observer_table("sun", lat, lon, start, stop, step)
    earth = observer_table("earth", lat, lon, start, stop, step)
    if not sun.time_utc.equals(earth.time_utc):
        raise ValueError(f"Sun and Earth tables are on different grids ({len(sun)} vs {len(earth)} rows)")
    # shortcut: Earth az/el here comes from a per-site Horizons query, while relay legs will use
    # horizons.earth_moon_fixed(); they agree to 0.006 deg (data/raw/horizons/README.md). Derive both from
    # earth_moon_fixed() once geometry.py (G3) has the Moon-fixed -> topocentric transform.
    return pd.DataFrame({
        "time_utc": sun.time_utc,
        "sun_az_deg": sun.az_deg, "sun_el_deg": sun.el_deg, "sun_range_km": sun.range_km,
        "earth_az_deg": earth.az_deg, "earth_el_deg": earth.el_deg, "earth_range_km": earth.range_km,
    })


def sun_angular_radius_deg(sun_range_km: pd.Series) -> float:
    """The single `sun.angularRadiusDeg` of the contract: the Sun's angular radius at its mean range over the series.

    # shortcut: one value per site file; the true radius varies with Sun range (printed by __main__ as min/max).
    # Upgrade by making angularRadiusDeg a per-sample array in docs/data-contracts.md if partial-disk sunlight
    # needs better than that.
    """
    return float(np.degrees(np.arcsin(SUN_RADIUS_KM / sun_range_km.mean())))


if __name__ == "__main__":
    for site_id in sys.argv[1:] or [P0_SITE]:
        df = site_series(site_id)
        check_window_grid(df)  # board G1 "done when": 12,961 samples on a regular UTC grid
        if SITES[site_id][0] <= POLAR_LAT_DEG and df.earth_el_deg.abs().max() >= 10:
            raise ValueError(f"{site_id}: |Earth elevation| reaches {df.earth_el_deg.abs().max():.2f} deg at the pole")
        write_csv(df, RAW / f"{site_id}_series_{WINDOW[0][:10]}_{WINDOW[1][:10]}_10m.csv")
        radius = np.degrees(np.arcsin(SUN_RADIUS_KM / df.sun_range_km))
        print(f"sun angular radius: {sun_angular_radius_deg(df.sun_range_km):.5f} deg "
              f"(per-sample {radius.min():.5f} to {radius.max():.5f})")
        print(df.drop(columns="time_utc").describe().loc[["min", "max"]].round(3).to_string())
