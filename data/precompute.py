"""Join the offline pipeline into the JSON the app reads from public/data/ (docs/data-contracts.md, types.ts).

    uv run python -m data.precompute        # writes public/data/index.json

For now only index.json (task N4 part A). The site file (sites/<siteId>.json) and the relay file
(relays/<siteId>/<configId>.json) are added here in parts B and C.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from data.horizons import SITES, WINDOW, WINDOW_SAMPLES, WINDOW_STEP
from data.terrain import OBSERVER_HEIGHT_M

OUT = Path(__file__).parent.parent / "public" / "data"
MAX_FILE_BYTES = 2 * 1024 * 1024  # CLAUDE.md §5
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


def index_json() -> dict:
    """DatasetIndex for the P0 site and P0 relay config."""
    lat, lon = SITES[P0_SITE]
    now = utc_now()
    site = {
        "id": P0_SITE,
        "name": "Connecting Ridge",
        "latDeg": lat,
        "lonEastDeg": lon,
        # shortcut: ground height left null until the site file (part B) carries terrain.py's DEM height
        "heightM": None,
        "antennaHeightsM": [OBSERVER_HEIGHT_M],
        "dataFile": f"sites/{P0_SITE}.json",
        "source": {
            "source": "Center of the PGDA 5 m/px site DEM bbox (product 78, Barker et al. 2021; bbox from the Moon Trek catalog)",
            "url": "https://pgda.gsfc.nasa.gov/products/78",
            "generatedAtUtc": now,
            "notes": f"Coordinates from data/horizons.py SITES. P0 site and coordinates: {PROPOSED} (docs/decisions.md H0 table).",
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


def write_json(obj: dict, rel: str) -> Path:
    """Compact JSON in insertion order (the types.ts order), refused if over the 2 MB budget."""
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    size = len(text.encode("utf-8"))
    if size >= MAX_FILE_BYTES:
        raise ValueError(f"{rel} is {size:,} bytes, over the 2 MB budget")
    out = OUT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text + "\n", encoding="utf-8")
    print(f"{out}: {size:,} bytes")
    return out


if __name__ == "__main__":
    idx = index_json()
    validate_index(idx)
    write_json(idx, "index.json")
