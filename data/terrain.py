"""Terrain horizon: how high the skyline stands in every direction from a south-pole site.

Rays leave the site at 720 azimuths (0.5° step) along great circles of the 1737.4 km sphere. Heights come
from the PGDA 5 m site DEM where it has data (near field, the ~16 km square around the site) and from LOLA
LDEM_75S_120M beyond it, out to MAX_RANGE_KM. The angle to each ray point uses the exact radii and central
angle, so lunar curvature is built in. Elevation is from the smooth local horizontal (docs/data-contracts.md).

    uv run python -m data.terrain         # writes data/raw/terrain/<site>_horizon.json per site
"""

import functools
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.windows import from_bounds

from data import lola, pgda
from data.horizons import SITES

RAW = Path(__file__).parent / "raw" / "terrain"
R_M = 1737400.0
AZ_STEP_DEG = 0.5
NEAR_KM, NEAR_STEP_M = 12.0, 5.0  # covers the PGDA square's corners (~11.3 km) at its pixel size
MAX_RANGE_KM, FAR_STEP_M = 300.0, 60.0  # D-15 asks ≥ 150 km; 300 km is cheap and shows how far ridges matter
OBSERVER_HEIGHT_M = 2.0  # shortcut: one 2 m antenna height for every lander, set it per mission if a design gives it
PGDA_SITE = {"site01_connecting_ridge": "Site01", "site04_shackleton_rim": "Site04"}
# G6 sites: the center (lat, lon east) of each region's PGDA 5 m tile, read from the tile's bounds. The tiles are
# not downloaded (~1 GB), so these sites use LOLA 120 m only and horizon_block() says so.
REGION_CENTERS = {
    "site07_peak_near_shackleton": (-88.811, 123.69),  # PGDA Site07
    "sl3_connecting_ridge_extension": (-89.032, 258.00),  # SL3
    "site06_nobile_rim_1": (-85.438, 37.37),  # Site06
    "site11_de_gerlache_rim": (-88.683, 292.07),  # Site11
    "site42_de_gerlache_kocher_massif": (-85.830, 243.68),  # Site42
    "haworth": (-86.764, 337.22),  # Haworth
    "site23_malapert_massif": (-85.995, 359.76),  # Site23
    "site20_leibnitz_beta_plateau": (-85.427, 31.74),  # Site20
    "lm7_faustini_rim_a": (-87.890, 90.00),  # LM7
}
PICK_RADIUS_KM, PICK_MAX_SLOPE_DEG = 4.0, 5.0
TO_STEREO = Transformer.from_crs("+proj=longlat +R=1737400 +no_defs", pgda.POLAR_STEREO, always_xy=True)


def _bilinear(z: np.ndarray, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
    """Sample z at fractional pixel-center (row, col); NaN outside z or next to a NaN cell."""
    r0, c0 = np.floor(rows).astype(np.int64), np.floor(cols).astype(np.int64)
    ok = (r0 >= 0) & (c0 >= 0) & (r0 < z.shape[0] - 1) & (c0 < z.shape[1] - 1)
    r0, c0 = np.where(ok, r0, 0), np.where(ok, c0, 0)
    fr, fc = rows - r0, cols - c0
    v = (z[r0, c0] * (1 - fr) * (1 - fc) + z[r0 + 1, c0] * fr * (1 - fc)
         + z[r0, c0 + 1] * (1 - fr) * fc + z[r0 + 1, c0 + 1] * fr * fc)
    return np.where(ok, v, np.nan)


def _sample(z: np.ndarray, transform, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    col, row = ~transform * (x, y)
    return _bilinear(z, row - 0.5, col - 0.5)  # rasterio indexes pixel corners; z[i, j] is the pixel center


def elevation_deg(r_obs_m: float, r_pt_m: np.ndarray, central_angle_rad: np.ndarray) -> np.ndarray:
    """Angle above the observer's local horizontal to a point at radius r_pt and the given central angle."""
    return np.degrees(np.arctan2(r_pt_m * np.cos(central_angle_rad) - r_obs_m, r_pt_m * np.sin(central_angle_rad)))


def _lola(x0: float, y0: float, pad_m: float) -> tuple[np.ndarray, object]:
    """LDEM_75S_120M heights (m above the 1737.4 km sphere, NaN where no data) in a square of half-width pad_m
    around stereographic (x0, y0), and that window's transform."""
    with rasterio.open(lola.RAW / "LDEM_75S_120M.LBL") as ds:
        win = from_bounds(x0 - pad_m, y0 - pad_m, x0 + pad_m, y0 + pad_m, ds.transform).round_offsets().round_lengths()
        dn = ds.read(1, window=win)
        return np.where(dn == ds.nodata, np.nan, dn * ds.scales[0]), ds.window_transform(win)


def pgda_tile_at(lat: float, lon: float) -> str | None:
    """The downloaded PGDA 5 m tile (data/raw/pgda/<tile>/) with a height at (lat, lon east), if any."""
    x0, y0 = TO_STEREO.transform(lon, lat)
    for tif in sorted(pgda.RAW.glob("*/*_final_adj_5mpp_surf.tif")):
        with rasterio.open(tif) as ds:
            b = ds.bounds
            if not (b.left < x0 < b.right and b.bottom < y0 < b.top):
                continue
            # a few pixels around the point: the same bilinear test site_height_m() applies, without reading the tile
            win = from_bounds(x0 - 20, y0 - 20, x0 + 20, y0 + 20, ds.transform).round_offsets().round_lengths()
            z = ds.read(1, window=win, boundless=True, fill_value=np.nan).astype(np.float64)
            if np.isfinite(_sample(z, ds.window_transform(win), np.array([x0]), np.array([y0]))[0]):
                return tif.parent.name
    return None


def highest_flat_point(lat: float, lon: float) -> tuple[float, float]:
    """(lat, lon east) rounded to 4 decimals of the highest LOLA 120 m pixel within PICK_RADIUS_KM of (lat, lon)
    whose slope is at most PICK_MAX_SLOPE_DEG. High ground lowers the terrain horizon; the slope cap keeps the pick
    off cliff edges. Not a landing-safety assessment (P2)."""
    x0, y0 = TO_STEREO.transform(lon, lat)
    z, tf = _lola(x0, y0, PICK_RADIUS_KM * 1e3)
    gy, gx = np.gradient(z, abs(tf.e), tf.a)  # shortcut: stereographic scale (< 0.2% here) ignored in the slope
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    rows, cols = np.indices(z.shape)
    x, y = tf * (cols + 0.5, rows + 0.5)
    ok = (np.hypot(x - x0, y - y0) <= PICK_RADIUS_KM * 1e3) & (slope <= PICK_MAX_SLOPE_DEG)
    if not ok.any():  # else argmax would silently return pixel 0
        raise ValueError(f"no LOLA pixel within {PICK_RADIUS_KM:g} km of ({lat}, {lon}) has slope <= {PICK_MAX_SLOPE_DEG:g} deg")
    k = np.nanargmax(np.where(ok, z, -np.inf))
    plon, plat = TO_STEREO.transform(x.flat[k], y.flat[k], direction="INVERSE")
    return round(float(plat), 4), round(float(plon) % 360, 4)


@functools.cache  # precompute reads it for the horizon and for heightM: one DEM read, one value
def site_height_m(site_id: str) -> float:
    """Ground height (m above the 1737.4 km sphere) at the site, from the PGDA 5 m DEM, or from LOLA 120 m
    when the site has no PGDA tile in PGDA_SITE (a point picked on the point server)."""
    lat, lon = SITES[site_id]
    x0, y0 = TO_STEREO.transform(lon, lat)
    if site := PGDA_SITE.get(site_id):
        with rasterio.open(pgda.RAW / site / f"{site}_final_adj_5mpp_surf.tif") as ds:
            z, tf = ds.read(1).astype(np.float64), ds.transform
    else:
        z, tf = _lola(x0, y0, 1e3)
    h0 = _sample(z, tf, np.array([x0]), np.array([y0]))[0]
    if not np.isfinite(h0):
        raise ValueError(f"no {'PGDA' if site else 'LOLA'} height at {site_id}")
    return float(h0)


def horizon(site_id: str) -> dict[str, np.ndarray | float]:
    """Ray-cast the terrain horizon. Per azimuth k × AZ_STEP_DEG (from north, clockwise): elevation_deg, the
    distance_km and height error error_m of the terrain that sets it, near_field (PGDA vs LOLA). Also returns
    the site's ground height_m, the LOLA−PGDA height difference (bias_m, rms_m) where both have data, and the
    full ray profiles (ray_elevation_deg, azimuth × ray_distance_km) for checks."""
    lat, lon = np.radians(SITES[site_id])
    az = np.radians(np.arange(0, 360, AZ_STEP_DEG))[:, None]
    s_m = np.concatenate([np.arange(NEAR_STEP_M, NEAR_KM * 1e3, NEAR_STEP_M),
                          np.arange(NEAR_KM * 1e3, MAX_RANGE_KM * 1e3 + 1, FAR_STEP_M)])
    th = s_m[None, :] / R_M
    lat2 = np.arcsin(np.sin(lat) * np.cos(th) + np.cos(lat) * np.sin(th) * np.cos(az))
    lon2 = lon + np.arctan2(np.sin(az) * np.sin(th) * np.cos(lat), np.cos(th) - np.sin(lat) * np.sin(lat2))
    x, y = TO_STEREO.transform(np.degrees(lon2), np.degrees(lat2))
    x0, y0 = TO_STEREO.transform(np.degrees(lon), np.degrees(lat))

    if site := PGDA_SITE.get(site_id):
        with rasterio.open(pgda.RAW / site / f"{site}_final_adj_5mpp_surf.tif") as ds:
            h_near = _sample(ds.read(1).astype(np.float64), ds.transform, x, y)
        with rasterio.open(pgda.RAW / site / f"{site}_final_adj_5mpp_toterr.tif") as ds:
            toterr = _sample(ds.read(1).astype(np.float64), ds.transform, x, y)
    else:  # no 5 m tile: LOLA 120 m all the way in (horizon_block says so)
        h_near = toterr = np.full(x.shape, np.nan)
    h0 = site_height_m(site_id)
    h_far = _sample(*_lola(x0, y0, (MAX_RANGE_KM + 1) * 1e3), x, y)

    near = np.isfinite(h_near)
    el = elevation_deg(R_M + h0 + OBSERVER_HEIGHT_M, R_M + np.where(near, h_near, h_far), th)
    k = np.nanargmax(el, axis=1)
    i = np.arange(len(k))
    both = near & np.isfinite(h_far)
    diff = h_far[both] - h_near[both] if both.any() else np.array([np.nan])  # NaN, not a warning, with no tile
    rms = float(np.sqrt(np.mean(diff**2)))
    # PGDA's own RMS height error in the near field; LOLA-vs-PGDA RMS stands in for the 120 m DEM's error
    err = np.where(near[i, k], toterr[i, k], rms)
    return {"elevation_deg": el[i, k], "distance_km": s_m[k] / 1e3, "error_m": err, "near_field": near[i, k],
            "height_m": float(h0), "bias_m": float(diff.mean()), "rms_m": rms,
            "ray_elevation_deg": el, "ray_distance_km": s_m / 1e3}


def horizon_block(site_id: str) -> dict:
    """The `horizon` object of SiteData (docs/data-contracts.md), ready for data/precompute.py."""
    h = horizon(site_id)
    el, dist = h["elevation_deg"], h["distance_km"]
    assert len(el) == round(360 / AZ_STEP_DEG) and np.isfinite(el).all(), "horizon has gaps"
    if (site := PGDA_SITE.get(site_id)) is None:  # a picked point (data/point_server.py) off the downloaded tiles
        # shortcut: LOLA 120 m in the near field too, so nearby rocks and small rises are smoothed away; download
        # the PGDA tile around the point (data/pgda.py) when a point that matters needs the 5 m horizon.
        return {
            "azimuthStepDeg": AZ_STEP_DEG,
            "elevationDeg": np.round(el, 2).tolist(),
            "maxRangeKm": MAX_RANGE_KM,
            "demResolutionM": {"nearField": 120, "farField": 120},
            "source": {
                "source": "LOLA GDR LDEM_75S_120M (Smith et al. 2010)",
                "query": "LDEM_75S_120M.IMG",
                "url": "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/",
                "generatedAtUtc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "notes": (f"data/terrain.py: no downloaded PGDA 5 m tile covers this point, so LOLA 120 m is used "
                          f"from the site out: rays at {AZ_STEP_DEG} deg azimuth along great circles, "
                          f"{NEAR_STEP_M:g} m steps to {NEAR_KM:g} km, {FAR_STEP_M:g} m steps to {MAX_RANGE_KM:g} "
                          f"km, exact sphere geometry (curvature included). Observer {OBSERVER_HEIGHT_M:g} m above "
                          f"ground {h['height_m']:.1f} m (LOLA, bilinear). DEM is MOON_ME (DE421); the site lat/lon "
                          "is taken as the same frame as Horizons (risk R3)."),
            },
            "uncertainty": {
                "summary": ("LOLA 120 m only: features smaller than ~120 m, including those next to the antenna, "
                            "are smoothed away, and with no 5 m tile here there is no height-error estimate. "
                            "A nearby rock or rise can raise the true horizon above this one."),
                "magnitude": "unknown",
            },
        }
    err_deg = np.degrees(np.arctan2(h["error_m"], dist * 1e3))
    assert np.isfinite(err_deg).all(), "height error missing where the horizon is set"
    return {
        "azimuthStepDeg": AZ_STEP_DEG,
        "elevationDeg": np.round(el, 2).tolist(),
        "maxRangeKm": MAX_RANGE_KM,
        "demResolutionM": {"nearField": 5, "farField": 120},
        "source": {
            "source": f"PGDA LOLA 5 m/px DEM {site} (Barker et al. 2021) + LOLA GDR LDEM_75S_120M (Smith et al. 2010)",
            "query": f"{site}_final_adj_5mpp_surf.tif; LDEM_75S_120M.IMG",
            "url": "https://pgda.gsfc.nasa.gov/products/78 ; https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/",
            "generatedAtUtc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "notes": (f"data/terrain.py: rays at {AZ_STEP_DEG} deg azimuth along great circles, {NEAR_STEP_M:g} m "
                      f"steps to {NEAR_KM:g} km (PGDA where it has data), {FAR_STEP_M:g} m steps to "
                      f"{MAX_RANGE_KM:g} km (LOLA), exact sphere geometry (curvature included). Observer "
                      f"{OBSERVER_HEIGHT_M:g} m above ground {h['height_m']:.1f} m. DEMs are MOON_ME (DE421); "
                      "the site lat/lon is taken as the same frame as Horizons (risk R3)."),
        },
        "uncertainty": {
            "summary": ("Height error of the terrain that sets the horizon, divided by its distance: PGDA's own "
                        "RMS error (toterr) in the near field; in the far field the RMS of LOLA 120 m minus "
                        f"PGDA 5 m heights where both exist ({h['rms_m']:.1f} m, bias {h['bias_m']:+.1f} m). "
                        "Excludes features smaller than 120 m beyond the near field."),
            "magnitude": f"±{np.median(err_deg):.2g}° median, ±{err_deg.max():.2g}° worst azimuth",  # 2 sig. figs: never "0.00"
        },
    }


if __name__ == "__main__":
    # self-check: a point on the observer's own sphere sits at exactly -half the central angle
    assert np.isclose(elevation_deg(R_M, np.array(R_M), np.array(0.1)), -np.degrees(0.05))
    RAW.mkdir(parents=True, exist_ok=True)
    for site_id, center in REGION_CENTERS.items():  # G6: SITES must still be the rule's pick
        if highest_flat_point(*center) != SITES[site_id]:
            raise ValueError(f"{site_id}: SITES {SITES[site_id]} is not highest_flat_point{center} = {highest_flat_point(*center)}")
    for site_id in [*PGDA_SITE, *REGION_CENTERS]:
        block = horizon_block(site_id)
        out = RAW / f"{site_id}_horizon.json"
        out.write_text(json.dumps(block))
        el = np.array(block["elevationDeg"])
        print(f"{out}: {len(el)} az, {el.min():.2f}° to {el.max():.2f}°, {block['uncertainty']['magnitude']}")
