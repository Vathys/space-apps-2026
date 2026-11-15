"""Relay orbits: two-body Kepler propagation of relay configs → Moon-fixed positions over the supported window.

P0 config `lcrns-ref-5sat` = NASA LCRNS reference constellation v3.1, SV-1…SV-5 from `relay_orbits.csv` (D-19).
P1 configs (N5): `lcrns-ref-1sat` (SV-1 only) and `lunar-pathfinder` (SSTL baseline orbit; its epoch, frame, RAAN
and phase are assumed, the service guide gives none).
Elements are in the Moon principal-axis frame frozen at J2000, which we take as the IAU Moon body frame at J2000
(agrees within 0.03°, D-19). Positions are propagated in that frozen (inertial) frame and rotated to Moon-fixed
(IAU Moon body frame at each sample, the frame Horizons and geometry.py use) with the IAU 2015 rotation model.

    uv run python -m data.relays      # checks vs the published ICRF states + a Horizons rotation check,
                                      # then writes data/raw/relays/<config>.npz for inspection
"""

import csv
from pathlib import Path

import numpy as np
import pandas as pd

ORBITS_CSV = Path(__file__).parent / "relay_orbits.csv"
RAW = Path(__file__).parent / "raw" / "relays"
MU_MOON_KM3_S2 = 4902.8  # GM of the Moon (DE440: 4902.800 km³/s²)

# config id -> satellites (the `satellite` column of relay_orbits.csv). P0: lcrns-ref-5sat; P1 (N5): the others.
CONFIGS = {
    "lcrns-ref-5sat": ["LCRNS SV-1", "LCRNS SV-2", "LCRNS SV-3", "LCRNS SV-4", "LCRNS SV-5"],
    "lcrns-ref-1sat": ["LCRNS SV-1"],
    "lunar-pathfinder": ["Lunar Pathfinder"],
}

# D-19: the LCRNS frame epoch is J2000 = 2000-01-01 12:00 TT, which is 11:58:55.816 UTC (the contract stores it so).
J2000_FRAME_UTC = "2000-01-01T11:58:55.816Z"
# shortcut: the elements' Moon PA frame at J2000 is used as the IAU Moon body frame at J2000; they differ by
# ~0.03° (D-19), up to ~10 km at apolune. Upgrade with the PA→IAU rotation if a result sits that close to an edge.
FRAME_LABEL = "Moon PA at J2000 (≈ IAU Moon body frame at J2000, within 0.03°)"
# relay_orbits.csv frame_epoch_utc -> (contract frame label, contract frameEpochUtc). Only these frames are handled.
FRAMES = {
    "2000-01-01 11:58:55.816": (FRAME_LABEL, J2000_FRAME_UTC),
    # Lunar Pathfinder: the SSTL service guide gives no frame or epoch, so both are assumed (D-19).
    "2027-03-01 00:00:00": ("IAU Moon body frame at 2027-03-01 00:00 UTC (ASSUMED: the source gives no frame)",
                            "2027-03-01T00:00:00Z"),
}
# shortcut: LCRNS v3.1 is a government reference design, not the final constellation (Intuitive Machines picks the
# final one) and not deployed in the window. Every relay result is "if this reference design were in place".
# shortcut: TT − UTC fixed at 69.184 s (37 leap seconds since 2017). Right unless IERS adds a leap second before
# 2027-04; a 1 s error moves the Moon's rotation by 0.00015°, so it doesn't matter at this accuracy.
TT_MINUS_UTC_S = 69.184


def grid_utc(grid: dict) -> pd.DatetimeIndex:
    """Sample times (UTC) of a contract `TimeGrid` {startUtc, stepSeconds, count}, e.g. precompute.window_grid()."""
    start = pd.Timestamp(grid["startUtc"])
    if start.tzinfo is None or start.utcoffset() != pd.Timedelta(0):
        raise ValueError(f"grid startUtc {grid['startUtc']!r} is not UTC")
    return pd.date_range(start, periods=int(grid["count"]), freq=pd.Timedelta(seconds=grid["stepSeconds"]))


def _days_since_j2000_tdb(times_utc: pd.DatetimeIndex) -> np.ndarray:
    # shortcut: TDB taken as TT (they differ by < 2 ms).
    # J2000 is 2000-01-01 12:00 TT. Convert each sample to TT (UTC + TT_MINUS_UTC_S), then subtract the J2000 TT
    # label. TT has no leap seconds, so the label difference is the elapsed time.
    j2000_label = pd.Timestamp("2000-01-01 12:00:00", tz="UTC")
    return ((times_utc - j2000_label).total_seconds().to_numpy() + TT_MINUS_UTC_S) / 86400.0


def iau_moon_rotation(d_tdb: np.ndarray) -> np.ndarray:
    """ICRF → IAU Moon body-fixed rotation matrices, shape (N, 3, 3), at d_tdb days since J2000 TDB.

    IAU WGCCRE 2015 lunar model (Archinal et al. 2018, Celest. Mech. Dyn. Astr. 130:22, Table 2), the model
    Horizons uses for the Moon's body frame. R = Rz(W) · Rx(90° − δ0) · Rz(90° + α0).
    """
    d = np.atleast_1d(np.asarray(d_tdb, float))
    T = d / 36525.0
    E = np.radians(np.array([
        125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d,
        357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d, 134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d,
        34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d,
        25.053 + 12.9590088 * d,
    ]))  # E1…E13, shape (13, N)
    s, c = np.sin(E), np.cos(E)
    ra = (269.9949 + 0.0031 * T - 3.8787 * s[0] - 0.1204 * s[1] + 0.0700 * s[2] - 0.0172 * s[3]
          + 0.0072 * s[5] - 0.0052 * s[9] + 0.0043 * s[12])
    dec = (66.5392 + 0.0130 * T + 1.5419 * c[0] + 0.0239 * c[1] - 0.0278 * c[2] + 0.0068 * c[3]
           - 0.0029 * c[5] + 0.0009 * c[6] + 0.0008 * c[9] - 0.0009 * c[12])
    w = (38.3213 + 13.17635815 * d - 1.4e-12 * d**2 + 3.5610 * s[0] + 0.1208 * s[1] - 0.0642 * s[2]
         + 0.0158 * s[3] + 0.0252 * s[4] - 0.0066 * s[5] - 0.0047 * s[6] - 0.0046 * s[7] + 0.0028 * s[8]
         + 0.0052 * s[9] + 0.0040 * s[10] + 0.0019 * s[11] - 0.0044 * s[12])
    return _rz(np.radians(w)) @ _rx(np.radians(90.0 - dec)) @ _rz(np.radians(90.0 + ra))


def _rz(a: np.ndarray) -> np.ndarray:
    """Frame rotation about z by a (rad): coordinates in the rotated frame = R @ coordinates. Shape a.shape + (3, 3)."""
    a = np.asarray(a, float)
    c, s, z, o = np.cos(a), np.sin(a), np.zeros_like(a), np.ones_like(a)
    return np.stack([np.stack([c, s, z], -1), np.stack([-s, c, z], -1), np.stack([z, z, o], -1)], -2)


def _rx(a: np.ndarray) -> np.ndarray:
    a = np.asarray(a, float)
    c, s, z, o = np.cos(a), np.sin(a), np.zeros_like(a), np.ones_like(a)
    return np.stack([np.stack([o, z, z], -1), np.stack([z, c, s], -1), np.stack([z, -s, c], -1)], -2)


def frozen_to_icrf(frame_epoch_utc: str = J2000_FRAME_UTC) -> np.ndarray:
    """Frozen frame (IAU Moon body frame at frame_epoch_utc, a contract frameEpochUtc) → ICRF, (3, 3).
    A function, so importing computes nothing."""
    if frame_epoch_utc == J2000_FRAME_UTC:
        d = np.array([0.0])  # J2000 exactly (TT − UTC was 64.184 s then, not TT_MINUS_UTC_S)
    else:
        d = _days_since_j2000_tdb(pd.DatetimeIndex([pd.Timestamp(frame_epoch_utc)]))
    return iau_moon_rotation(d)[0].T


def load_elements(config_id: str) -> list[dict]:
    """The config's satellites with their published elements, as the contract's `KeplerElements` (D-19)."""
    with ORBITS_CSV.open(newline="", encoding="utf-8") as f:
        rows = {r["satellite"]: r for r in csv.DictReader(f)}
    sats = []
    for name in CONFIGS[config_id]:
        r = rows[name]
        if r["frame_epoch_utc"] not in FRAMES:
            raise ValueError(f"{name}: frame epoch {r['frame_epoch_utc']} is not one of FRAMES")
        frame, frame_epoch_utc = FRAMES[r["frame_epoch_utc"]]
        published = r["icrf_x_km"] != ""  # Lunar Pathfinder has elements only, no published state
        sats.append({
            # "LCRNS SV-1" -> "sv1", "Lunar Pathfinder" -> "lunar-pathfinder"
            "id": name.lower().replace("lcrns ", "").replace("-", "").replace(" ", "-"),
            "name": name,
            "elements": {
                "aKm": float(r["a_km"]), "e": float(r["e"]), "iDeg": float(r["i_deg"]),
                "argpDeg": float(r["argp_deg"]), "raanDeg": float(r["raan_deg"]),
                "trueAnomalyDeg": float(r["ta_deg"]),
                "epochUtc": pd.Timestamp(r["epoch_utc"], tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
                "frame": frame, "frameEpochUtc": frame_epoch_utc,
            },
            "publishedIcrfKm": np.array([float(r[f"icrf_{k}_km"]) for k in "xyz"]) if published else None,
            "publishedIcrfKmS": np.array([float(r[f"icrf_v{k}_km_s"]) for k in "xyz"]) if published else None,
            "source": r["source"],
        })
    return sats


def _solve_kepler(m_rad: np.ndarray, e: float) -> np.ndarray:
    """Eccentric anomaly E from mean anomaly M (Newton). Start at M + 0.85·e·sign(sin M) (Danby), which converges
    for every M at e ≈ 0.69, where starting at E = M can be slow near perilune."""
    m = np.mod(m_rad, 2 * np.pi)
    ecc = m + 0.85 * e * np.sign(np.sin(m))
    for _ in range(50):
        step = (ecc - e * np.sin(ecc) - m) / (1 - e * np.cos(ecc))
        ecc = ecc - step
        if np.abs(step).max() < 1e-12:
            return ecc
    raise RuntimeError("Kepler solver did not converge in 50 iterations")


def propagate(el: dict, times_utc: pd.DatetimeIndex) -> tuple[np.ndarray, np.ndarray]:
    """Position (km) and velocity (km/s), shape (N, 3) each, in the frozen J2000 frame of the elements."""
    # shortcut: two-body Kepler only, no lunar gravity field (J2, mascons) and no Earth/Sun pull. Over the
    # window's ±2 months from epoch a real frozen orbit drifts; upgrade to a numerical propagator (or published
    # ephemerides) if a result depends on a satellite's exact position weeks from 2027-03-01.
    a, e = el["aKm"], el["e"]
    nu0 = np.radians(el["trueAnomalyDeg"])
    e0 = 2 * np.arctan2(np.sqrt(1 - e) * np.sin(nu0 / 2), np.sqrt(1 + e) * np.cos(nu0 / 2))  # TA → E
    m0 = e0 - e * np.sin(e0)  # E → M at epoch
    n_rad_s = np.sqrt(MU_MOON_KM3_S2 / a**3)
    t_s = (times_utc - pd.Timestamp(el["epochUtc"])).total_seconds().to_numpy()  # negative before the epoch
    ecc = _solve_kepler(m0 + n_rad_s * t_s, e)
    nu = 2 * np.arctan2(np.sqrt(1 + e) * np.sin(ecc / 2), np.sqrt(1 - e) * np.cos(ecc / 2))
    r_km = a * (1 - e * np.cos(ecc))
    p_km = a * (1 - e**2)
    h = np.sqrt(MU_MOON_KM3_S2 * p_km)
    pos_pf = np.stack([r_km * np.cos(nu), r_km * np.sin(nu), np.zeros_like(nu)], -1)
    vel_pf = np.stack([-MU_MOON_KM3_S2 / h * np.sin(nu), MU_MOON_KM3_S2 / h * (e + np.cos(nu)), np.zeros_like(nu)], -1)
    # perifocal → frame: R3(−Ω)·R1(−i)·R3(−ω), i.e. the transpose of the frame rotations
    q = (_rz(np.radians(el["argpDeg"])) @ _rx(np.radians(el["iDeg"])) @ _rz(np.radians(el["raanDeg"]))).T
    return pos_pf @ q.T, vel_pf @ q.T


def to_moon_fixed(r_frozen_km: np.ndarray, times_utc: pd.DatetimeIndex, frame_epoch_utc: str) -> np.ndarray:
    """Frozen frame (Moon body frame at frame_epoch_utc) → IAU Moon body-fixed at each sample (km), shape (N, 3)."""
    r_icrf_km = r_frozen_km @ frozen_to_icrf(frame_epoch_utc).T
    rot = iau_moon_rotation(_days_since_j2000_tdb(times_utc))
    return np.einsum("nij,nj->ni", rot, r_icrf_km)


def config_positions(config_id: str, grid: dict) -> dict[str, np.ndarray]:
    """Satellite id → Moon-fixed position (grid count, 3) km on the given `TimeGrid` (pass index.json's window).

    Site-independent and deterministic (no network, no writes, no randomness): compute once per config and
    reuse for every site (N6, point server G7). Reads only data/relay_orbits.csv.
    """
    times = grid_utc(grid)
    return {s["id"]: to_moon_fixed(propagate(s["elements"], times)[0], times, s["elements"]["frameEpochUtc"])
            for s in load_elements(config_id)}


def check_epoch_states(config_id: str, tol_km: float = 10.0) -> dict[str, float]:
    """Raise unless each satellite's elements, rebuilt to ICRF at the epoch, land within tol_km of the published
    state in relay_orbits.csv (board N1). Network-free: precompute (N4 part C) calls it before writing relay files,
    so an edit to propagate() or iau_moon_rotation() that breaks the orbits fails the data build.
    Satellites with no published state (Lunar Pathfinder) are skipped: nothing to check against.
    Returns satellite id → position difference (km)."""
    out = {}
    for s in load_elements(config_id):
        if s["publishedIcrfKm"] is None:
            continue
        icrf = frozen_to_icrf(s["elements"]["frameEpochUtc"])
        epoch = pd.DatetimeIndex([pd.Timestamp(s["elements"]["epochUtc"])])
        r_km, _ = propagate(s["elements"], epoch)
        out[s["id"]] = dr_km = float(np.linalg.norm(r_km[0] @ icrf.T - s["publishedIcrfKm"]))
        if not dr_km < tol_km:  # real raise, not assert: `python -O` must not skip it; a NaN fails it too
            raise ValueError(f"{s['name']}: rebuilt ICRF state is {dr_km:.1f} km from the published one (> {tol_km} km)")
    return out


_LCRNS_TEXT = (
    "Simulated reference configuration, not an operational constellation: NASA LCRNS reference constellation v3.1 "
    "is a government reference design (Intuitive Machines chooses the final one) and is not deployed in this window. "
    "Two-body Kepler propagation from the published 2027-03-01 elements (no lunar gravity field or Earth/Sun pull), "
    "so positions drift from a real orbit with distance from the epoch; size of the drift unknown. "
    "Moon PA frame at J2000 taken as the IAU body frame (~0.03° apart); rotation to Moon-fixed by the IAU 2015 model "
    "with TT − UTC fixed at 69.184 s and TDB taken as TT (both negligible here). "
    "Epoch 2027-03-01 00:00 read as UTC; if the published epoch is TDB, positions shift 69 s along the orbit."
)
# config id -> text read by precompute (N4 part C) into each relay file's SatelliteSeries.uncertainty.summary.
UNCERTAINTY_TEXT = {
    "lcrns-ref-5sat": _LCRNS_TEXT,
    "lcrns-ref-1sat": (
        _LCRNS_TEXT + " This config keeps only SV-1 of the five, to show what one relay gives against the full "
        "reference constellation; a one-satellite LCRNS is not a planned deployment either."
    ),
    "lunar-pathfinder": (
        "Simulated reference configuration, not an operational relay: ESA/SSTL Lunar Pathfinder's indicative baseline "
        "orbit from the SSTL service guide v2.3 sec. 3.4.3 (a 5740 km, e 0.58, i 54.856°, argp 86.322°, ~10.8 h), "
        "planned for 2027 and not in orbit as of 2026-11. The guide gives no epoch, frame, RAAN or phase, so all are "
        "ASSUMED: epoch 2027-03-01 00:00 UTC, the IAU Moon body frame at that epoch, RAAN 0° and true anomaly 0° there. "
        "Where the orbit plane sits and when the satellite passes over the site are therefore illustrative only, and "
        "so is the timing of every relay pass and blackout. No published state to check the propagation against. "
        "Two-body Kepler propagation (no lunar gravity field or Earth/Sun pull), so positions drift from a real orbit "
        "with distance from the epoch; size of the drift unknown. Rotation to Moon-fixed by the IAU 2015 model."
    ),
}
if UNCERTAINTY_TEXT.keys() != CONFIGS.keys():
    raise ValueError("every relay config needs an UNCERTAINTY_TEXT entry")


if __name__ == "__main__":
    from data.horizons import (
        WINDOW,
        WINDOW_SAMPLES,
        WINDOW_STEP,
        _base,
        _ephemeris,
        check_window_grid,
        earth_moon_fixed,
    )
    from data.precompute import window_grid

    grid = window_grid()
    times = grid_utc(grid)
    if len(times) != WINDOW_SAMPLES or times[-1] != pd.Timestamp(WINDOW[1], tz="UTC"):
        raise ValueError(f"grid {grid} is not the {WINDOW} window")
    sats = load_elements("lcrns-ref-5sat")
    icrf = frozen_to_icrf()

    # 1. at the epoch, elements rebuilt to ICRF reproduce the published states (board N1: ≲ 10 km)
    dr_km = check_epoch_states("lcrns-ref-5sat")
    for s in sats:
        epoch = pd.DatetimeIndex([pd.Timestamp(s["elements"]["epochUtc"])])
        dv = np.linalg.norm(propagate(s["elements"], epoch)[1][0] @ icrf.T - s["publishedIcrfKmS"]) * 1e3
        print(f"{s['name']}: epoch ICRF position off by {dr_km[s['id']]:.2f} km, velocity by {dv:.2f} m/s")

    # 2. the IAU rotation over the whole window: Earth's ICRF direction from the Moon (Horizons astrometric RA/Dec),
    # rotated with iau_moon_rotation, vs Horizons' own Moon-fixed sub-Earth point. Both cached in raw/horizons/.
    radec = _ephemeris(_base(*WINDOW, WINDOW_STEP) | {"COMMAND": "'399'", "CENTER": "'500@301'", "QUANTITIES": "'1,20'"})
    track = earth_moon_fixed()
    # rows must be the same instants: Earth's Moon-fixed direction moves only ~0.004° per 10 min, so a one-row
    # shift between the two tables would still pass the 0.02° gate
    check_window_grid(radec)
    check_window_grid(track)
    ra_col, dec_col = (c for c in radec.columns if c.startswith(("R.A.", "DEC")))
    ra, dec = np.radians(radec[ra_col].to_numpy(float)), np.radians(radec[dec_col].to_numpy(float))
    u_icrf = np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], -1)
    u_mine = np.einsum("nij,nj->ni", iau_moon_rotation(_days_since_j2000_tdb(times)), u_icrf)
    earth = track[["x_km", "y_km", "z_km"]].to_numpy()
    u_hz = earth / np.linalg.norm(earth, axis=1, keepdims=True)
    sep_deg = np.degrees(np.arccos(np.clip((u_mine * u_hz).sum(1), -1, 1)))
    print(f"IAU rotation vs Horizons Moon-fixed Earth direction, {len(times)} samples: "
          f"max {sep_deg.max():.4f}°, median {np.median(sep_deg):.4f}°")
    # The two aren't the same quantity: astrometric RA/Dec vs Horizons' apparent sub-Earth point (aberration ~20",
    # 0.006°). Measured: max 0.014°, i.e. ~5 km at apolune. The extra ~0.008° beyond aberration isn't
    # explained; it is small next to the two-body drift.
    if not sep_deg.max() < 0.02:
        raise ValueError(f"IAU Moon rotation differs from Horizons by {sep_deg.max():.4f}° (≥ 0.02°)")

    # 3. per satellite of every config over the window: sample count, radius bounds, period, apolune over the
    # south pole. LCRNS orbits are ~30 h; Lunar Pathfinder's ~10.84 h (relays.csv).
    pos = {c: config_positions(c, grid) for c in CONFIGS}
    step_s = grid["stepSeconds"]
    for s in {s["id"]: s for c in CONFIGS for s in load_elements(c)}.values():
        el = s["elements"]
        r_mf = next(p[s["id"]] for p in pos.values() if s["id"] in p)
        period_lo_h, period_hi_h = (29.0, 31.0) if s["name"].startswith("LCRNS") else (10.7, 11.0)
        rad = np.linalg.norm(r_mf, axis=1)
        rp, ra_km = el["aKm"] * (1 - el["e"]), el["aKm"] * (1 + el["e"])
        period_h = 2 * np.pi * np.sqrt(el["aKm"] ** 3 / MU_MOON_KM3_S2) / 3600
        # apolune samples: local maxima of radius; their spacing gives the period from the samples
        peaks = np.flatnonzero((rad[1:-1] > rad[:-2]) & (rad[1:-1] >= rad[2:])) + 1
        sampled_period_h = np.diff(peaks).mean() * step_s / 3600
        print(f"{s['id']}: {len(r_mf)} samples, |r| {rad.min():.1f}–{rad.max():.1f} km "
              f"(perilune {rp:.1f}, apolune {ra_km:.1f}), period {period_h:.2f} h (sampled {sampled_period_h:.2f} h), "
              f"{len(peaks)} apolunes, z there {r_mf[peaks, 2].min():.0f} to {r_mf[peaks, 2].max():.0f} km")
        if len(r_mf) != WINDOW_SAMPLES:
            raise ValueError(f"{s['id']}: {len(r_mf)} positions, expected {WINDOW_SAMPLES}")
        if not (rad.min() >= rp - 0.1 and rad.max() <= ra_km + 0.1):
            raise ValueError(f"{s['id']}: radius leaves [perilune, apolune]")
        if not period_lo_h < period_h < period_hi_h:
            raise ValueError(f"{s['id']}: period {period_h:.2f} h is not in {period_lo_h}–{period_hi_h} h")
        if not (r_mf[peaks, 2] < 0).all():
            raise ValueError(f"{s['id']}: an apolune is not over the southern hemisphere (z ≥ 0)")
    # SV-1 is the same satellite in both LCRNS configs: same positions, or the 1-vs-5 comparison is unfair
    if not np.array_equal(pos["lcrns-ref-1sat"]["sv1"], pos["lcrns-ref-5sat"]["sv1"]):
        raise ValueError("sv1 differs between lcrns-ref-1sat and lcrns-ref-5sat")

    RAW.mkdir(parents=True, exist_ok=True)
    for config_id, config_pos in pos.items():
        out = RAW / f"{config_id}.npz"
        np.savez(out, time_utc=times.strftime("%Y-%m-%dT%H:%M:%SZ").to_numpy().astype("U20"), **config_pos)
        print(out)
