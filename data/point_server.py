"""Live "pick a point" server (D-24, D-25): SiteData + RelayLinkData for any south-pole point, on request.

Optional: the deployed app works without it and offers the precomputed sites instead. It runs on Deep's machine
behind Tailscale Funnel (README, "Pick a point server"). A picked point goes through the same functions that write
public/data/ (precompute.site_data, precompute.relay_data, validate_site, validate_relay): it is added to
horizons.SITES under a point id, and to terrain.PGDA_SITE when a downloaded PGDA 5 m tile covers it.

    uv run python -m data.point_server [--port 8787]
    GET /point?lat=-89.4869&lon=223.698   ->  {"meta": SiteMeta, "site": SiteData, "relays": {configId: RelayLinkData}}
    GET /health                           ->  {"ok": true}
"""

import argparse
import copy
import json
import math
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from data import precompute, terrain
from data.horizons import SITES

CACHE = Path(__file__).parent / "raw" / "points"  # one reply per point id, kept across restarts (gitignored)
# Rays reach terrain.MAX_RANGE_KM (300 km). LDEM_75S_120M is a square of half-width ~455 km around the pole, so
# south of -85° (152 km from the pole) every ray stays inside it. Further north the far horizon would be cut off.
MAX_LAT_DEG = -85.0
# Production, deploy previews and branch deploys of the Netlify site, plus `bun run dev`. Override with
# POINT_SERVER_ORIGINS (a regex) if the Netlify site name changes.
ORIGINS = re.compile(os.environ.get("POINT_SERVER_ORIGINS",
                                    r"https://([a-z0-9-]+--)?lunanav\.netlify\.app|http://localhost:3000"))
LOCK = threading.Lock()  # compute() edits SITES and PGDA_SITE: one point at a time; /health still answers


def parse_point(query: dict[str, list[str]]) -> tuple[float, float]:
    """(lat, lon east) in degrees, rounded to 4 decimals (~3 m), or ValueError with a message for the user."""
    try:
        lat, lon = float(query["lat"][0]), float(query["lon"][0])
    except (KeyError, ValueError):
        raise ValueError("lat and lon are required, in degrees (planetocentric, lon east)") from None
    if not (math.isfinite(lat) and math.isfinite(lon)):
        raise ValueError("lat and lon must be finite numbers")
    if not -90 < lat <= MAX_LAT_DEG:  # the pole itself has no azimuth
        raise ValueError(f"lat must be south of {MAX_LAT_DEG}° and not exactly -90° (south-pole cap only)")
    if not -180 <= lon <= 360:
        raise ValueError("lon must be in [-180, 360] degrees east")
    return round(lat, 4), round(lon % 360, 4) % 360


def compute(lat: float, lon: float) -> str:
    """The JSON reply for a point, from CACHE or computed and validated against public/data/index.json."""
    point_id = f"point_{lat:.4f}_{lon:.4f}"
    cached = CACHE / f"{point_id}.json"
    if cached.exists():
        return cached.read_text(encoding="utf-8")
    SITES[point_id] = (lat, lon)
    if tile := terrain.pgda_tile_at(lat, lon):
        terrain.PGDA_SITE[point_id] = tile
    idx = json.loads((precompute.OUT / "index.json").read_text(encoding="utf-8"))
    site = precompute.site_data(point_id)
    height_m = terrain.site_height_m(point_id)
    dem = f"PGDA 5 m/px tile {tile}" if tile else "LOLA LDEM_75S_120M (no downloaded 5 m tile covers it)"
    meta = {
        "id": point_id,
        "name": f"Picked point {lat:.4f}°, {lon:.4f}° E",
        "latDeg": lat,
        "lonEastDeg": lon,
        "heightM": round(height_m, 1),
        "antennaHeightsM": [terrain.OBSERVER_HEIGHT_M],
        "dataFile": f"point?lat={lat}&lon={lon}",  # served live, not a file in public/data/
        "source": {
            "source": "Picked by the user; computed live by the LunaNav point server (data/point_server.py)",
            "generatedAtUtc": precompute.utc_now(),
            "notes": (f"Coordinates as picked, rounded to 4 decimals. heightM: {dem} surface height there "
                      "(data/terrain.py), above the 1737.4 km sphere, MOON_ME frame."),
        },
    }
    # The validators look the site up in index.json: check against a copy that lists the point too.
    live_idx = copy.deepcopy(idx)
    live_idx["sites"].append(meta)
    for c in live_idx["relayConfigs"]:
        c["dataFiles"][point_id] = meta["dataFile"]
    precompute.validate_index(live_idx)
    precompute.validate_site(site, live_idx)
    relays = {}
    for c in idx["relayConfigs"]:
        relays[c["id"]] = precompute.relay_data(point_id, c["id"])
        precompute.validate_relay(relays[c["id"]], live_idx)
    text = json.dumps({"meta": meta, "site": site, "relays": relays}, separators=(",", ":"), allow_nan=False)
    CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(text, encoding="utf-8")
    return text


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path == "/health":
            return self._send(200, {"ok": True})
        if url.path != "/point":
            return self._send(404, {"error": "unknown path: use /point?lat=<deg>&lon=<deg east>"})
        try:
            lat, lon = parse_point(parse_qs(url.query))
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        try:
            with LOCK:
                body = compute(lat, lon)
        except Exception as e:  # noqa: BLE001  any failure is a 500 for this point, logged here, no traceback out
            self.log_error("compute(%s, %s) failed: %r", lat, lon, e)
            return self._send(500, {"error": "the point server could not compute this point"})
        self._send(200, body)

    def _send(self, status: int, body: dict | str) -> None:
        data = (body if isinstance(body, str) else json.dumps(body)).encode("utf-8")
        self.send_response(status)
        origin = self.headers.get("Origin", "")
        if ORIGINS.fullmatch(origin):  # CORS for the Netlify origins only (D-25)
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--port", type=int, default=8787)
    port = ap.parse_args().port
    # localhost only: Tailscale Funnel is the one public way in (`tailscale funnel <port>`)
    print(f"point server on http://127.0.0.1:{port}/point?lat=..&lon=..")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
