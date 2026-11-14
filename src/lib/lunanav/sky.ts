// Geometry for the 3D lander sky view. Pure: positions come straight from the data files, nothing is computed about links.
import type { HorizonProfile, RelayLinkData, SiteData } from "./types";

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;

/** Azimuth from north clockwise + elevation above the smooth horizon -> x east, y up, z south (north is -z). */
export function skyDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * RAD;
  const el = elevationDeg * RAD;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}

export interface SkyBody {
  id: string;
  label: string;
  kind: "sun" | "earth" | "satellite";
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number | null; // null: not in the file (the Sun)
  seesEarth: boolean | null; // satellites only: relay-to-Earth line not blocked by the Moon, as written in the file
}

/** The horizon computed for this antenna height, else the first one the file has. */
export function horizonFor(site: SiteData, antennaHeightM: number): HorizonProfile | undefined {
  return site.horizons.find((h) => h.antennaHeightM === antennaHeightM) ?? site.horizons[0];
}

/** Everything that is in the sky at sample `i` of the file series. */
export function bodiesAt(site: SiteData, relay: RelayLinkData | null, i: number): SkyBody[] {
  const bodies: SkyBody[] = [
    { id: "sun", label: "Sun", kind: "sun", azimuthDeg: site.sun.azimuthDeg[i]!, elevationDeg: site.sun.elevationDeg[i]!, rangeKm: null, seesEarth: null },
    {
      id: "earth",
      label: "Earth",
      kind: "earth",
      azimuthDeg: site.earth.azimuthDeg[i]!,
      elevationDeg: site.earth.elevationDeg[i]!,
      rangeKm: site.earth.rangeKm[i]!,
      seesEarth: null,
    },
  ];
  for (const s of relay?.satellites ?? []) {
    bodies.push({
      id: s.id,
      label: s.name,
      kind: "satellite",
      azimuthDeg: s.azimuthDeg[i]!,
      elevationDeg: s.elevationDeg[i]!,
      rangeKm: s.rangeKm[i]!,
      seesEarth: s.seesEarth[i] === 1,
    });
  }
  return bodies;
}

/**
 * The terrain as a wall: for each horizon azimuth, a top vertex on the horizon profile and a bottom one far below,
 * at scene radius `r`. Index k = n repeats azimuth 0 to close the ring.
 */
export function ridgeGeometry(horizon: HorizonProfile, r: number, belowDeg = -85) {
  const n = horizon.elevationDeg.length;
  const positions: number[] = [];
  const top: number[] = [];
  for (let k = 0; k <= n; k++) {
    const az = k * horizon.azimuthStepDeg;
    const t = skyDirection(az, horizon.elevationDeg[k % n]!).map((c) => c * r);
    const b = skyDirection(az, belowDeg).map((c) => c * r);
    positions.push(...t, ...b);
    top.push(...t);
  }
  const index: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = k * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { positions, index, top };
}
