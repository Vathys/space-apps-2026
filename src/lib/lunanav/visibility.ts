// Terrain-aware visibility per sample (CLAUDE.md §3: pure, no React/fetch).
// Feeds network.ts: dte and landerSeesSat come from aboveTerrain, sunlitFraction from sunlitFraction.
// Callers pass the scenario slice of the file series; data.ts has already checked the shapes.

import type { HorizonProfile } from "./types";

// Terrain horizon elevation at any azimuth, linear between the profile's samples.
// The last sample (360° − step) interpolates into the first (0°), so north is seamless.
export function horizonElevationDeg(profile: HorizonProfile, azimuthDeg: number): number {
  const h = profile.elevationDeg;
  const x = (((azimuthDeg % 360) + 360) % 360) / profile.azimuthStepDeg;
  const k = Math.floor(x);
  const t = x - k;
  const value = h[k % h.length] * (1 - t) + h[(k + 1) % h.length] * t;
  // A NaN here would silently read as "not visible": fail loudly instead (CLAUDE.md §5).
  if (!Number.isFinite(value)) {
    throw new Error(`horizonElevationDeg: no horizon value at azimuth ${azimuthDeg}°`);
  }
  return value;
}

// 1 where the target's centre is above the terrain horizon plus the link mask (D-17), else 0.
// Geometric line-of-sight only. Used for Earth (DTE) and for each relay satellite.
export function aboveTerrain(
  profile: HorizonProfile,
  azimuthDeg: ArrayLike<number>,
  elevationDeg: ArrayLike<number>,
  minElevationDeg: number,
): Uint8Array {
  const n = azimuthDeg.length;
  if (elevationDeg.length !== n) {
    throw new Error(`aboveTerrain: length mismatch: azimuth ${n}, elevation ${elevationDeg.length}`);
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(elevationDeg[i])) {
      throw new Error(`aboveTerrain: elevation[${i}] = ${elevationDeg[i]} is not a number`);
    }
    out[i] = elevationDeg[i] >horizonElevationDeg(profile, azimuthDeg[i]) + minElevationDeg ? 1 : 0;
  }
  return out;
}

// Fraction (0..1) of the Sun's disk above the terrain horizon. No link mask: sunlight is terrain only.
// shortcut: horizon taken as flat across the 0.53° disk (one value at the Sun's azimuth), so a steep
// ridge edge cutting the disk at an angle is approximated; upgrade to per-strip horizon if it matters.
export function sunlitFraction(
  profile: HorizonProfile,
  azimuthDeg: ArrayLike<number>,
  elevationDeg: ArrayLike<number>,
  angularRadiusDeg: number,
): Float32Array {
  const n = azimuthDeg.length;
  if (elevationDeg.length !== n) {
    throw new Error(`sunlitFraction: length mismatch: azimuth ${n}, elevation ${elevationDeg.length}`);
  }
  if (!(angularRadiusDeg > 0)) {
    throw new Error(`sunlitFraction: angular radius ${angularRadiusDeg}° must be > 0`);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // d: height of the disk centre above the horizon, in Sun radii.
    const d = Math.max(-1, Math.min(1, (elevationDeg[i] - horizonElevationDeg(profile, azimuthDeg[i])) / angularRadiusDeg));
    // Circular-segment area below the horizon line, as a fraction of the disk, subtracted from 1.
    out[i] = 1 - (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI;
  }
  return out;
}
