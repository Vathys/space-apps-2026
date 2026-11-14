// The only fetcher in lib/lunanav (CLAUDE.md §3). Reads public/data/, checks shapes, never computes.
import type { DatasetIndex, RelayLinkData, SiteData, TimeGrid } from "./types";

export const DATA_ROOT = "/data";
export const PLACEHOLDER_ROOT = "/data/placeholder";

export type Loaded<T> = { data: T; placeholder: boolean };

export class DataError extends Error {
  constructor(
    readonly code: "data-file-missing" | "site-not-found" | "config-not-found" | "bad-shape",
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

async function getJson<T>(url: string): Promise<Loaded<T>> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new DataError("data-file-missing", url);
  }
  if (!res.ok) throw new DataError("data-file-missing", `${url} (HTTP ${res.status})`);
  let raw: T & { placeholder?: boolean };
  try {
    raw = await res.json();
  } catch {
    throw new DataError("bad-shape", `${url} is not valid JSON`);
  }
  return { data: raw, placeholder: raw.placeholder === true };
}

function expectLength(url: string, name: string, series: ArrayLike<unknown>, window: TimeGrid) {
  if (series.length !== window.count) {
    throw new DataError("bad-shape", `${url}: ${name} has ${series.length} samples, window says ${window.count}`);
  }
}

export async function loadIndex(root = DATA_ROOT): Promise<Loaded<DatasetIndex>> {
  const url = `${root}/index.json`;
  const loaded = await getJson<DatasetIndex>(url);
  if (loaded.data.schemaVersion !== 1) throw new DataError("bad-shape", `${url}: schemaVersion ${loaded.data.schemaVersion}`);
  return loaded;
}

export async function loadSite(index: DatasetIndex, siteId: string, root = DATA_ROOT): Promise<Loaded<SiteData>> {
  const meta = index.sites.find((s) => s.id === siteId);
  if (!meta) throw new DataError("site-not-found", siteId);
  const url = `${root}/${meta.dataFile}`;
  const loaded = await getJson<SiteData>(url);
  const { sun, earth, horizons, window } = loaded.data;
  for (const [name, s] of [
    ["sun.azimuthDeg", sun.azimuthDeg],
    ["sun.elevationDeg", sun.elevationDeg],
    ["earth.azimuthDeg", earth.azimuthDeg],
    ["earth.elevationDeg", earth.elevationDeg],
    ["earth.rangeKm", earth.rangeKm],
  ] as const) {
    expectLength(url, name, s, window);
  }
  if (horizons.length !== meta.antennaHeightsM.length) {
    throw new DataError("bad-shape", `${url}: ${horizons.length} horizons, index lists ${meta.antennaHeightsM.length} antenna heights`);
  }
  for (const h of horizons) {
    expectLength(url, `horizons[${h.antennaHeightM} m].elevationDeg`, h.elevationDeg, { ...window, count: Math.round(360 / h.azimuthStepDeg) });
  }
  return loaded;
}

export async function loadRelay(
  index: DatasetIndex,
  siteId: string,
  configId: string,
  root = DATA_ROOT,
): Promise<Loaded<RelayLinkData>> {
  const config = index.relayConfigs.find((c) => c.id === configId);
  if (!config) throw new DataError("config-not-found", configId);
  const file = config.dataFiles[siteId];
  if (!file) throw new DataError("data-file-missing", `no ${configId} file for site ${siteId}`);
  const url = `${root}/${file}`;
  const loaded = await getJson<RelayLinkData>(url);
  for (const sat of loaded.data.satellites) {
    for (const [name, s] of [
      ["azimuthDeg", sat.azimuthDeg],
      ["elevationDeg", sat.elevationDeg],
      ["rangeKm", sat.rangeKm],
      ["seesEarth", sat.seesEarth],
    ] as const) {
      expectLength(url, `${sat.id}.${name}`, s, loaded.data.window);
    }
  }
  return loaded;
}
