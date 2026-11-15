"""G6: DTE % vs Moon Trek AVGVISIB map for all 11 sites (same method as notebooks/07 cell 3). Results: D-33.

    uv run python notebooks/08_g6_trek_check.py   # from the repo root, after data.terrain and data.sites
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio

sys.path.insert(0, ".")
from data import horizons, terrain
from data.geometry import topocentric
from data.horizons import SITES, WINDOW, WINDOW_STEP

NEW = list(terrain.REGION_CENTERS)
EARTH_RADIUS_KM = 6371.0
long = horizons.track("earth", "2027-01-01 00:00", "2045-08-01 00:00", "3h")
lat, lon = np.radians(long.lat_deg.to_numpy()), np.radians(long.lon_deg.to_numpy())
r = long.range_km.to_numpy()
earth_km = np.stack([r*np.cos(lat)*np.cos(lon), r*np.cos(lat)*np.sin(lon), r*np.sin(lat)], -1)

def horizon_at(h, az):
    e = np.asarray(h["elevationDeg"], float); x = (np.asarray(az) % 360) / h["azimuthStepDeg"]
    k = np.floor(x).astype(int); t = x - k
    return e[k % len(e)]*(1-t) + e[(k+1) % len(e)]*t

def disc_fraction(el, hor, rad):
    d = np.clip((el - hor)/rad, -1, 1); return 1 - (np.arccos(d) - d*np.sqrt(1-d*d))/np.pi

rows = []
with rasterio.open(Path("data/raw/trek/raw_files/AVGVISIB_85S_060M_201608_EARTH_SP.tif")) as ds:
    z = ds.read(1).astype(float); z[z < -1e30] = np.nan
    for s in ["site01_connecting_ridge", "site04_shackleton_rim", *NEW]:
        la, lo = SITES[s]
        h = json.loads((terrain.RAW / f"{s}_horizon.json").read_text())
        x, y = terrain.TO_STEREO.transform(lo, la); rr, cc = ds.index(x, y)
        box = z[rr-2:rr+3, cc-2:cc+3]
        az, el, rng = topocentric(la, lo, terrain.site_height_m(s) + terrain.OBSERVER_HEIGHT_M, earth_km)
        hor = horizon_at(h, az)
        frac = disc_fraction(el, hor, np.degrees(np.arcsin(EARTH_RADIUS_KM / rng)))
        ser = pd.read_csv(horizons.RAW / f"{s}_series_{WINDOW[0][:10]}_{WINDOW[1][:10]}_{WINDOW_STEP}.csv")
        rows.append({"site": s, "map": z[rr, cc]*100, "map5x5_min": np.nanmin(box)*100, "map5x5_max": np.nanmax(box)*100,
                     "ours_18.6y_disc": frac.mean()*100, "ours_window_center": (ser.earth_el_deg > horizon_at(h, ser.earth_az_deg)).mean()*100,
                     "max_hor": max(h["elevationDeg"]), "ground_m": terrain.site_height_m(s)})
df = pd.DataFrame(rows).set_index("site").round(1)
df["diff"] = (df["ours_18.6y_disc"] - df["map"]).round(1)
df["in_5x5"] = (df["ours_18.6y_disc"] >= df.map5x5_min) & (df["ours_18.6y_disc"] <= df.map5x5_max)
pd.set_option("display.width", 200); print(df.to_string())
