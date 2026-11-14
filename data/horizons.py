"""JPL Horizons connector: Sun/Earth azimuth & elevation seen from a point on the Moon.

API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
Elevation is relative to the reference ellipsoid's horizon (no terrain, no refraction: the Moon is airless).

    uv run python -m data.horizons        # dump Earth's Moon-fixed position over WINDOW + orbiter tracks to data/raw/horizons/
"""

import hashlib
import io
import json
from pathlib import Path

import numpy as np
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

# Lunar orbiters in Horizons (checked 2026-11-14). Predicts end soon (Chandrayaan-2 2026-12-11, Danuri 2027-06-03;
# CAPSTONE stopped 2026-08-14), so tracks cover the past year. ARTEMIS P1/P2 (-192/-193) are left out: Horizons
# rejects them as an observer center, and they carry no relay payload.
# Queqiao-2, the only dedicated relay in lunar orbit, is not in Horizons: see data/relays.csv.
ORBITERS = {"lro": "-85", "danuri": "-155", "chandrayaan2": "-152"}
TRACK_SPAN = ("2025-11-28", "2026-11-28")
# Supported mission window (UTC), 10 min step, both ends included. Proposed in docs/decisions.md (H0).
WINDOW = ("2027-01-01 00:00", "2027-04-01 00:00")
WINDOW_STEP = pd.Timedelta("10min")
WINDOW_SAMPLES = len(pd.date_range(*WINDOW, freq=WINDOW_STEP))  # 12,961 for the window above


def observer_table(body: str, lat: float, lon: float, start: str, stop: str, step: str = "1h",
                   alt_km: float = 0.0) -> pd.DataFrame:
    """Topocentric az/el (deg) and range (km) of `body` ('sun', 'earth', or a Horizons id) from a lunar site."""
    # shortcut: az/el are apparent (light-time + aberration corrected), not geometric, while relays.py Kepler
    # positions are geometric. Upgrade to a geometric query if a sample at a terrain-mask or Moon-limb edge depends on it.
    params = _base(start, stop, step) | {
        "COMMAND": f"'{BODIES.get(body, body)}'",
        "CENTER": "'coord@301'",  # 301 = Moon
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon % 360},{lat},{alt_km}'",
        "QUANTITIES": "'4,20'",  # 4 = apparent az/el, 20 = observer range
    }
    df = _ephemeris(params).rename(columns={"Azi_(a-app)": "az_deg", "Elev_(a-app)": "el_deg"})
    return df[["time_utc", "az_deg", "el_deg", "range_km"]]


def track(observer: str, start: str, stop: str, step: str = "10m") -> pd.DataFrame:
    """Moon-fixed position of `observer` ('earth' or a spacecraft id): selenographic lat/lon east (deg) + range (km).

    Asks Horizons for the Moon's sub-observer point, i.e. the spot the observer sits directly above (IAU Moon
    frame). One call gives a whole orbit track, so visibility for any number of surface sites can be computed
    locally instead of one observer_table call per site. For 'earth' this is the libration-driven sub-Earth point.
    """
    # shortcut: Horizons' sub-observer point and range are apparent (light-time + aberration corrected), not
    # geometric. For Earth that moves the position by tens of km (~20 arcsec seen from the Moon), while relays.py
    # Kepler positions are instantaneous geometric ones, so relay-to-Earth occultation mixes the two. Upgrade to a
    # geometric query (e.g. VECTORS with VEC_CORR='NONE') if a sample near the Moon's limb turns out to depend on it.
    params = _base(start, stop, step) | {
        "COMMAND": "'301'",
        "CENTER": f"'500@{BODIES.get(observer, observer)}'",
        "QUANTITIES": "'14,20'",  # 14 = observer sub-lon/lat on the target, 20 = range
    }
    df = _ephemeris(params).rename(columns={"ObsSub-LON": "lon_deg", "ObsSub-LAT": "lat_deg"})
    return df[["time_utc", "lat_deg", "lon_deg", "range_km"]]


def earth_moon_fixed(start: str = WINDOW[0], stop: str = WINDOW[1], step: str = "10m") -> pd.DataFrame:
    """Earth's center in the Moon-fixed frame (IAU Moon, km from the Moon's center; x toward 0°E on the equator,
    z toward the north pole). Input for the relay-to-Earth occultation test: the relay's position in the same frame
    is needed too, so this is a position, not a unit vector (a relay 17,000 km out sees Earth ~2.5° off the
    Moon-center direction)."""
    df = track("earth", start, stop, step)
    lat, lon = np.radians(df.lat_deg), np.radians(df.lon_deg)
    df["x_km"] = df.range_km * np.cos(lat) * np.cos(lon)
    df["y_km"] = df.range_km * np.cos(lat) * np.sin(lon)
    df["z_km"] = df.range_km * np.sin(lat)
    return df


def _base(start: str, stop: str, step: str) -> dict:
    return {"format": "json", "EPHEM_TYPE": "'OBSERVER'", "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'",
            "STEP_SIZE": f"'{step}'", "CSV_FORMAT": "'YES'", "OBJ_DATA": "'NO'", "ANG_FORMAT": "'DEG'"}


def _ephemeris(params: dict) -> pd.DataFrame:
    """Run an OBSERVER query; returns Horizons' CSV columns plus parsed time_utc and range_km (from delta).

    Successful responses are cached in raw/horizons/cache/, keyed by the exact query (CLAUDE.md §5); delete a
    file there to re-fetch it, e.g. when Horizons updates a spacecraft's predicts.
    """
    cached = RAW / "cache" / f"{hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()}.txt"
    if cached.exists():
        result = cached.read_text(encoding="utf-8")
    else:
        r = requests.get(API, params=params, timeout=300)
        r.raise_for_status()
        result = r.json().get("result", "")
        if "$$SOE" not in result:
            raise RuntimeError(f"Horizons returned no ephemeris:\n{result[:2000]}")
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_text(result, encoding="utf-8")
    head, rest = result.split("$$SOE")
    header = head.strip().splitlines()[-2]  # column line sits just above the '****' rule
    cols = [c.strip() or f"_{i}" for i, c in enumerate(header.split(","))]  # blank flag columns need unique names
    df = pd.read_csv(io.StringIO(rest.split("$$EOE")[0]), names=cols, skipinitialspace=True)
    df = df.rename(columns={cols[0]: "time_utc"})
    # Horizons' default TIME_TYPE for observer tables is UT; this is the one place time is converted (CLAUDE.md §5)
    df["time_utc"] = pd.to_datetime(df["time_utc"].str.strip(), format="%Y-%b-%d %H:%M").dt.tz_localize("UTC")
    df["range_km"] = df["delta"] * 149597870.7  # Horizons reports delta in au
    return df


def check_window_grid(df: pd.DataFrame) -> None:
    """Raise unless df.time_utc is exactly the WINDOW grid. A real raise, not assert: `python -O` must not skip it,
    because series are implicitly timed (startUtc + i*stepSeconds) and a gap would shift every later sample."""
    expected = pd.date_range(*WINDOW, freq=WINDOW_STEP, tz="UTC")
    if len(df) != WINDOW_SAMPLES or not (df.time_utc.to_numpy() == expected.to_numpy()).all():
        raise ValueError(f"time_utc is not the {WINDOW} grid at {WINDOW_STEP}: {len(df)} rows, {WINDOW_SAMPLES} expected")


def write_csv(df: pd.DataFrame, out: Path) -> None:
    """CSV with time_utc as ISO 8601 UTC with 'Z' (docs/data-contracts.md), so no reader can take it as local."""
    df.assign(time_utc=df.time_utc.dt.strftime("%Y-%m-%dT%H:%M:%SZ")).to_csv(out, index=False)
    print(out, len(df))


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    # Hourly 2026 site tables: input for notebooks/01 and 03 (exploration and cross-checks only, not app data).
    # Kept in their original naive-UTC time format, which the notebooks' time arithmetic expects.
    for site, (lat, lon) in SITES.items():
        for body in BODIES:
            df = observer_table(body, lat, lon, "2026-01-01", "2027-01-01", "1h")
            out = RAW / f"{site}_{body}.csv"
            df.assign(time_utc=df.time_utc.dt.tz_localize(None)).to_csv(out, index=False)
            print(out, len(df))
    # Orbiter tracks cover the past year on purpose (predicts end soon, see ORBITERS): reference only, not app data.
    for name, observer in ORBITERS.items():
        write_csv(track(observer, *TRACK_SPAN, "10m"), RAW / f"track_{name}.csv")
    df = earth_moon_fixed()
    check_window_grid(df)
    write_csv(df, RAW / f"earth_moon_fixed_{WINDOW[0][:10]}_{WINDOW[1][:10]}_10m.csv")
