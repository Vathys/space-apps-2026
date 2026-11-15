"""Join the offline pipeline into the JSON the app reads from public/data/ (docs/data-contracts.md, types.ts).

    uv run python -m data.precompute        # writes index.json, sites/<siteId>.json, relays/<siteId>/<configId>.json

index.json (task N4 part A), the site file (part B) and the relay file (part C), for the P0 site and config.
"""

import inspect
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from data import geometry, relays, terrain
from data.horizons import (
    SITES,
    WINDOW,
    WINDOW_SAMPLES,
    WINDOW_STEP,
    check_window_grid,
    earth_moon_fixed,
    observer_table,
)
from data.sites import site_series, sun_angular_radius_deg
from data.terrain import OBSERVER_HEIGHT_M

OUT = Path(__file__).parent.parent / "public" / "data"
MAX_FILE_BYTES = 2 * 1024 * 1024  # CLAUDE.md §5
MAX_TOTAL_BYTES = 30 * 1024 * 1024  # all of public/data/: CLAUDE.md §5, D-26
PROPOSED = "proposed, not yet agreed"  # docs/decisions.md: marks values the team hasn't agreed yet

P0_SITE = "site01_connecting_ridge"
P0_CONFIG = "lcrns-ref-5sat"
# Sites written to public/data/, in UI order: (name, where the coordinates come from, which docs/decisions.md row).
SITE_META = {
    P0_SITE: ("Connecting Ridge",
              ("Point of the PGDA 5 m/px Site01 DEM (product 78, Barker et al. 2021) with the largest worst-case "
               "Earth clearance (notebook 04_comms_coverage, 500 m grid)"), "P0 site"),
    "site04_shackleton_rim": ("Shackleton Rim",
                              ("Flattest of the PGDA Site04 ROI points (Site04_ROIs.tgz: regions of average "
                               "illumination > 70%; product 78, Barker et al. 2021)"), "P1 site"),
}
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
    "RelayLinkData": ["schemaVersion", "siteId", "configId", "window", "satellites"],
    "SatelliteSeries": ["id", "name", "elements", "azimuthDeg", "elevationDeg", "rangeKm", "seesEarth", "source",
                        "uncertainty"],
    "KeplerElements": ["aKm", "e", "iDeg", "argpDeg", "raanDeg", "trueAnomalyDeg", "epochUtc", "frame", "frameEpochUtc"],
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


def index_json(heights_m: dict[str, float]) -> dict:
    """DatasetIndex for the SITE_META sites and the P0 relay config. heights_m: ground height (m) per site id
    (terrain.site_height_m)."""
    now = utc_now()
    sites = []
    for site_id, (name, coord_source, row) in SITE_META.items():
        lat, lon = SITES[site_id]
        sites.append({
            "id": site_id,
            "name": name,
            "latDeg": lat,
            "lonEastDeg": lon,
            "heightM": round(heights_m[site_id], 1),
            "antennaHeightsM": [OBSERVER_HEIGHT_M],
            "dataFile": f"sites/{site_id}.json",
            "source": {
                "source": coord_source,
                "url": "https://pgda.gsfc.nasa.gov/products/78",
                "generatedAtUtc": now,
                "notes": (f"Coordinates from data/horizons.py SITES. {row} and coordinates: {PROPOSED} "
                          "(docs/decisions.md H0 table). heightM: PGDA 5 m/px surface height at those coordinates "
                          "(data/terrain.py), above the 1737.4 km sphere, MOON_ME frame."),
            },
        })
    relay = {
        "id": P0_CONFIG,
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
        "dataFiles": {site_id: f"relays/{site_id}/{P0_CONFIG}.json" for site_id in SITE_META},
    }
    return {
        "schemaVersion": 1,
        "window": window_grid(),
        "frame": "moon-body-fixed-planetocentric-east",
        "moonRadiusKm": 1737.4,
        "sites": sites,
        "relayConfigs": [relay],
        # minElevationDeg 0, durationDays 14, antennaHeightM 2: all proposed (DatasetIndex has no notes field for them)
        "defaults": {"minElevationDeg": 0, "durationDays": 14, "antennaHeightM": OBSERVER_HEIGHT_M},
    }


def _azimuths(az_deg: pd.Series) -> list[float]:
    # Rounding 359.996 to 0.01 gives 360.0; wrap it to 0.0 so every azimuth is in [0, 360).
    return (np.round(az_deg.to_numpy(), 2) % 360).tolist()


def resolve_site(site: str | tuple[float, float]) -> str:
    """The data/horizons.py SITES id for a site id, or for a (lat, lon east) in degrees."""
    if isinstance(site, str):
        if site not in SITES:
            raise ValueError(f"unknown site id {site!r}")
        site_id = site
    else:
        # shortcut: a (lat, lon) must be a SITES entry, because data/sites.py and data/terrain.py look sites up by
        # id. Upgrade when they take coordinates (G6/G7): pass lat/lon through instead of resolving to an id.
        lat, lon = site
        site_id = next((i for i, (la, lo) in SITES.items() if (la, lo % 360) == (lat, lon % 360)), None)
        if site_id is None:
            raise ValueError(f"no site in data/horizons.py SITES at ({lat}, {lon}): an arbitrary point needs "
                             "data/sites.py and data/terrain.py to take coordinates (G6/G7)")
    if site_id not in terrain.PGDA_SITE:
        raise ValueError(f"{site_id} has no PGDA 5 m tile, so data/terrain.py can't build its horizon (G6)")
    return site_id


def site_data(site: str | tuple[float, float]) -> dict:
    """SiteData for a site id from SITES or a (lat, lon east), from Deep's sites.py series and terrain.py horizon
    as they are. Writes nothing to public/data/ and validates nothing against index.json (validate_site does that).
    Horizons queries come from data/raw/horizons/cache/ and go to the network only on a cache miss."""
    site_id = resolve_site(site)
    df = site_series(site_id)
    grid = window_grid()
    expected = pd.date_range(grid["startUtc"], periods=grid["count"], freq=f"{grid['stepSeconds']}s")
    on_grid = len(df) == grid["count"] and (df.time_utc.to_numpy() == expected.to_numpy()).all()
    if str(df.time_utc.dt.tz) != "UTC" or not on_grid:
        raise ValueError(f"{site_id}: Sun/Earth series is not on the window grid {grid}")
    # horizon_block() predates antennaHeightM (#38); it is computed for OBSERVER_HEIGHT_M, so label it with that.
    horizon = {"antennaHeightM": OBSERVER_HEIGHT_M, **terrain.horizon_block(site_id)}

    lat, lon = SITES[site_id]
    now = utc_now()
    # site_series() calls observer_table() with its default alt_km; read that default so the recorded
    # SITE_COORD is the one in the cached query (CLAUDE.md §5) and follows it if the default changes.
    alt_km = inspect.signature(observer_table).parameters["alt_km"].default
    query = (f"EPHEM_TYPE=OBSERVER, CENTER='coord@301', COORD_TYPE=GEODETIC, SITE_COORD='{lon % 360},{lat},{alt_km}', "
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
                            "use (horizons.earth_moon_fixed) to 0.006° az and 0.0006° el at every sample, "
                            "checked 2026-11-14 at site01_connecting_ridge (-89.4869, 223.698) only "
                            "(data/raw/horizons/README.md)."),
                "magnitude": "unknown",
            },
        },
    }
    return site


def relay_data(site: str | tuple[float, float], config_id: str) -> dict:
    """RelayLinkData: each satellite of config_id seen from the site, from relays.py positions and geometry.py
    as they are. Writes nothing; validate_relay checks it against index.json."""
    site_id = resolve_site(site)
    lat, lon = SITES[site_id]
    grid = window_grid()
    relays.check_epoch_states(config_id)  # the orbits still reproduce the published states (≲ 10 km), or raise
    positions_km = relays.config_positions(config_id, grid)
    track = earth_moon_fixed()
    check_window_grid(track)  # same instants as the relay positions, or the occultation test pairs wrong samples
    earth_km = track[["x_km", "y_km", "z_km"]].to_numpy()
    # The antenna, not the ground: the observer terrain.py's horizon and geometry.py's G3 check use.
    height_m = terrain.site_height_m(site_id) + OBSERVER_HEIGHT_M
    now = utc_now()
    occultation = ("seesEarth: the relay → Earth-centre line misses a smooth 1737.4 km Moon (geometry.sees_earth "
                   "shortcut: no limb terrain, Earth's centre only). Relay positions are geometric, Earth's is "
                   "Horizons' apparent one (horizons.track shortcut, ~0.006°).")
    satellites = []
    for s in relays.load_elements(config_id):
        pos_km = positions_km[s["id"]]
        az_deg, el_deg, range_km = geometry.topocentric(lat, lon, height_m, pos_km)
        satellites.append({
            "id": s["id"],
            "name": s["name"],
            "elements": s["elements"],
            "azimuthDeg": (np.round(az_deg, 2) % 360).tolist(),  # wrap 360.0 from rounding to 0.0
            "elevationDeg": np.round(el_deg, 2).tolist(),
            "rangeKm": np.round(range_km, 1).tolist(),
            "seesEarth": geometry.sees_earth(pos_km, earth_km).astype(int).tolist(),
            "source": {
                "source": s["source"],
                "query": f"data/relay_orbits.csv row '{s['name']}' (config {config_id})",
                "url": LCRNS_PDF,
                "generatedAtUtc": now,
                "notes": (f"data/relays.py: two-body Kepler from the published elements, IAU 2015 Moon rotation to "
                          f"Moon-fixed. Az/el/range by data/geometry.py topocentric() from {site_id} at "
                          f"{height_m:.1f} m above the 1737.4 km sphere (PGDA ground + {OBSERVER_HEIGHT_M:g} m "
                          "antenna), smooth local horizontal, no terrain. Earth: horizons.earth_moon_fixed()."),
            },
            "uncertainty": {"summary": f"{relays.UNCERTAINTY_TEXT} {occultation}", "magnitude": "unknown"},
        })
    return {"schemaVersion": 1, "siteId": site_id, "configId": config_id, "window": grid, "satellites": satellites}


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
    if site["schemaVersion"] != 1:
        raise ValueError(f"site schemaVersion {site['schemaVersion']} is not 1")
    # Series are timed implicitly (startUtc + i × stepSeconds) and the app slices every site with index.json's
    # window, including live point-server replies (G7, #58). A site on another grid would shift every sample.
    if diff := [k for k in KEYS["TimeGrid"] if site["window"][k] != idx["window"][k]]:
        raise ValueError(f"site {site['siteId']} window differs from index.json's in {diff}: "
                         f"{site['window']} vs {idx['window']}")
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


def validate_relay(relay: dict, idx: dict) -> None:
    """Raise unless relay has exactly the RelayLinkData shape of types.ts and agrees with index.json."""
    check_keys(relay, "RelayLinkData", "relay")
    check_keys(relay["window"], "TimeGrid", "relay.window")
    if relay["schemaVersion"] != 1:
        raise ValueError(f"relay schemaVersion {relay['schemaVersion']} is not 1")
    if relay["window"] != idx["window"]:
        raise ValueError(f"relay window {relay['window']} differs from index.json's {idx['window']}")
    config = next((c for c in idx["relayConfigs"] if c["id"] == relay["configId"]), None)
    if config is None:
        raise ValueError(f"relay config {relay['configId']} is not in index.relayConfigs")
    if relay["siteId"] not in config["dataFiles"]:
        raise ValueError(f"index has no {relay['configId']} file for site {relay['siteId']}")
    if len(relay["satellites"]) != config["satelliteCount"]:
        raise ValueError(f"{len(relay['satellites'])} satellites, index says {config['satelliteCount']}")
    if len({s["id"] for s in relay["satellites"]}) != len(relay["satellites"]):
        raise ValueError("satellite ids are not unique")
    n = relay["window"]["count"]
    for s in relay["satellites"]:
        where = f"relay.{s['id']}"
        check_keys(s, "SatelliteSeries", where)
        check_keys(s["elements"], "KeplerElements", f"{where}.elements")
        check_provenance(s["source"], f"{where}.source")
        check_uncertainty(s["uncertainty"], f"{where}.uncertainty")
        check_series(s["azimuthDeg"], f"{where}.azimuthDeg", n, 0, 360, hi_open=True)
        check_series(s["elevationDeg"], f"{where}.elevationDeg", n, -90, 90)
        # from the surface: above 0 km (never inside the antenna), below apolune + Moon diameter
        check_series(s["rangeKm"], f"{where}.rangeKm", n, 0.1, s["elements"]["aKm"] * (1 + s["elements"]["e"]) + 3500)
        if len(s["seesEarth"]) != n or set(s["seesEarth"]) - {0, 1}:
            raise ValueError(f"{where}.seesEarth must be {n} values of 0 or 1")


def report_relay(relay: dict) -> None:
    """Sanity numbers for the PR body. Printed only: nothing here is written to a file."""
    for s in relay["satellites"]:
        el, sees = np.array(s["elevationDeg"]), np.array(s["seesEarth"])
        print(f"{s['id']}: elevation {el.min():.2f}° to {el.max():.2f}°, above 0° {np.mean(el > 0):.1%}, "
              f"sees Earth {sees.mean():.1%}, range {min(s['rangeKm']):.0f}–{max(s['rangeKm']):.0f} km")


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


def check_total_budget(texts: dict[str, str]) -> int:
    """Bytes public/data/ would hold after writing texts ({relative path: JSON}); raises if over MAX_TOTAL_BYTES."""
    others = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file() and f.relative_to(OUT).as_posix() not in texts)
    total = others + sum(len(t.encode("utf-8")) for t in texts.values())
    if total >= MAX_TOTAL_BYTES:
        raise ValueError(f"public/data/ would be {total:,} bytes, over the {MAX_TOTAL_BYTES // 2**20} MB budget")
    return total


def write_json(texts: dict[str, str]) -> None:
    """Write already validated and encoded files under public/data/. No checks here."""
    for rel, text in texts.items():
        out = OUT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"{out}: {len(text.encode('utf-8')):,} bytes")


def main() -> None:
    sites = {site_id: site_data(site_id) for site_id in SITE_META}
    # horizon_block() doesn't return the ground height; site_height_m() is the same h0 its horizon() uses, read
    # from one DEM pixel, so the 720 rays aren't cast a second time.
    idx = index_json({site_id: terrain.site_height_m(site_id) for site_id in SITE_META})
    validate_index(idx)
    texts = {"index.json": encode(idx, "index.json")}
    relays = {}
    for site_id, site in sites.items():
        validate_site(site, idx)
        texts[f"sites/{site_id}.json"] = encode(site, site_id)
        relays[site_id] = relay_data(site_id, P0_CONFIG)
        validate_relay(relays[site_id], idx)
        relay_rel = next(c for c in idx["relayConfigs"] if c["id"] == P0_CONFIG)["dataFiles"][site_id]
        texts[relay_rel] = encode(relays[site_id], relay_rel)
    total = check_total_budget(texts)  # every check passes before anything is written
    write_json(texts)
    print(f"public/data/ total: {total:,} bytes")
    for site_id, site in sites.items():
        print(site_id)
        report(site)
        report_relay(relays[site_id])


if __name__ == "__main__":
    main()
