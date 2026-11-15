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


@functools.cache  # precompute reads it for the horizon and for heightM: one DEM read, one value
def site_height_m(site_id: str) -> float:
    """Ground height (m above the 1737.4 km sphere) at the site, from the PGDA 5 m DEM."""
    lat, lon = SITES[site_id]
    x0, y0 = TO_STEREO.transform(lon, lat)
    site = PGDA_SITE[site_id]
    with rasterio.open(pgda.RAW / site / f"{site}_final_adj_5mpp_surf.tif") as ds:
        h0 = _sample(ds.read(1).astype(np.float64), ds.transform, np.array([x0]), np.array([y0]))[0]
    if not np.isfinite(h0):
        raise ValueError(f"no PGDA height at {site_id}")
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

    site = PGDA_SITE[site_id]
    with rasterio.open(pgda.RAW / site / f"{site}_final_adj_5mpp_surf.tif") as ds:
        z, tf = ds.read(1).astype(np.float64), ds.transform
    h_near = _sample(z, tf, x, y)
    h0 = site_height_m(site_id)
    with rasterio.open(pgda.RAW / site / f"{site}_final_adj_5mpp_toterr.tif") as ds:
        toterr = _sample(ds.read(1).astype(np.float64), ds.transform, x, y)
    with rasterio.open(lola.RAW / "LDEM_75S_120M.LBL") as ds:
        pad = (MAX_RANGE_KM + 1) * 1e3
        win = from_bounds(x0 - pad, y0 - pad, x0 + pad, y0 + pad, ds.transform).round_offsets().round_lengths()
        dn = ds.read(1, window=win)
        z = np.where(dn == ds.nodata, np.nan, dn * ds.scales[0])  # height (m) above the 1737.4 km sphere
        h_far = _sample(z, ds.window_transform(win), x, y)

    near = np.isfinite(h_near)
    el = elevation_deg(R_M + h0 + OBSERVER_HEIGHT_M, R_M + np.where(near, h_near, h_far), th)
    k = np.nanargmax(el, axis=1)
    i = np.arange(len(k))
    both = near & np.isfinite(h_far)
    diff = h_far[both] - h_near[both]
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
    err_deg = np.degrees(np.arctan2(h["error_m"], dist * 1e3))
    assert np.isfinite(err_deg).all(), "height error missing where the horizon is set"
    site = PGDA_SITE[site_id]
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
    for site_id in PGDA_SITE:
        block = horizon_block(site_id)
        out = RAW / f"{site_id}_horizon.json"
        out.write_text(json.dumps(block))
        el = np.array(block["elevationDeg"])
        print(f"{out}: {len(el)} az, {el.min():.2f}° to {el.max():.2f}°, {block['uncertainty']['magnitude']}")
