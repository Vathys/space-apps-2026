"""Moon-fixed geometry: positions → az/el/range from a site, and whether the Moon blocks a relay's view of Earth.

Frame: IAU Moon body-fixed, km from the Moon's center, x toward 0°E on the equator, z toward the north pole
(the frame of horizons.earth_moon_fixed()). The Moon is a sphere of MOON_RADIUS_KM, as in Horizons' lunar sites.

    uv run python -m data.geometry      # self-checks + Earth az/el vs Horizons at the P0 site (cached, no network)
"""

import numpy as np

MOON_RADIUS_KM = 1737.4  # IAU mean radius; index.json moonRadiusKm, terrain.R_M


def _enu(lat_deg, lon_deg):
    """Local east, north, up unit vectors, shape lat.shape + (3,)."""
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    zero = np.zeros_like(lat)
    east = np.stack([-np.sin(lon), np.cos(lon), zero], -1)
    north = np.stack([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)], -1)
    up = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], -1)
    return east, north, up


def site_km(lat_deg, lon_deg, height_km) -> np.ndarray:
    """Moon-fixed position (km) of sites at height_km above the 1737.4 km sphere, shape lat.shape + (3,).
    Planetocentric lat, east-positive lon; scalars or arrays that broadcast together."""
    lat, lon, h = np.broadcast_arrays(*(np.asarray(v, float) for v in (lat_deg, lon_deg, height_km)))
    return _enu(lat, lon)[2] * (MOON_RADIUS_KM + h)[..., None]


def topocentric(lat_deg, lon_deg, height_km, pos_km: np.ndarray):
    """Az (deg from north, clockwise), el (deg above the smooth local horizontal) and range (km) of Moon-fixed
    positions seen from one or many sites.

    lat_deg, lon_deg, height_km: scalars or arrays of site shape S (broadcast together). height_km is above the
    1737.4 km sphere: DEM ground height plus antenna height (terrain.horizon() gives the ground height_m).
    pos_km: shape T + (3,), e.g. (n_times, 3). Returns arrays of shape T + S, e.g. (n_times, n_sites).
    """
    lat, lon, h = np.broadcast_arrays(*(np.asarray(v, float) for v in (lat_deg, lon_deg, height_km)))
    east, north, up = _enu(lat, lon)
    pos = np.asarray(pos_km, float)
    d = pos.reshape(pos.shape[:-1] + (1,) * lat.ndim + (3,)) - site_km(lat, lon, h)
    range_km = np.linalg.norm(d, axis=-1)
    az_deg = np.degrees(np.arctan2((d * east).sum(-1), (d * north).sum(-1))) % 360.0
    el_deg = np.degrees(np.arcsin((d * up).sum(-1) / range_km))
    return az_deg, el_deg, range_km


def sees_earth(relay_km: np.ndarray, earth_km: np.ndarray) -> np.ndarray:
    """1 where the straight line relay → Earth center misses the Moon's sphere, else 0 (uint8, per sample).

    Both arrays are Moon-fixed (N, 3) km on the same time grid. Earth's own disk is ignored: Earth's center is
    the test point, so a relay seeing only Earth's limb over the Moon counts as blocked.
    """
    relay, earth = np.atleast_2d(relay_km).astype(float), np.atleast_2d(earth_km).astype(float)
    d = earth - relay
    # closest point to the Moon's center on the segment, clamped to the segment's ends
    t = np.clip(-np.einsum("ij,ij->i", relay, d) / np.einsum("ij,ij->i", d, d), 0.0, 1.0)
    miss_km = np.linalg.norm(relay + t[:, None] * d, axis=1)
    return (miss_km > MOON_RADIUS_KM).astype(np.uint8)


if __name__ == "__main__":
    from data import terrain
    from data.horizons import (
        SITES,
        WINDOW,
        WINDOW_STEP,
        earth_moon_fixed,
        observer_table,
    )
    from data.sites import P0_SITE

    # hand checks, real raises so `python -O` can't skip them
    earth = np.array([384400.0, 0.0, 0.0])
    cases = {"south of the pole, Earth on the equator": ([0, 0, -20000.0], 1),
             "behind the Moon from Earth": ([-5000.0, 0, 0], 0),
             "between Moon and Earth": ([5000.0, 0, 0], 1),
             # line parallel to x, passing 1 km above / below the limb
             "just above the limb": ([-5000.0, MOON_RADIUS_KM + 1, 0], 1),
             "just below the limb": ([-5000.0, MOON_RADIUS_KM - 1, 0], 0)}
    for name, (relay, want) in cases.items():
        target = earth + [0, relay[1], 0] if "limb" in name else earth
        if sees_earth(np.array(relay), target)[0] != want:
            raise ValueError(f"sees_earth wrong: {name}")
    az, el, rng = topocentric(-90.0, 0.0, 0.0, np.array([0, 0, -MOON_RADIUS_KM - 100.0]))
    if abs(el - 90.0) > 1e-9 or abs(rng - 100.0) > 1e-9:
        raise ValueError("topocentric: a point straight above the south pole is not at zenith")
    az, el, rng = topocentric(-90.0, 0.0, 2.0, np.array([0, 0, -MOON_RADIUS_KM - 100.0]))
    if abs(rng - 98.0) > 1e-9:
        raise ValueError("topocentric: a site 2 km up is not 2 km closer to a point overhead")
    az, el, _ = topocentric(0.0, 0.0, 0.0, np.array([MOON_RADIUS_KM, 100.0, 0]))  # due east on the horizon
    if abs(az - 90.0) > 1e-9 or abs(el) > 1e-9:
        raise ValueError("topocentric: a point due east is not at az 90°, el 0°")
    # a map of sites gives (n_times, n_sites), each column equal to that site computed alone
    rng_ = np.random.default_rng(0)
    lats, lons, hs = rng_.uniform(-90, -80, 7), rng_.uniform(0, 360, 7), rng_.uniform(-4, 6, 7)
    pts = rng_.normal(size=(50, 3)) * 8000
    many = topocentric(lats, lons, hs, pts)
    if many[0].shape != (50, 7):
        raise ValueError(f"topocentric: map of 7 sites gave shape {many[0].shape}, expected (50, 7)")
    for j in range(7):
        one = topocentric(lats[j], lons[j], hs[j], pts)
        if any(np.abs(m[:, j] - o).max() > 1e-9 for m, o in zip(many, one)):
            raise ValueError(f"topocentric: site {j} differs between map and single-site calls")
    print("hand checks pass")

    # board G3 "done when": Earth az/el from the Moon-fixed track matches Horizons' observer table to < 0.01°
    # at the site's real height: PGDA ground + antenna, the observer terrain.py uses for the horizon
    lat, lon = SITES[P0_SITE]
    height_km = (terrain.horizon(P0_SITE)["height_m"] + terrain.OBSERVER_HEIGHT_M) / 1e3
    track = earth_moon_fixed()
    ref = observer_table("earth", lat, lon, *WINDOW, WINDOW_STEP, alt_km=height_km)
    if not track.time_utc.equals(ref.time_utc):
        raise ValueError("track and observer table are on different grids")
    print(f"{P0_SITE} at height {height_km * 1e3:.1f} m above the {MOON_RADIUS_KM} km sphere")
    az, el, rng = topocentric(lat, lon, height_km, track[["x_km", "y_km", "z_km"]].to_numpy())
    daz = np.abs((az - ref.az_deg.to_numpy() + 180.0) % 360.0 - 180.0)
    # az error matters only as a direction: scale by cos(el) so it compares with el error on the sky
    dsky = np.hypot(daz * np.cos(np.radians(el)), el - ref.el_deg.to_numpy())
    print(f"{P0_SITE}, {len(track)} samples: max |daz| {daz.max():.4f}°, max |del| "
          f"{np.abs(el - ref.el_deg.to_numpy()).max():.4f}°, max sky separation {dsky.max():.4f}°, "
          f"max |drange| {np.abs(rng - ref.range_km.to_numpy()).max():.1f} km")
    if daz.max() >= 0.01 or np.abs(el - ref.el_deg.to_numpy()).max() >= 0.01:
        raise ValueError("Earth az/el from geometry.topocentric differs from Horizons by ≥ 0.01°")
