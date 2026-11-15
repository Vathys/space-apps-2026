// Planner insights derived from a ConnectivityResult and the loaded files. Pure (no React, no fetch): it only reruns
// analysis.ts and reads its arrays, so every number here traces to public/data/ like the metric cards.
import { analyzeScenario } from "./analysis";
import { sampleTimeUtc, sliceWindow } from "./network";
import type { ConnectivityResult, DatasetIndex, RelayLinkData, Scenario, SiteData, TimeGrid } from "./types";

export type LinkState = "direct" | "relay" | "blackout";

/** The path at slice sample k: direct first, else a complete relay path, else none (same rule as the status chip). */
export const linkStateAt = (r: ConnectivityResult, k: number): LinkState => (r.dte[k] ? "direct" : r.connected[k] ? "relay" : "blackout");

export interface LinkEvent {
  /** Slice sample where the new state starts */
  step: number;
  utc: string;
  state: LinkState;
  /** How long the new state lasts, in hours (to the next change or the slice end) */
  hours: number;
}

/** Every change of link state over the slice, starting with the state at the first sample. */
export function linkEvents(r: ConnectivityResult, grid: TimeGrid): LinkEvent[] {
  const n = r.connected.length;
  const t0 = Date.parse(grid.startUtc);
  const out: LinkEvent[] = [];
  let start = 0;
  for (let k = 1; k <= n; k++) {
    if (k === n || linkStateAt(r, k) !== linkStateAt(r, start)) {
      out.push({ step: start, utc: sampleTimeUtc(grid, r.slice.startIndex + start, t0), state: linkStateAt(r, start), hours: ((k - start) * grid.stepSeconds) / 3600 });
      start = k;
    }
  }
  return out;
}

/** The next change after slice sample `step`: what comes and in how many hours; null if the state holds to the end. */
export function nextChange(events: LinkEvent[], step: number, stepSeconds: number): { state: LinkState; inHours: number } | null {
  const next = events.find((e) => e.step > step);
  return next ? { state: next.state, inHours: ((next.step - step) * stepSeconds) / 3600 } : null;
}

export interface SatelliteShare {
  id: string;
  name: string;
  /** Hours this satellite gives a complete lander → satellite → Earth path */
  hours: number;
  /** Hours it is the only path (no direct line and no other relay): what is lost without it */
  soleHours: number;
}

/** How much each relay satellite contributes over the slice. */
export function satelliteShares(r: ConnectivityResult, relay: RelayLinkData | null, stepSeconds: number): SatelliteShare[] {
  const ids = Object.keys(r.relayPerSatellite);
  const h = stepSeconds / 3600;
  return ids
    .map((id) => {
      const s = r.relayPerSatellite[id]!;
      let on = 0;
      let sole = 0;
      for (let k = 0; k < s.length; k++) {
        if (!s[k]) continue;
        on++;
        if (!r.dte[k] && ids.every((o) => o === id || !r.relayPerSatellite[o]![k])) sole++;
      }
      return { id, name: relay?.satellites.find((x) => x.id === id)?.name ?? id, hours: on * h, soleHours: sole * h };
    })
    .sort((a, b) => b.hours - a.hours);
}

/** Hours (and % of the slice) with both a complete path to Earth and some Sun on the lander: when it can work and talk. */
export function powerAndTalk(r: ConnectivityResult, stepSeconds: number) {
  let both = 0;
  for (let k = 0; k < r.connected.length; k++) if (r.connected[k] && r.sunlitFraction[k]! > 0) both++;
  return { hours: (both * stepSeconds) / 3600, pct: r.connected.length ? (100 * both) / r.connected.length : 0 };
}

/** Coverage (connected and direct-only) for each whole-degree mask from 0 to maxDeg, same site, dates and relay. */
export function maskCurve(scenario: Scenario, slice: { startIndex: number; endIndex: number }, site: SiteData, relay: RelayLinkData | null, maxDeg: number) {
  const out: { maskDeg: number; coveragePct: number; dteCoveragePct: number }[] = [];
  for (let m = 0; m <= maxDeg; m++) {
    const s = analyzeScenario({ ...scenario, minElevationDeg: m }, slice, site, relay).summary;
    out.push({ maskDeg: m, coveragePct: s.coveragePct, dteCoveragePct: s.dteCoveragePct });
  }
  return out;
}

export interface WindowScore {
  startUtc: string;
  coveragePct: number;
  dteCoveragePct: number;
  longestBlackoutHours: number;
}

/** The scenario's duration, started at each midnight the window allows: what each start date would give. */
export function windowScores(index: DatasetIndex, scenario: Scenario, site: SiteData, relay: RelayLinkData | null): WindowScore[] {
  const out: WindowScore[] = [];
  const t0 = Math.ceil(Date.parse(index.window.startUtc) / 86_400_000) * 86_400_000;
  for (let t = t0; ; t += 86_400_000) {
    const startUtc = new Date(t).toISOString().replace(/\.000Z$/, "Z");
    const slice = sliceWindow(index.window, startUtc, scenario.durationDays);
    if ("code" in slice) break; // the first start that runs past the window ends the scan
    const s = analyzeScenario({ ...scenario, startUtc }, slice, site, relay).summary;
    out.push({ startUtc, coveragePct: s.coveragePct, dteCoveragePct: s.dteCoveragePct, longestBlackoutHours: s.longestBlackoutHours });
  }
  return out;
}

/** Best start: highest coverage, then the shortest longest blackout. Null when no start fits. */
export function bestWindow(scores: WindowScore[]): WindowScore | null {
  return scores.reduce<WindowScore | null>(
    (b, s) => (!b || s.coveragePct > b.coveragePct || (s.coveragePct === b.coveragePct && s.longestBlackoutHours < b.longestBlackoutHours) ? s : b),
    null,
  );
}

/** A body's path across the lander's sky over the slice, one point per `every` samples (file values). */
export function skyTrack(azimuthDeg: ArrayLike<number>, elevationDeg: ArrayLike<number>, slice: { startIndex: number; endIndex: number }, every = 6) {
  const out: { azimuthDeg: number; elevationDeg: number }[] = [];
  for (let i = slice.startIndex; i < slice.endIndex; i += every) out.push({ azimuthDeg: azimuthDeg[i]!, elevationDeg: elevationDeg[i]! });
  return out;
}

/** The slice as CSV, one row per sample: UTC, direct, connected, sunlit fraction, and each satellite's complete path. */
export function resultCsv(r: ConnectivityResult, grid: TimeGrid): string {
  const ids = Object.keys(r.relayPerSatellite);
  const t0 = Date.parse(grid.startUtc);
  const rows = [["utc", "direct_to_earth", "connected", "sunlit_fraction", ...ids.map((id) => `relay_${id}`)].join(",")];
  for (let k = 0; k < r.connected.length; k++) {
    rows.push([sampleTimeUtc(grid, r.slice.startIndex + k, t0), r.dte[k], r.connected[k], r.sunlitFraction[k]!.toFixed(3), ...ids.map((id) => r.relayPerSatellite[id]![k])].join(","));
  }
  return rows.join("\n") + "\n";
}
