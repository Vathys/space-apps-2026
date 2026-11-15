"""Join the offline pipeline into the JSON the app reads from public/data/ (docs/data-contracts.md, types.ts).

    uv run python -m data.precompute        # writes public/data/index.json and sites/<siteId>.json

index.json (task N4 part A) and the site file (part B). The relay file (relays/<siteId>/<configId>.json)
is added here in part C.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from data import terrain
from data.horizons import SITES, WINDOW, WINDOW_SAMPLES, WINDOW_STEP
from data.sites import site_series, sun_angular_radius_deg
from data.terrain import OBSERVER_HEIGHT_M

OUT = Path(__file__).parent.parent / "public" / "data"
MAX_FILE_BYTES = 2 * 1024 * 1024  # CLAUDE.md §5
MAX_TOTAL_BYTES = 10 * 1024 * 1024  # CLAUDE.md §5: all of public/data/
PROPOSED = "proposed, not yet agreed"  # docs/decisions.md: marks values the team hasn't agreed yet

P0_SITE = "site01_connecting_ridge"
LCRNS_PDF = ("https://www.nasa.gov/wp-content/uploads/2025/08/"
             "nasa-lunar-communications-relay-and-navigation-systems-lcrns-reference-constellation-3-1.pdf")

# Keys of each object in types.ts, in the order written. Optional keys of Provenance are listed separately.
KEYS = {
    "DatasetIndex": ["schemaVersion", "window", "frame", "moonRadiusKm", "sites", "relayConfigs", "defaults"],
    "TimeGrid": ["startUtc", "stepSeconds", "count"],
    "defaults": ["minElevationDeg", "durationDays", "antennaHeightM"],
    "SiteMeta": ["id", "name", "latDeg", "lonEastDeg", "heightM", "antennaHeightsM", "dataFile", "source"],
    "RelayConfigMeta": ["id", "name", "kind", "description", "satelliteCount", "basedOn", "dataFiles"],
    "Provenance": ["source", "generatedAtUtc"],
    "SiteData": ["schemaVersion", "siteId", "window", "horizons", "sun", "earth"],
    "HorizonProfile": ["antennaHeightM", "azimuthStepDeg", "elevationDeg", "maxRangeKm", "demResolutionM",
                       "source", "uncertainty"],
    "sun": ["azimuthDeg", "elevationDeg", "angularRadiusDeg", "source", "uncertainty"],
    "earth": ["azimuthDeg", "elevationDeg", "rangeKm", "source", "uncertainty"],
    "Uncertainty": ["summary"],
}
PROVENANCE_OPTIONAL = {"query", "url", "notes"}


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def window_grid() -> dict:
    """TimeGrid from data.horizons.WINDOW, the one source for the supported window."""
    start, stop = (pd.Timestamp(t, tz="UTC") for t in WINDOW)
    step_s = pd.Timedelta(WINDOW_STEP).total_seconds()
    count = WINDOW_SAMPLES
    # Real raises, not assert: `python -O` must not skip them (same reason as horizons.check_window_grid).
    if step_s != 600 or count != 12_961:
        raise ValueError(f"window {WINDOW} at {WINDOW_STEP}: {count} samples of {step_s} s, expected 12,961 of 600 s")
    if start + pd.Timedelta(seconds=step_s * (count - 1)) != stop:
        raise ValueError(f"window grid does not end on {WINDOW[1]}")
    return {"startUtc": start.strftime("%Y-%m-%dT%H:%M:%SZ"), "stepSeconds": int(step_s), "count": count}


def index_json(height_m: float) -> dict:
    """DatasetIndex for the P0 site and P0 relay config. height_m: the site's ground height (terrain.py)."""
    lat, lon = SITES[P0_SITE]
    now = utc_now()
    site = {
        "id": P0_SITE,
        "name": "Connecting Ridge",
        "latDeg": lat,
        "lonEastDeg": lon,
        "heightM": round(height_m, 1),
        "antennaHeightsM": [OBSERVER_HEIGHT_M],
        "dataFile": f"sites/{P0_SITE}.json",
        "source": {
            "source": ("Point of the PGDA 5 m/px Site01 DEM (product 78, Barker et al. 2021) with the largest worst-case "
                       "Earth clearance (notebook 04_comms_coverage, 500 m grid)"),
            "url": "https://pgda.gsfc.nasa.gov/products/78",
            "generatedAtUtc": now,
            "notes": (f"Coordinates from data/horizons.py SITES. P0 site and coordinates: {PROPOSED} (docs/decisions.md "
                      "H0 table). heightM: PGDA 5 m/px surface height at those coordinates (data/terrain.py), "
                      "above the 1737.4 km sphere, MOON_ME frame."),
        },
    }
    relay = {
        "id": "lcrns-ref-5sat",
        "name": "LCRNS reference constellation, 5 satellites",
        "kind": "simulated-reference",
        "description": ("Simulated from NASA's LCRNS reference constellation v3.1: a government reference design, "
                        "not deployed and not the final design (Intuitive Machines chooses that). Five ~30 h "
                        "elliptical frozen orbits with apolune over the south pole, propagated two-body."),
        "satelliteCount": 5,
        "basedOn": {
            "source": "NASA Lunar Communications Relay and Navigation Systems (LCRNS) reference constellation v3.1, Tables 1-2",
            "url": LCRNS_PDF,  # same link as data/relay_orbits.csv (PR #36)
            "generatedAtUtc": now,
            "notes": f"Config lcrns-ref-5sat is D-19: {PROPOSED}.",
        },
        "dataFiles": {P0_SITE: f"relays/{P0_SITE}/lcrns-ref-5sat.json"},
    }
    return {
        "schemaVersion": 1,
        "window": window_grid(),
        "frame": "moon-body-fixed-planetocentric-east",
        "moonRadiusKm": 1737.4,
        "sites": [site],
        "relayConfigs": [relay],
        # minElevationDeg 0, durationDays 14, antennaHeightM 2: all proposed (DatasetIndex has no notes field for them)
        "defaults": {"minElevationDeg": 0, "durationDays": 14, "antennaHeightM": OBSERVER_HEIGHT_M},
    }


def _azimuths(az_deg: pd.Series) -> list[float]:
    # Rounding 359.996 to 0.01 gives 360.0; wrap it to 0.0 so every azimuth is in [0, 360).
    return (np.round(az_deg.to_numpy(), 2) % 360).tolist()


def site_json(site_id: str) -> tuple[dict, float]:
    """SiteData for site_id plus its ground height (m), from Deep's sites.py series and terrain.py horizon as they are."""
    df = site_series(site_id)
    grid = window_grid()
    expected = pd.date_range(grid["startUtc"], periods=grid["count"], freq=f"{grid['stepSeconds']}s")
    on_grid = len(df) == grid["count"] and (df.time_utc.to_numpy() == expected.to_numpy()).all()
    if str(df.time_utc.dt.tz) != "UTC" or not on_grid:
        raise ValueError(f"{site_id}: Sun/Earth series is not on the index.json window grid {grid}")
    # horizon_block() doesn't return the ground height. horizon() is deterministic, so calling it again gives
    # the same height_m that horizon_block() used.
    height_m = terrain.horizon(site_id)["height_m"]
    # horizon_block() predates antennaHeightM (#38); it is computed for OBSERVER_HEIGHT_M, so label it with that.
    horizon = {"antennaHeightM": OBSERVER_HEIGHT_M, **terrain.horizon_block(site_id)}

    lat, lon = SITES[site_id]
    now = utc_now()
    query = (f"EPHEM_TYPE=OBSERVER, CENTER='coord@301', COORD_TYPE=GEODETIC, SITE_COORD='{lon % 360},{lat},0', "
             f"QUANTITIES='4,20', START_TIME='{WINDOW[0]}', STOP_TIME='{WINDOW[1]}', STEP_SIZE='{WINDOW_STEP}'")
    frame_note = ("Az/el are from the smooth local horizontal in the IAU Moon frame (Horizons). The terrain "
                  "horizon in this file comes from DEMs in MOON_ME (DE421): the two lunar frames differ slightly, "
                  "and the site lat/lon is taken as the same in both (risk R3).")
    apparent = ("Apparent az/el (light-time and aberration corrected), not geometric, and no terrain "
                "(data/horizons.py observer_table shortcut). Horizons gives no formal az/el uncertainty, so "
                "the error here is unknown. ")

    def provenance(body: str, command: str) -> dict:
        return {"source": "JPL Horizons API", "query": f"COMMAND='{command}', {query}",
                "url": "https://ssd-api.jpl.nasa.gov/doc/horizons.html", "generatedAtUtc": now,
                "notes": f"data/sites.py site_series('{site_id}'), {body} columns. {frame_note}"}

    site = {
        "schemaVersion": 1,
        "siteId": site_id,
        "window": grid,
        "horizons": [horizon],
        "sun": {
            "azimuthDeg": _azimuths(df.sun_az_deg),
            "elevationDeg": np.round(df.sun_el_deg.to_numpy(), 2).tolist(),
            "angularRadiusDeg": round(sun_angular_radius_deg(df.sun_range_km), 5),
            "source": provenance("sun", "10"),
            "uncertainty": {
                "summary": (apparent + "angularRadiusDeg is one value at the mean Sun range (data/sites.py "
                            "shortcut); the true radius varies over the window."),
                "magnitude": "unknown",
            },
        },
        "earth": {
            "azimuthDeg": _azimuths(df.earth_az_deg),
            "elevationDeg": np.round(df.earth_el_deg.to_numpy(), 2).tolist(),
            "rangeKm": np.round(df.earth_range_km.to_numpy(), 1).tolist(),
            "source": provenance("earth", "399"),
            "uncertainty": {
                "summary": (apparent + "Cross-check: they agree with the Moon-fixed Earth track the relay legs "
                            "use (horizons.earth_moon_fixed) to 0.006° az and 0.0006° el at every sample "
                            "(data/raw/horizons/README.md)."),
                "magnitude": "unknown",
            },
        },
    }
    return site, height_m


def check_keys(obj: dict, kind: str, where: str, optional: set[str] = frozenset()) -> None:
    missing = set(KEYS[kind]) - obj.keys()
    extra = obj.keys() - set(KEYS[kind]) - optional
    if missing or extra:
        raise ValueError(f"{where} ({kind}): missing {sorted(missing)}, unexpected {sorted(extra)}")


def check_provenance(p: dict, where: str) -> None:
    check_keys(p, "Provenance", where, PROVENANCE_OPTIONAL)


def validate_index(idx: dict) -> None:
    """Raise unless idx has exactly the DatasetIndex shape of types.ts."""
    check_keys(idx, "DatasetIndex", "index")
    check_keys(idx["window"], "TimeGrid", "index.window")
    check_keys(idx["defaults"], "defaults", "index.defaults")
    if idx["window"]["count"] != WINDOW_SAMPLES:
        raise ValueError(f"index.window.count {idx['window']['count']} != WINDOW_SAMPLES {WINDOW_SAMPLES}")
    if idx["schemaVersion"] != 1 or idx["frame"] != "moon-body-fixed-planetocentric-east" or idx["moonRadiusKm"] != 1737.4:
        raise ValueError("schemaVersion, frame or moonRadiusKm differs from the literal types in types.ts")
    if not idx["sites"] or not idx["relayConfigs"]:
        raise ValueError("index needs at least one site and one relay config")
    site_ids = set()
    for i, s in enumerate(idx["sites"]):
        check_keys(s, "SiteMeta", f"sites[{i}]")
        check_provenance(s["source"], f"sites[{i}].source")
        if not s["antennaHeightsM"]:
            raise ValueError(f"sites[{i}].antennaHeightsM is empty")
        site_ids.add(s["id"])
    for i, c in enumerate(idx["relayConfigs"]):
        check_keys(c, "RelayConfigMeta", f"relayConfigs[{i}]")
        check_provenance(c["basedOn"], f"relayConfigs[{i}].basedOn")
        if c["kind"] != "simulated-reference":
            raise ValueError(f"relayConfigs[{i}].kind must be 'simulated-reference'")
        if unknown := c["dataFiles"].keys() - site_ids:
            raise ValueError(f"relayConfigs[{i}].dataFiles names unknown sites {sorted(unknown)}")
    if not any(idx["defaults"]["antennaHeightM"] in s["antennaHeightsM"] for s in idx["sites"]):
        raise ValueError("defaults.antennaHeightM is not an antenna height of any site")


def check_uncertainty(u: dict, where: str) -> None:
    check_keys(u, "Uncertainty", where, {"magnitude"})
    if not u["summary"].strip():
        raise ValueError(f"{where}.summary is empty: write 'unknown' instead (CLAUDE.md §5)")


def check_series(values: list, where: str, count: int, lo: float, hi: float, hi_open: bool = False) -> None:
    """Raise unless values has exactly count finite numbers in [lo, hi] ([lo, hi) if hi_open)."""
    a = np.asarray(values, dtype=np.float64)
    if a.shape != (count,):
        raise ValueError(f"{where} has {a.size} values, expected {count}")
    if not np.isfinite(a).all():
        raise ValueError(f"{where} has NaN or inf")
    if a.min() < lo or a.max() > hi or (hi_open and a.max() == hi):
        raise ValueError(f"{where} spans {a.min()} to {a.max()}, outside [{lo}, {hi}" + (")" if hi_open else "]"))


def validate_site(site: dict, idx: dict) -> None:
    """Raise unless site has exactly the SiteData shape of types.ts and agrees with index.json."""
    check_keys(site, "SiteData", "site")
    check_keys(site["window"], "TimeGrid", "site.window")
    if site["schemaVersion"] != 1 or site["window"] != idx["window"]:
        raise ValueError(f"site schemaVersion {site['schemaVersion']} or window {site['window']} differs from index")
    meta = next((s for s in idx["sites"] if s["id"] == site["siteId"]), None)
    if meta is None:
        raise ValueError(f"site {site['siteId']} is not in index.sites")
    if sorted(h["antennaHeightM"] for h in site["horizons"]) != sorted(meta["antennaHeightsM"]):
        raise ValueError("site.horizons antenna heights differ from index SiteMeta.antennaHeightsM")
    n = site["window"]["count"]
    for i, h in enumerate(site["horizons"]):
        where = f"site.horizons[{i}]"
        check_keys(h, "HorizonProfile", where)
        check_provenance(h["source"], f"{where}.source")
        check_uncertainty(h["uncertainty"], f"{where}.uncertainty")
        check_series(h["elevationDeg"], f"{where}.elevationDeg", round(360 / h["azimuthStepDeg"]), -90, 90)
    for body in ("sun", "earth"):
        b = site[body]
        check_keys(b, body, f"site.{body}")
        check_provenance(b["source"], f"site.{body}.source")
        check_uncertainty(b["uncertainty"], f"site.{body}.uncertainty")
        check_series(b["azimuthDeg"], f"site.{body}.azimuthDeg", n, 0, 360, hi_open=True)
        check_series(b["elevationDeg"], f"site.{body}.elevationDeg", n, -90, 90)
    check_series(site["earth"]["rangeKm"], "site.earth.rangeKm", n, 3.5e5, 4.1e5)  # Earth–Moon distance range
    if not 0.26 < site["sun"]["angularRadiusDeg"] < 0.28:
        raise ValueError(f"sun.angularRadiusDeg {site['sun']['angularRadiusDeg']} is not ~0.27")


def report(site: dict) -> None:
    """Sanity numbers for the PR body. Printed only: nothing here is written to a file."""
    h = site["horizons"][0]
    hz, step = np.array(h["elevationDeg"]), h["azimuthStepDeg"]
    for body in ("sun", "earth"):
        el = np.array(site[body]["elevationDeg"])
        print(f"{body} elevation: {el.min():.2f}° to {el.max():.2f}°")
    print(f"horizon elevation: {hz.min():.2f}° to {hz.max():.2f}°, highest at azimuth {hz.argmax() * step:g}°")
    az, el = np.array(site["earth"]["azimuthDeg"]), np.array(site["earth"]["elevationDeg"])
    # shortcut: nearest-azimuth lookup for this printout only; visibility.ts (G4) does the real interpolation
    above = el > hz[np.round(az / step).astype(int) % len(hz)]
    print(f"Earth centre above the terrain horizon (nearest {step:g}° azimuth, 0° mask): {above.mean():.1%} of samples")


def encode(obj: dict, rel: str) -> str:
    """Compact JSON in insertion order (the types.ts order), refused if over the 2 MB budget."""
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"
    if (size := len(text.encode("utf-8"))) >= MAX_FILE_BYTES:
        raise ValueError(f"{rel} is {size:,} bytes, over the 2 MB budget")
    return text


def main() -> None:
    site, height_m = site_json(P0_SITE)
    idx = index_json(height_m)
    validate_index(idx)
    validate_site(site, idx)
    texts = {"index.json": encode(idx, "index.json"), f"sites/{P0_SITE}.json": encode(site, P0_SITE)}
    # Every check passes before anything is written, including the 10 MB budget for all of public/data/.
    others = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file() and f.relative_to(OUT).as_posix() not in texts)
    total = others + sum(len(t.encode("utf-8")) for t in texts.values())
    if total >= MAX_TOTAL_BYTES:
        raise ValueError(f"public/data/ would be {total:,} bytes, over the 10 MB budget")
    for rel, text in texts.items():
        out = OUT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"{out}: {len(text.encode('utf-8')):,} bytes")
    print(f"public/data/ total: {total:,} bytes")
    report(site)


if __name__ == "__main__":
    main()
