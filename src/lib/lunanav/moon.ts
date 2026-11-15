// Geometry for the 3D Moon first look (D-21). Pure: no React, no three.js. Positions come from index.json (sites)
// and the site file (Sun/Earth az/el); nothing here computes a result.
export const R_MOON_KM = 1737.4;
/** Scene units: Moon radius = 2 */
export const SCENE_PER_KM = 2 / R_MOON_KM;

export type Vec3 = [number, number, number];
const RAD = Math.PI / 180;

/** Planetocentric latitude and east longitude → Moon body-fixed position in km. */
export function fixedFromLatLon(latDeg: number, lonEastDeg: number, rKm = R_MOON_KM): Vec3 {
  const la = latDeg * RAD;
  const lo = lonEastDeg * RAD;
  return [rKm * Math.cos(la) * Math.cos(lo), rKm * Math.cos(la) * Math.sin(lo), rKm * Math.sin(la)];
}

/**
 * Moon body-fixed km → scene, with the south pole pointing up: (x, y, z) ↦ (x, −z, y) × scale.
 * That matrix has determinant +1, so it is a rotation, not a mirror (east stays east).
 */
export function toScene(p: Vec3): Vec3 {
  return [p[0] * SCENE_PER_KM, -p[2] * SCENE_PER_KM, p[1] * SCENE_PER_KM];
}

/** The same rotation for a direction (no scaling). */
export function dirToScene(v: Vec3): Vec3 {
  return [v[0], -v[2], v[1]];
}

/** Local up, north and east at a site, as Moon body-fixed unit vectors. */
export function siteFrame(latDeg: number, lonEastDeg: number) {
  const la = latDeg * RAD;
  const lo = lonEastDeg * RAD;
  return {
    up: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)] as Vec3,
    north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)] as Vec3,
    east: [-Math.sin(lo), Math.cos(lo), 0] as Vec3,
  };
}

/** Moon body-fixed unit direction from a site toward azimuth (from north, clockwise) and elevation. */
export function dirFromSite(frame: ReturnType<typeof siteFrame>, azimuthDeg: number, elevationDeg: number): Vec3 {
  const ce = Math.cos(elevationDeg * RAD);
  const n = ce * Math.cos(azimuthDeg * RAD);
  const e = ce * Math.sin(azimuthDeg * RAD);
  const u = Math.sin(elevationDeg * RAD);
  return [0, 1, 2].map((k) => n * frame.north[k]! + e * frame.east[k]! + u * frame.up[k]!) as Vec3;
}
