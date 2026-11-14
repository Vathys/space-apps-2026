"""JPL Horizons connector: Sun/Earth azimuth & elevation seen from a point on the Moon.

API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
Elevation is relative to the reference ellipsoid's horizon (no terrain, no refraction: the Moon is airless).

    uv run python -m data.horizons        # dump Sun+Earth tables for SITES to data/raw/horizons/
"""

import io
from pathlib import Path

import pandas as pd
import requests

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
RAW = Path(__file__).parent / "raw" / "horizons"
BODIES = {"sun": "10", "earth": "399"}

# (lat, lon east) in degrees. South-pole entries are the bbox centers of the PGDA 5 m DEMs
# (bbox from the Trek catalog); the rest are published landing coordinates.
SITES = {
    "site01_connecting_ridge": (-89.4632, 222.5104),
    "site04_shackleton_rim": (-89.7630, 187.9976),
    "im1_odysseus": (-80.13, 1.44),
    "chandrayaan3": (-69.373, 32.319),
    "change4": (-45.4446, 177.5991),
    "apollo11": (0.67408, 23.47297),
    "apollo15": (26.13222, 3.63386),
    "apollo17": (20.1911, 30.7723),
}


def observer_table(body: str, lat: float, lon: float, start: str, stop: str, step: str = "1h",
                   alt_km: float = 0.0) -> pd.DataFrame:
    """Topocentric az/el (deg) and range (km) of `body` ('sun', 'earth', or a Horizons id) from a lunar site."""
    params = {
        "format": "json",
        "COMMAND": f"'{BODIES.get(body, body)}'",
        "CENTER": "'coord@301'",  # 301 = Moon
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon % 360},{lat},{alt_km}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'4,20'",  # 4 = apparent az/el, 20 = observer range
        "CSV_FORMAT": "'YES'",
        "OBJ_DATA": "'NO'",
        "ANG_FORMAT": "'DEG'",
    }
    r = requests.get(API, params=params, timeout=120)
    r.raise_for_status()
    result = r.json().get("result", "")
    if "$$SOE" not in result:
        raise RuntimeError(f"Horizons returned no ephemeris:\n{result[:2000]}")
    head, rest = result.split("$$SOE")
    header = head.strip().splitlines()[-2]  # column line sits just above the '****' rule
    cols = [c.strip() or f"_{i}" for i, c in enumerate(header.split(","))]  # blank flag columns need unique names
    df = pd.read_csv(io.StringIO(rest.split("$$EOE")[0]), names=cols, skipinitialspace=True)
    df = df.rename(columns={cols[0]: "time_utc", "Azi_(a-app)": "az_deg", "Elev_(a-app)": "el_deg",
                            "delta": "range_km"})
    df = df[["time_utc", "az_deg", "el_deg", "range_km"]]
    df["time_utc"] = pd.to_datetime(df["time_utc"].str.strip(), format="%Y-%b-%d %H:%M")
    df["range_km"] = df["range_km"] * 149597870.7  # Horizons reports delta in au
    return df


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    for site, (lat, lon) in SITES.items():
        for body in BODIES:
            df = observer_table(body, lat, lon, "2026-01-01", "2027-01-01", "1h")
            out = RAW / f"{site}_{body}.csv"
            df.to_csv(out, index=False)
            print(out, len(df))
