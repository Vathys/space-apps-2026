// Presentation helpers: turn 0/1 (or 0..1) series into runs for timelines and tables. Pure.
import type { ConnectivityResult } from "./types";

export interface Run {
  startIndex: number; // into the slice, inclusive
  endIndex: number; // exclusive
  startUtc: string;
  endUtc: string;
  hours: number;
}

/** Consecutive samples above 0, as runs. `offset` is the file-series index of the slice start. */
export function runsOf(series: ArrayLike<number>, startUtc: string, stepSeconds: number, offset = 0): Run[] {
  const t0 = Date.parse(startUtc);
  const at = (i: number) => new Date(t0 + (offset + i) * stepSeconds * 1000).toISOString();
  const runs: Run[] = [];
  let from = -1;
  for (let i = 0; i <= series.length; i++) {
    const on = i < series.length && series[i]! > 0;
    if (on && from < 0) from = i;
    if (!on && from >= 0) {
      runs.push({ startIndex: from, endIndex: i, startUtc: at(from), endUtc: at(i), hours: ((i - from) * stepSeconds) / 3600 });
      from = -1;
    }
  }
  return runs;
}

/** 1 where any satellite has a complete path. */
export function anyRelay(result: ConnectivityResult): Uint8Array {
  const out = new Uint8Array(result.connected.length);
  for (const s of Object.values(result.relayPerSatellite)) for (let i = 0; i < out.length; i++) if (s[i]) out[i] = 1;
  return out;
}
