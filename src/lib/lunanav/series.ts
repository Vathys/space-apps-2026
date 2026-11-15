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
  /** Hours the state holds. For a 0..1 series (sunlight) this and each run's hours are fraction × step,
   *  the same as the Sunlit % card, so the table adds up to the header */
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
  // A series of the wrong length would shift every time without an error
  if (series.length !== slice.endIndex - slice.startIndex) {
    throw new Error(`timelineRow: series has ${series.length} samples, slice ${slice.startIndex}..${slice.endIndex} needs ${slice.endIndex - slice.startIndex}`);
  }
  const hoursPerSample = grid.stepSeconds / 3600;
  const gridStartMs = Date.parse(grid.startUtc);
  const hoursOf = (a: number, b: number) => {
    if (!weighted) return (b - a) * hoursPerSample;
    let h = 0;
    for (let i = a; i < b; i++) h += series[i]! * hoursPerSample;
    return h;
  };
  const runs = runsWhere(series, (v) => v > 0).map(([a, b]) => ({
    startIndex: a,
    endIndex: b,
    startUtc: sampleTimeUtc(grid, slice.startIndex + a, gridStartMs),
    endUtc: sampleTimeUtc(grid, slice.startIndex + b, gridStartMs),
    hours: hoursOf(a, b),
  }));
  const totalHours = runs.reduce((h, r) => h + r.hours, 0);

  const stepMs = grid.stepSeconds * 1000;
  const startMs = gridStartMs + slice.startIndex * stepMs;
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

/**
 * What to say about the "longest blackout" figure when blackouts touch the slice edge:
 * - the longest one itself is cut: it may be longer;
 * - only a shorter one is cut: that one may really be longer than the figure (8 h shown, 30 h real),
 *   so the figure is a lower bound, but it isn't itself cut.
 * null when no blackout touches an edge.
 */
export function blackoutClipNote(result: ConnectivityResult): string | null {
  const cut = result.blackouts.filter((b) => b.openStart || b.openEnd);
  if (!cut.length) return null;
  if (cut.some((b) => b.durationHours === result.summary.longestBlackoutHours)) return "may be longer: cut by the start or end of the scenario";
  return "another blackout is cut by the start or end of the scenario and may be longer than this";
}

/** Each distinct source once (a 5-satellite config would otherwise list its relay source five times). */
export function uniqueSources(provenance: Provenance[]): string[] {
  return [...new Set(provenance.map((p) => p.source))];
}

/** Uncertainty summaries of the files behind the result, each once. Empty means none is stated: show "unknown". */
export function uncertaintySummaries(site: SiteData | null, relay: RelayLinkData | null, antennaHeightM: number): string[] {
  const horizon = site?.horizons.find((h) => h.antennaHeightM === antennaHeightM);
  const all = [
    // No profile for this height: say "unknown", never leave the terrain out
    site && (horizon ? `Terrain horizon: ${horizon.uncertainty.summary}` : "Terrain horizon: unknown"),
    site && `Sun: ${site.sun.uncertainty.summary}`,
    site && `Earth: ${site.earth.uncertainty.summary}`,
    ...(relay?.satellites ?? []).map((s) => `Relay: ${s.uncertainty.summary}`),
  ];
  return [...new Set(all.filter((x): x is string => !!x))];
}

export interface ComparisonRow {
  label: string;
  unit: "%" | "h" | "";
  direct: number;
  relay: number | null; // null: no relay configuration selected
  /** relay − direct as shown on screen (both rounded the way they are displayed), or null without a relay */
  change: number | null;
  /** For the coverage row: both values are 0..100, drawn as bars */
  percent: boolean;
  /** Longest blackout row: blackoutClipNote per column, or null */
  clipNote?: { direct: string | null; relay: string | null };
}

/**
 * F5: the same scenario without and with the relay. Both results come from analyzeScenario on the same files and
 * slice, so the only difference is the relay. A relay only adds connected samples, so coverage can only go up and
 * the longest blackout only down; the blackout count can go either way (a relay can split one blackout into two).
 */
/** A value rounded the way the comparison shows it: counts as integers, % and h to 0.1 */
const shown = (v: number, unit: ComparisonRow["unit"]) => (unit === "" ? Math.round(v) : Math.round(v * 10) / 10);

export function comparisonRows(direct: ConnectivityResult, relay: ConnectivityResult | null): ComparisonRow[] {
  const d = direct.summary;
  const r = relay?.summary ?? null;
  const row = (label: string, unit: ComparisonRow["unit"], dv: number, rv: number | null, percent = false): ComparisonRow => ({
    label,
    unit,
    direct: dv,
    relay: rv,
    // From the rounded values, so the Change column always matches the two numbers shown next to it
    change: rv === null ? null : shown(rv, unit) - shown(dv, unit),
    percent,
  });
  return [
    row("Coverage", "%", d.coveragePct, r ? r.coveragePct : null, true),
    {
      ...row("Longest blackout", "h", d.longestBlackoutHours, r ? r.longestBlackoutHours : null),
      clipNote: { direct: blackoutClipNote(direct), relay: relay ? blackoutClipNote(relay) : null },
    },
    row("Blackouts", "", d.blackoutCount, r ? r.blackoutCount : null),
  ];
}
