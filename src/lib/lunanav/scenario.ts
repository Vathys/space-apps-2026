// Scenario <-> URL query string, plus the supported-window check. Pure: no React, no fetch.
import type { DatasetIndex, Scenario, ScenarioError, TimeGrid } from "./types";

export const MIN_DAYS = 1;
export const MAX_DAYS = 30;
export const MAX_MASK_DEG = 10;
export const DIRECT = "direct";

const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: string | null, fallback: number) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback);

/** First instant after the last supported sample (exclusive end). */
export const windowEndMs = (w: TimeGrid) => Date.parse(w.startUtc) + w.count * w.stepSeconds * 1000;

export const dateOf = (utc: string) => utc.slice(0, 10);

/** Dates the picker offers: first window day to the last day with a sample. */
export function windowDates(w: TimeGrid) {
  return { min: dateOf(w.startUtc), max: new Date(windowEndMs(w) - 1).toISOString().slice(0, 10) };
}

export function parseScenario(search: string, index: DatasetIndex): Scenario {
  const q = new URLSearchParams(search);
  const site = index.sites.find((s) => s.id === q.get("site")) ?? index.sites[0];
  const relay = index.relayConfigs.find((r) => r.id === q.get("relay"));
  const start = q.get("start");
  const wantedAntenna = num(q.get("antenna"), index.defaults.antennaHeightM);
  return {
    siteId: site?.id ?? "",
    // An out-of-window start is kept, so the UI can say so instead of silently moving it.
    startUtc: `${start && DATE.test(start) ? start : dateOf(index.window.startUtc)}T00:00:00Z`,
    durationDays: clamp(Math.round(num(q.get("days"), index.defaults.durationDays)), MIN_DAYS, MAX_DAYS),
    relayConfigId: relay?.id ?? null,
    minElevationDeg: clamp(num(q.get("mask"), index.defaults.minElevationDeg), 0, MAX_MASK_DEG),
    antennaHeightM: site?.antennaHeightsM.includes(wantedAntenna) ? wantedAntenna : (site?.antennaHeightsM[0] ?? index.defaults.antennaHeightM),
  };
}

export function toSearch(s: Scenario): string {
  return new URLSearchParams({
    site: s.siteId,
    start: dateOf(s.startUtc),
    days: String(s.durationDays),
    relay: s.relayConfigId ?? DIRECT,
    mask: String(s.minElevationDeg),
    antenna: String(s.antennaHeightM),
  }).toString();
}

export function checkWindow(s: Scenario, index: DatasetIndex): Extract<ScenarioError, { code: "outside-window" }> | null {
  const start = Date.parse(s.startUtc);
  const end = start + s.durationDays * DAY_MS;
  const w = index.window;
  return Number.isNaN(start) || start < Date.parse(w.startUtc) || end > windowEndMs(w) ? { code: "outside-window", supported: w } : null;
}

/** Sample range of the scenario inside the file series (end exclusive). Assumes checkWindow passed. */
export function sliceOf(s: Scenario, w: TimeGrid): { startIndex: number; endIndex: number } {
  const startIndex = Math.round((Date.parse(s.startUtc) - Date.parse(w.startUtc)) / (w.stepSeconds * 1000));
  return { startIndex, endIndex: Math.min(w.count, startIndex + Math.round((s.durationDays * 86400) / w.stepSeconds)) };
}
