"""Sun and Earth seen from a landing site over the supported window: az/el (smooth horizon) and range.

Joins two cached Horizons observer tables on one 10-minute UTC grid. Terrain is not applied here (data/terrain.py).
precompute.py turns this into the `sun` and `earth` blocks of public/data/sites/<siteId>.json.

    uv run python -m data.sites [site_id ...]   # default: the P0 site; writes data/raw/horizons/<site>_series_<window>.csv
"""

import sys

import numpy as np
import pandas as pd

from data.horizons import RAW, SITES, WINDOW, observer_table

P0_SITE = "site01_connecting_ridge"  # proposed in docs/decisions.md (H0)
SUN_RADIUS_KM = 695700.0  # IAU 2015 nominal solar radius (Resolution B3)


def site_series(site_id: str, start: str = WINDOW[0], stop: str = WINDOW[1], step: str = "10m") -> pd.DataFrame:
    """time_utc, sun/earth az/el (deg, az from north clockwise), ranges (km) and the Sun's angular radius (deg)."""
    lat, lon = SITES[site_id]
    sun = observer_table("sun", lat, lon, start, stop, step)
    earth = observer_table("earth", lat, lon, start, stop, step)
    assert (sun.time_utc.values == earth.time_utc.values).all(), "Sun and Earth tables are on different grids"
    return pd.DataFrame({
        "time_utc": sun.time_utc,
        "sun_az_deg": sun.az_deg, "sun_el_deg": sun.el_deg, "sun_range_km": sun.range_km,
        "sun_angular_radius_deg": np.degrees(np.arcsin(SUN_RADIUS_KM / sun.range_km)),
        "earth_az_deg": earth.az_deg, "earth_el_deg": earth.el_deg, "earth_range_km": earth.range_km,
    })


if __name__ == "__main__":
    for site_id in sys.argv[1:] or [P0_SITE]:
        df = site_series(site_id)
        # board G1 "done when": 12,961 samples on a regular UTC grid; Earth stays near the horizon at the pole
        assert len(df) == 12961 and (df.time_utc.diff().dropna() == pd.Timedelta("10min")).all(), len(df)
        assert df.earth_el_deg.abs().max() < 10, df.earth_el_deg.abs().max()
        out = RAW / f"{site_id}_series_{WINDOW[0][:10]}_{WINDOW[1][:10]}_10m.csv"
        df.to_csv(out, index=False)
        print(out, len(df))
        print(df.drop(columns="time_utc").describe().loc[["min", "max"]].round(3).to_string())
