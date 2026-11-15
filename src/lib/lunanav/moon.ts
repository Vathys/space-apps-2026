// Geometry for the 3D Moon first look (D-21). Pure: no React, no three.js. Positions come from index.json (sites)
// the site file (Sun/Earth az/el) and the relay file (satellite az/el/range); nothing here computes a result.
import type { RelayLinkData } from "./types";

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

/** Moon GM in km³/s² (JPL DE440). Used only to know how many file samples make one orbit for the drawn track. */
const GM_MOON_KM3_S2 = 4902.8;

export interface RelayTrack {
  id: string;
  name: string;
  /** Moon body-fixed km at the scenario's first sample */
  nowKm: Vec3;
  /** Moon body-fixed km over one orbit from that sample, from the file's az/el/range */
  trackKm: Vec3[];
}

/**
 * Where each relay satellite is, Moon body-fixed, rebuilt from what the site sees in the relay file:
 * site position + rangeKm × direction(azimuthDeg, elevationDeg). Nothing is propagated here.
 * The site sits on the mean sphere; the file's ranges are from the real site, a few km off, invisible at scene scale.
 */
export function relayTracks(latDeg: number, lonEastDeg: number, relay: RelayLinkData, i: number): RelayTrack[] {
  const site = fixedFromLatLon(latDeg, lonEastDeg);
  const frame = siteFrame(latDeg, lonEastDeg);
  const count = relay.window.count;
  return relay.satellites.map((s) => {
    const at = (k: number): Vec3 => {
      const d = dirFromSite(frame, s.azimuthDeg[k]!, s.elevationDeg[k]!);
      return [0, 1, 2].map((c) => site[c]! + s.rangeKm[k]! * d[c]!) as Vec3;
    };
    const n = Math.ceil((2 * Math.PI * Math.sqrt(s.elements.aKm ** 3 / GM_MOON_KM3_S2)) / relay.window.stepSeconds);
    const from = Math.max(0, Math.min(i, count - 1 - n)); // near the window's end, the last full orbit in the file
    const trackKm: Vec3[] = [];
    for (let k = from; k <= Math.min(count - 1, from + n); k++) trackKm.push(at(k));
    return { id: s.id, name: s.name, nowKm: at(i), trackKm };
  });
}

/** Not to scale: keep the direction from the Moon's centre, shrink the height above the mean surface by `k`. */
export function compressAltitude(p: Vec3, k: number): Vec3 {
  const r = Math.hypot(...p);
  const s = (R_MOON_KM + (r - R_MOON_KM) * k) / r;
  return p.map((c) => c * s) as Vec3;
}

/** Moon body-fixed unit direction from a site toward azimuth (from north, clockwise) and elevation. */
export function dirFromSite(frame: ReturnType<typeof siteFrame>, azimuthDeg: number, elevationDeg: number): Vec3 {
  const ce = Math.cos(elevationDeg * RAD);
  const n = ce * Math.cos(azimuthDeg * RAD);
  const e = ce * Math.sin(azimuthDeg * RAD);
  const u = Math.sin(elevationDeg * RAD);
  return [0, 1, 2].map((k) => n * frame.north[k]! + e * frame.east[k]! + u * frame.up[k]!) as Vec3;
}
