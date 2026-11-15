// I1: one scenario → ConnectivityResult. Pure (no React, no fetch). No new maths here: it only runs
// visibility.ts (Dev 2) and network.ts (Dev 1) in order on the scenario slice of the loaded files.
import { blackouts, completePaths, coverageSummary } from "./network";
import type { ConnectivityResult, Provenance, RelayLinkData, Scenario, SiteData } from "./types";
import { aboveTerrain, sunlitFraction } from "./visibility";

const CAVEAT = "Geometric line-of-sight only: no link budget, scheduling or interference." as const;

export function analyzeScenario(
  scenario: Scenario,
  slice: { startIndex: number; endIndex: number },
  site: SiteData,
  relay: RelayLinkData | null,
): ConnectivityResult {
  const horizon = site.horizons.find((h) => h.antennaHeightM === scenario.antennaHeightM);
  // A missing horizon must be an error, never a silent "flat horizon"
  if (!horizon) throw new Error(`analyzeScenario: site ${site.siteId} has no horizon for antenna height ${scenario.antennaHeightM} m`);
  if (relay && (relay.siteId !== site.siteId || relay.configId !== scenario.relayConfigId)) {
    throw new Error(`analyzeScenario: relay file ${relay.siteId}/${relay.configId} does not match the scenario`);
  }
  const cut = <T extends ArrayLike<number>>(s: T) => Array.prototype.slice.call(s, slice.startIndex, slice.endIndex) as number[];
  const mask = scenario.minElevationDeg;

  // DTE: Earth above the terrain horizon + link mask (D-17)
  const dte = aboveTerrain(horizon, cut(site.earth.azimuthDeg), cut(site.earth.elevationDeg), mask);

  // Relay legs: lander → satellite uses the same terrain + mask test; satellite → Earth is the file's occultation flag
  const landerSeesSat: Record<string, Uint8Array> = {};
  const satSeesEarth: Record<string, Uint8Array> = {};
  for (const s of relay?.satellites ?? []) {
    landerSeesSat[s.id] = aboveTerrain(horizon, cut(s.azimuthDeg), cut(s.elevationDeg), mask);
    satSeesEarth[s.id] = Uint8Array.from(cut(s.seesEarth));
  }
  const { connected, relayPerSatellite } = completePaths(dte, landerSeesSat, satSeesEarth);

  // Sunlight is terrain only: no link mask
  const sun = sunlitFraction(horizon, cut(site.sun.azimuthDeg), cut(site.sun.elevationDeg), site.sun.angularRadiusDeg);

  const provenance: Provenance[] = [horizon.source, site.sun.source, site.earth.source, ...(relay?.satellites ?? []).map((s) => s.source)];
  return {
    scenario,
    slice,
    dte,
    relayPerSatellite,
    connected,
    sunlitFraction: sun,
    summary: coverageSummary(connected, dte, sun, site.window.stepSeconds),
    blackouts: blackouts(connected, site.window, slice.startIndex),
    provenance,
    caveat: CAVEAT,
  };
}
