"""Moon-fixed geometry: positions → az/el/range from a site, and whether the Moon blocks a relay's view of Earth.

Frame: IAU Moon body-fixed, km from the Moon's center, x toward 0°E on the equator, z toward the north pole
(the frame of horizons.earth_moon_fixed()). The Moon is a sphere of MOON_RADIUS_KM, as in Horizons' lunar sites.

    uv run python -m data.geometry      # self-checks + Earth az/el vs Horizons at the P0 site
                                        # (needs the PGDA site DEM and cached Horizons tables in data/raw/)
"""

import numpy as np

from data.terrain import R_M

MOON_RADIUS_KM = R_M / 1e3  # one sphere for terrain horizons and topocentric angles


def _enu(lat_deg, lon_deg):
    """Local east, north, up unit vectors, shape lat.shape + (3,)."""
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    zero = np.zeros_like(lat)
    east = np.stack([-np.sin(lon), np.cos(lon), zero], -1)
    north = np.stack([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)], -1)
    up = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], -1)
    return east, north, up


def site_km(lat_deg, lon_deg, height_m) -> np.ndarray:
    """Moon-fixed position (km) of sites at height_m above the 1737.4 km sphere, shape lat.shape + (3,).
    Planetocentric lat, east-positive lon; scalars or arrays that broadcast together."""
    lat, lon, h = np.broadcast_arrays(*(np.asarray(v, float) for v in (lat_deg, lon_deg, height_m)))
    return _enu(lat, lon)[2] * (MOON_RADIUS_KM + h / 1e3)[..., None]


def topocentric(lat_deg, lon_deg, height_m, pos_km: np.ndarray):
    """Az (deg from north, clockwise), el (deg above the smooth local horizontal) and range (km) of Moon-fixed
    positions seen from one or many sites.

    lat_deg, lon_deg, height_m: scalars or arrays of site shape S (broadcast together). height_m is above the
    1737.4 km sphere: ground height (terrain.site_height_m, contract heightM) plus antenna height.
    pos_km: shape T + (3,), e.g. (n_times, 3). Returns arrays of shape T + S, e.g. (n_times, n_sites).
    """
    lat, lon, h = np.broadcast_arrays(*(np.asarray(v, float) for v in (lat_deg, lon_deg, height_m)))
    east, north, up = _enu(lat, lon)
    pos = np.asarray(pos_km, float)
    d = pos.reshape(pos.shape[:-1] + (1,) * lat.ndim + (3,)) - site_km(lat, lon, h)
    de, dn, du = ((d * v).sum(-1) for v in (east, north, up))
    az_deg = np.degrees(np.arctan2(de, dn)) % 360.0
    el_deg = np.degrees(np.arctan2(du, np.hypot(de, dn)))  # arctan2, not arcsin: no NaN at zenith
    return az_deg, el_deg, np.linalg.norm(d, axis=-1)


def sees_earth(relay_km: np.ndarray, earth_km: np.ndarray) -> np.ndarray:
    """1 where the straight line relay → Earth center misses the Moon's sphere, else 0 (uint8).

    Moon-fixed km, shape (..., 3): relay (n_times, 3) or (n_sats, n_times, 3) with Earth (n_times, 3) on the
    same time grid. Returns the broadcast shape without the last axis.
    """
    # shortcut: the Moon is a smooth 1737.4 km sphere and only Earth's center is tested, so a relay grazing over
    # the polar massifs (5-9 km above the sphere) counts as seeing Earth, and one seeing only Earth's limb counts
    # as blocked. Upgrade with a limb-terrain profile if a relay spends real time within ~0.3° of the lunar limb.
    relay, earth = np.asarray(relay_km, float), np.asarray(earth_km, float)
    try:
        relay, earth = np.broadcast_arrays(relay, earth)
    except ValueError:
        raise ValueError(f"relay {relay.shape} and Earth {earth.shape} are not on the same time grid") from None
    d = earth - relay
    # closest point to the Moon's center on the segment, clamped to the segment's ends
    t = np.clip(-(relay * d).sum(-1) / (d * d).sum(-1), 0.0, 1.0)
    miss_km = np.linalg.norm(relay + t[..., None] * d, axis=-1)
    return (miss_km > MOON_RADIUS_KM).astype(np.uint8)


if __name__ == "__main__":
    from data import terrain
    from data.horizons import (
        SITES,
        WINDOW,
        WINDOW_STEP,
        check_window_grid,
        earth_moon_fixed,
        observer_table,
    )
    from data.sites import P0_SITE

    # hand checks: real raises so `python -O` can't skip them, written so a NaN fails them
    def close(got, want, tol=1e-9) -> bool:
        return bool(np.allclose(got, want, rtol=0, atol=tol))

    earth = np.array([384400.0, 0.0, 0.0])
    cases = {"south of the pole, Earth on the equator": ([0, 0, -20000.0], 1),
             "behind the Moon from Earth": ([-5000.0, 0, 0], 0),
             "between Moon and Earth": ([5000.0, 0, 0], 1),
             # line parallel to x, passing 1 km above / below the limb
             "just above the limb": ([-5000.0, MOON_RADIUS_KM + 1, 0], 1),
             "just below the limb": ([-5000.0, MOON_RADIUS_KM - 1, 0], 0)}
    for name, (relay, want) in cases.items():
        target = earth + [0, relay[1], 0] if "limb" in name else earth
        if int(sees_earth(np.array(relay), target)) != want:
            raise ValueError(f"sees_earth wrong: {name}")
    sats = np.array([[[0, 0, -20000.0]] * 4, [[-5000.0, 0, 0]] * 4])  # (n_sats=2, n_times=4, 3)
    if not (sees_earth(sats, np.tile(earth, (4, 1))) == [[1] * 4, [0] * 4]).all():
        raise ValueError("sees_earth wrong for a 2-satellite config")
    try:
        sees_earth(np.zeros((5, 3)), np.tile(earth, (4, 1)))
        raise RuntimeError("sees_earth accepted relay and Earth arrays on different grids")
    except ValueError:
        pass

    overhead = np.array([0, 0, -MOON_RADIUS_KM - 100.0])
    az, el, rng = topocentric(-90.0, 0.0, 0.0, overhead)
    if not (close(el, 90.0) and close(rng, 100.0)):
        raise ValueError("topocentric: a point straight above the south pole is not at zenith")
    _, el, rng = topocentric(-90.0, 0.0, 2000.0, overhead)
    if not (close(el, 90.0) and close(rng, 98.0)):
        raise ValueError("topocentric: a site 2,000 m up is not 2 km closer to a point overhead")
    # nearly overhead, where arcsin(d·up / range) could round past 1 and give NaN
    _, el, _ = topocentric(-89.4632, 222.5104, 0.0, site_km(-89.4632, 222.5104, 0.0) * (1 + np.geomspace(1e-3, 10, 500))[:, None])
    if not close(el, 90.0, 1e-6):
        raise ValueError("topocentric: points straight overhead are not all at el 90°")
    az, el, _ = topocentric(0.0, 0.0, 0.0, np.array([MOON_RADIUS_KM, 100.0, 0]))  # due east on the horizon
    if not (close(az, 90.0) and close(el, 0.0)):
        raise ValueError("topocentric: a point due east is not at az 90°, el 0°")
    # a map of sites gives (n_times, n_sites), each column equal to that site computed alone
    rng_ = np.random.default_rng(0)
    lats, lons, hs = rng_.uniform(-90, -80, 7), rng_.uniform(0, 360, 7), rng_.uniform(-4000, 6000, 7)
    pts = rng_.normal(size=(50, 3)) * 8000
    many = topocentric(lats, lons, hs, pts)
    if many[0].shape != (50, 7):
        raise ValueError(f"topocentric: map of 7 sites gave shape {many[0].shape}, expected (50, 7)")
    for j in range(7):
        if not all(close(m[:, j], o) for m, o in zip(many, topocentric(lats[j], lons[j], hs[j], pts))):
            raise ValueError(f"topocentric: site {j} differs between map and single-site calls")
    print("hand checks pass")

    # board G3 "done when": Earth az/el from the Moon-fixed track matches Horizons' observer table to < 0.01°,
    # at the site's real height: PGDA ground + antenna, the observer terrain.py uses for the horizon
    lat, lon = SITES[P0_SITE]
    height_m = terrain.site_height_m(P0_SITE) + terrain.OBSERVER_HEIGHT_M
    track = earth_moon_fixed()
    ref = observer_table("earth", lat, lon, *WINDOW, WINDOW_STEP, alt_km=height_m / 1e3)
    check_window_grid(track)
    check_window_grid(ref)
    print(f"{P0_SITE} at height {height_m:.1f} m above the {MOON_RADIUS_KM} km sphere")
    az, el, rng = topocentric(lat, lon, height_m, track[["x_km", "y_km", "z_km"]].to_numpy())
    daz = np.abs((az - ref.az_deg.to_numpy() + 180.0) % 360.0 - 180.0)
    d_el = np.abs(el - ref.el_deg.to_numpy())
    # the gate is the angle between the two directions on the sky: az error scaled by cos(el), plus el error
    dsky = np.hypot(daz * np.cos(np.radians(el)), d_el)
    print(f"{P0_SITE}, {len(track)} samples: max sky separation {dsky.max():.4f} deg "
          f"(max |daz| {daz.max():.4f}, max |del| {d_el.max():.4f}), "
          f"max |drange| {np.abs(rng - ref.range_km.to_numpy()).max():.1f} km")
    if not (dsky < 0.01).all():
        raise ValueError("Earth direction from geometry.topocentric differs from Horizons by ≥ 0.01° (or is NaN)")
