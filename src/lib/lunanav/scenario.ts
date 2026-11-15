// Scenario <-> URL query string. Pure: no React, no fetch. The window check itself is network.sliceWindow.
import type { DatasetIndex, Scenario, TimeGrid } from "./types";

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

/** Scenarios start at 00:00 UTC: the first midnight at or after the window start. One rule for the picker and the slider. */
const firstStartMs = (w: TimeGrid) => Math.ceil(Date.parse(w.startUtc) / DAY_MS) * DAY_MS;

export const dateOf = (utc: string) => utc.slice(0, 10);

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A real calendar date in YYYY-MM-DD (rejects 2027-13-01 and 2027-02-30, which Date.parse may roll over or reject). */
export function isDate(v: string | null): v is string {
  if (!v || !DATE.test(v)) return false;
  const ms = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(ms) && isoDate(ms) === v;
}

/** Start dates the picker offers: the first midnight in the window, to the last midnight a 1-day scenario still fits. */
export function windowDates(w: TimeGrid) {
  const minMs = firstStartMs(w);
  // A window with less than a full day after its first midnight has no valid start: min = max, and the UI says outside
  const maxMs = Math.max(minMs, Math.floor((windowEndMs(w) - DAY_MS) / DAY_MS) * DAY_MS);
  return { min: isoDate(minMs), max: isoDate(maxMs) };
}

/** Whole days from the first offered start to the window end: the longest duration that can fit (at most MAX_DAYS). */
export function windowDays(w: TimeGrid) {
  return Math.min(MAX_DAYS, Math.max(0, Math.floor((windowEndMs(w) - firstStartMs(w)) / DAY_MS)));
}

/** The last day that has data. */
export const windowLastDate = (w: TimeGrid) => isoDate(windowEndMs(w) - 1);

/**
 * The one set of rules for a scenario, used for the URL and for every control change: a known site, a relay
 * that has a file for that site (else direct only), a real start date, whole days, a mask in range and an
 * antenna height the site has. A start or duration outside the window is kept, so the UI can say so.
 */
export function normalizeScenario(s: Scenario, index: DatasetIndex): Scenario {
  const site = index.sites.find((x) => x.id === s.siteId) ?? index.sites[0];
  const relay = index.relayConfigs.find((r) => r.id === s.relayConfigId && !!site && !!r.dataFiles[site.id]);
  const start = dateOf(s.startUtc);
  const days = Number.isFinite(s.durationDays) ? s.durationDays : index.defaults.durationDays;
  const mask = Number.isFinite(s.minElevationDeg) ? s.minElevationDeg : index.defaults.minElevationDeg;
  return {
    siteId: site?.id ?? "",
    startUtc: `${isDate(start) ? start : windowDates(index.window).min}T00:00:00Z`,
    durationDays: clamp(Math.round(days), MIN_DAYS, MAX_DAYS),
    relayConfigId: relay?.id ?? null,
    minElevationDeg: clamp(mask, 0, MAX_MASK_DEG),
    antennaHeightM: site?.antennaHeightsM.includes(s.antennaHeightM) ? s.antennaHeightM : (site?.antennaHeightsM[0] ?? index.defaults.antennaHeightM),
  };
}

export function parseScenario(search: string, index: DatasetIndex): Scenario {
  const q = new URLSearchParams(search);
  const relay = q.get("relay");
  return normalizeScenario(
    {
      siteId: q.get("site") ?? "",
      startUtc: `${q.get("start") ?? ""}T00:00:00Z`,
      durationDays: num(q.get("days"), index.defaults.durationDays),
      relayConfigId: relay && relay !== DIRECT ? relay : null,
      minElevationDeg: num(q.get("mask"), index.defaults.minElevationDeg),
      antennaHeightM: num(q.get("antenna"), index.defaults.antennaHeightM),
    },
    index,
  );
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
