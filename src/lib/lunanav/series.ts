// Presentation numbers for the timelines and metric cards. Pure (no React): components only render what this returns.
import { runsWhere, sampleTimeUtc } from "./network";
import type { ConnectivityResult, Provenance, RelayLinkData, SiteData, TimeGrid } from "./types";

const DAY_MS = 86_400_000;

export interface Run {
  startIndex: number; // into the slice, inclusive
  endIndex: number; // exclusive
  startUtc: string;
  endUtc: string;
  hours: number;
}

export interface TimelineRowData {
  samples: number;
  runs: Run[];
  /** Hours the state holds. For a 0..1 series (sunlight) this is fraction × step, the same as the Sunlit % card */
  totalHours: number;
  /** Positions of each UTC midnight inside the slice, in samples from the slice start (may be fractional) */
  dayTicks: number[];
}

/**
 * One timeline row: the intervals where the series is above 0, their total hours, and the UTC midnights.
 * Times come from `grid` and `slice.startIndex` (the file series), cut the same way as network.blackouts.
 */
export function timelineRow(
  series: ArrayLike<number>,
  grid: TimeGrid,
  slice: { startIndex: number; endIndex: number },
  weighted = false,
): TimelineRowData {
  const hoursPerSample = grid.stepSeconds / 3600;
  const runs = runsWhere(series, (v) => v > 0).map(([a, b]) => ({
    startIndex: a,
    endIndex: b,
    startUtc: sampleTimeUtc(grid, slice.startIndex + a),
    endUtc: sampleTimeUtc(grid, slice.startIndex + b),
    hours: (b - a) * hoursPerSample,
  }));
  let totalHours = 0;
  if (weighted) for (let i = 0; i < series.length; i++) totalHours += series[i]! * hoursPerSample;
  else for (const r of runs) totalHours += r.hours;

  const stepMs = grid.stepSeconds * 1000;
  const startMs = Date.parse(grid.startUtc) + slice.startIndex * stepMs;
  const endMs = startMs + series.length * stepMs;
  const dayTicks: number[] = [];
  for (let m = Math.floor(startMs / DAY_MS) * DAY_MS + DAY_MS; m < endMs; m += DAY_MS) dayTicks.push((m - startMs) / stepMs);
  return { samples: series.length, runs, totalHours, dayTicks };
}

/** 1 where any satellite has a complete path. */
export function anyRelay(result: ConnectivityResult): Uint8Array {
  const out = new Uint8Array(result.connected.length);
  for (const s of Object.values(result.relayPerSatellite)) for (let i = 0; i < out.length; i++) if (s[i]) out[i] = 1;
  return out;
}

/** The longest blackout touches the start or end of the slice, so it may really be longer. */
export function longestBlackoutClipped(result: ConnectivityResult): boolean {
  const longest = result.summary.longestBlackoutHours;
  return result.blackouts.some((b) => b.durationHours === longest && (b.openStart || b.openEnd));
}

/** Each distinct source once (a 5-satellite config would otherwise list its relay source five times). */
export function uniqueSources(provenance: Provenance[]): string[] {
  return [...new Set(provenance.map((p) => p.source))];
}

/** Uncertainty summaries of the files behind the result, each once. Empty means none is stated: show "unknown". */
export function uncertaintySummaries(site: SiteData | null, relay: RelayLinkData | null, antennaHeightM: number): string[] {
  const horizon = site?.horizons.find((h) => h.antennaHeightM === antennaHeightM);
  const all = [
    horizon && `Terrain horizon: ${horizon.uncertainty.summary}`,
    site && `Sun: ${site.sun.uncertainty.summary}`,
    site && `Earth: ${site.earth.uncertainty.summary}`,
    ...(relay?.satellites ?? []).map((s) => `Relay: ${s.uncertainty.summary}`),
  ];
  return [...new Set(all.filter((x): x is string => !!x))];
}
