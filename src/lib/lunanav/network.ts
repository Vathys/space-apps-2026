// Network math on per-sample 0/1 visibility series (CLAUDE.md §3: pure, no React/fetch).
// Rule D-17: a sample is connected only via a complete geometric line-of-sight path,
// lander → Earth, or lander → relay → Earth with both legs clear at that sample.

import type {
  BlackoutInterval,
  ConnectivityResult,
  CoverageSummary,
  ScenarioError,
  TimeGrid,
} from "./types";

// connected: 1 = some complete path exists; relayPerSatellite: 1 = complete path via that satellite.
export type CompletePaths = Pick<ConnectivityResult, "connected" | "relayPerSatellite">;

// Inputs already include the terrain horizon and elevation mask (visibility.ts),
// so no mask is applied here; applying it again would count it twice.
export function completePaths(
  dte: Uint8Array,
  landerSeesSat: Record<string, Uint8Array>,
  satSeesEarth: Record<string, Uint8Array>,
): CompletePaths {
  const n = dte.length;
  const landerKeys = Object.keys(landerSeesSat).sort();
  const earthKeys = Object.keys(satSeesEarth).sort();
  // A missing satellite must be an error, never a silent "not visible".
  if (landerKeys.join("\n") !== earthKeys.join("\n")) {
    throw new Error(
      `completePaths: satellite ids differ: landerSeesSat [${landerKeys.join(", ")}] vs satSeesEarth [${earthKeys.join(", ")}]`,
    );
  }
  for (const id of landerKeys) {
    if (landerSeesSat[id].length !== n || satSeesEarth[id].length !== n) {
      throw new Error(
        `completePaths: length mismatch for "${id}": dte ${n}, landerSeesSat ${landerSeesSat[id].length}, satSeesEarth ${satSeesEarth[id].length}`,
      );
    }
  }

  const connected = new Uint8Array(n);
  for (let i = 0; i < n; i++) connected[i] = dte[i] ? 1 : 0;

  const relayPerSatellite: Record<string, Uint8Array> = {};
  for (const id of landerKeys) {
    const lander = landerSeesSat[id];
    const earth = satSeesEarth[id];
    const path = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      // Both legs at the same sample: a relay that can't see Earth doesn't help.
      if (lander[i] && earth[i]) {
        path[i] = 1;
        connected[i] = 1;
      }
    }
    relayPerSatellite[id] = path;
  }

  return { connected, relayPerSatellite };
}

// ---------- window slicing ----------

// Maps the planner's start date and duration onto sample indices of the file series
// (endIndex exclusive). A start between samples is rounded to the nearest sample; the
// UI shows the snapped start as grid.startUtc + startIndex × stepSeconds.
// Anything reaching outside the window is a limitation, never clamped (CLAUDE.md §5).
export function sliceWindow(
  grid: TimeGrid,
  startUtc: string,
  durationDays: number,
): { startIndex: number; endIndex: number } | ScenarioError {
  // Only a bare date ("2027-01-02") or a time ending in Z / ±hh:mm is read as UTC; anything else
  // ("2027-01-02T00:00", "2027-01-02 00:00") Date.parse reads as browser-local time (CLAUDE.md §5).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startUtc) && !/(Z|[+-]\d{2}:\d{2})$/.test(startUtc)) {
    throw new Error(`sliceWindow: start "${startUtc}" has no UTC designator`);
  }
  const startMs = Date.parse(startUtc);
  const gridStartMs = Date.parse(grid.startUtc);
  if (Number.isNaN(startMs) || Number.isNaN(gridStartMs)) {
    throw new Error(`sliceWindow: unparseable time: start "${startUtc}", grid "${grid.startUtc}"`);
  }
  if (!(durationDays > 0) || !(grid.stepSeconds > 0)) {
    throw new Error(`sliceWindow: duration ${durationDays} d and step ${grid.stepSeconds} s must be > 0`);
  }
  const outside: ScenarioError = { code: "outside-window", supported: grid };
  if (startMs < gridStartMs) return outside;

  const stepMs = grid.stepSeconds * 1000;
  const startIndex = Math.round((startMs - gridStartMs) / stepMs);
  const sampleCount = Math.round((durationDays * 86400) / grid.stepSeconds);
  const endIndex = startIndex + sampleCount;
  // A too-short duration is bad input, not a date outside the window.
  if (sampleCount < 1) {
    throw new Error(`sliceWindow: duration ${durationDays} d is shorter than one ${grid.stepSeconds} s sample`);
  }
  if (endIndex > grid.count) return outside;
  return { startIndex, endIndex };
}

// ---------- coverage and blackouts ----------

// Time convention, used everywhere below: each sample stands for one step of time, so
// a run of k samples lasts k × stepSeconds, and N samples cover N × stepSeconds (not
// (N − 1) × stepSeconds). Percentages are sample counts over N.

// Maximal runs of samples where `on` holds, as [start, end) indices within the array.
// Shared with the timelines (series.ts), so blackouts and timeline intervals are cut the same way.
export function runsWhere(series: ArrayLike<number>, on: (v: number) => boolean): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let runStart = -1;
  for (let i = 0; i < series.length; i++) {
    const hit = on(series[i]!);
    if (hit && runStart < 0) runStart = i;
    if (!hit && runStart >= 0) {
      runs.push([runStart, i]);
      runStart = -1;
    }
  }
  if (runStart >= 0) runs.push([runStart, series.length]);
  return runs;
}

// Maximal runs of connected = 0 as [start, end) sample indices within the array.
const blackoutRuns = (connected: Uint8Array) => runsWhere(connected, (v) => !v);

// UTC time of sample `index` of the file series, in the files' format ("…T00:10:00Z").
// Pass `gridStartMs` when calling in a loop, so grid.startUtc is parsed once.
export function sampleTimeUtc(grid: TimeGrid, index: number, gridStartMs = Date.parse(grid.startUtc)): string {
  return new Date(gridStartMs + index * grid.stepSeconds * 1000).toISOString().replace(/\.000Z$/, "Z");
}

// All arrays are the scenario slice (same length). Throws on an empty slice: an
// empty window must never become NaN% on screen.
export function coverageSummary(
  connected: Uint8Array,
  dte: Uint8Array,
  sunlit: Float32Array,
  stepSeconds: number,
): CoverageSummary {
  const n = connected.length;
  if (n === 0) throw new Error("coverageSummary: empty slice");
  if (dte.length !== n || sunlit.length !== n) {
    throw new Error(
      `coverageSummary: length mismatch: connected ${n}, dte ${dte.length}, sunlit ${sunlit.length}`,
    );
  }
  let connectedCount = 0;
  let dteCount = 0;
  let sunlitSum = 0;
  for (let i = 0; i < n; i++) {
    if (connected[i]) connectedCount++;
    if (dte[i]) dteCount++;
    // Missing or bad sunlight data must fail loudly, never show as NaN% or > 100%.
    if (!(sunlit[i] >= 0 && sunlit[i] <= 1)) {
      throw new Error(`coverageSummary: sunlit[${i}] = ${sunlit[i]} is not a fraction in 0..1`);
    }
    sunlitSum += sunlit[i];
  }
  const runs = blackoutRuns(connected);
  let longestRun = 0;
  for (const [a, b] of runs) longestRun = Math.max(longestRun, b - a);

  return {
    samples: n,
    coveragePct: (100 * connectedCount) / n,
    dteCoveragePct: (100 * dteCount) / n,
    // From the counts, not by subtracting two rounded percentages.
    relayGainPct: (100 * (connectedCount - dteCount)) / n,
    sunlitPct: (100 * sunlitSum) / n,
    // A blackout clipped at the slice edge counts only its part inside the slice.
    longestBlackoutHours: (longestRun * stepSeconds) / 3600,
    blackoutCount: runs.length,
  };
}

// connected is the scenario slice; startIndex is where it begins in the file series,
// so times come from the file's grid. Full coverage gives [].
export function blackouts(
  connected: Uint8Array,
  grid: TimeGrid,
  startIndex: number,
): BlackoutInterval[] {
  const gridStartMs = Date.parse(grid.startUtc);
  const timeAt = (i: number) => sampleTimeUtc(grid, startIndex + i, gridStartMs);
  return blackoutRuns(connected).map(([a, b]) => ({
    startUtc: timeAt(a),
    endUtc: timeAt(b),
    durationHours: ((b - a) * grid.stepSeconds) / 3600,
    openStart: a === 0,
    openEnd: b === connected.length,
  }));
}
