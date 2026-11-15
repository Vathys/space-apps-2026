// The only fetcher in lib/lunanav (CLAUDE.md §3). Reads public/data/ and the optional point server (D-25), checks
// shapes, never computes.
import { sliceWindow } from "./network";
import type { DatasetIndex, RelayLinkData, SiteData, SiteMeta, TimeGrid } from "./types";

export const DATA_ROOT = "/data";

export type Loaded<T> = { data: T };

export class DataError extends Error {
  constructor(
    readonly code: "data-file-missing" | "site-not-found" | "config-not-found" | "bad-shape" | "point-offline" | "point-rejected",
    readonly detail: string,
    /** The file is known not to exist (HTTP 404, or no entry in index.json), as opposed to a failed load (network, 5xx) */
    readonly absent = false,
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
  if (!res.ok) throw new DataError("data-file-missing", `${url} (HTTP ${res.status})`, res.status === 404);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new DataError("bad-shape", `${url} is not valid JSON`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new DataError("bad-shape", `${url} is not a JSON object`);
  // §5: placeholder files were deleted in I3; one getting back in must fail loudly, not show as real numbers
  if ((raw as { placeholder?: unknown }).placeholder === true) throw new DataError("bad-shape", `${url} is marked placeholder`);
  return { data: raw as T };
}

function expectLength(url: string, name: string, series: ArrayLike<unknown> | undefined, expected: number, what = "window samples") {
  if (!series || series.length !== expected) {
    throw new DataError("bad-shape", `${url}: ${name} has ${series?.length ?? "no"} values, expected ${expected} ${what}`);
  }
}

/** The file has every top-level key the contract needs, and schemaVersion 1. */
function expectKeys(url: string, data: object, keys: string[]) {
  const missing = keys.filter((k) => !(k in data));
  if (missing.length) throw new DataError("bad-shape", `${url}: missing ${missing.join(", ")}`);
  const v = (data as { schemaVersion?: unknown }).schemaVersion;
  if (v !== 1) throw new DataError("bad-shape", `${url}: schemaVersion ${String(v)}, expected 1`);
}

// Pages index samples by index.window, so a file on another grid would show the wrong times without any error.
function expectWindow(url: string, file: TimeGrid, index: TimeGrid) {
  if (file.startUtc !== index.startUtc || file.stepSeconds !== index.stepSeconds || file.count !== index.count) {
    throw new DataError(
      "bad-shape",
      `${url}: window ${file.startUtc} / ${file.stepSeconds} s / ${file.count} differs from index.json ${index.startUtc} / ${index.stepSeconds} s / ${index.count}`,
    );
  }
}

function expectId(url: string, name: string, got: string, want: string) {
  if (got !== want) throw new DataError("bad-shape", `${url}: ${name} is "${got}", expected "${want}"`);
}

export async function loadIndex(root = DATA_ROOT): Promise<Loaded<DatasetIndex>> {
  const url = `${root}/index.json`;
  const loaded = await getJson<DatasetIndex>(url);
  expectKeys(url, loaded.data, ["schemaVersion", "window", "sites", "relayConfigs", "defaults"]);
  // Everything is sliced by this window and these fields are read during render, so a bad index stops here
  // (as a visible error) instead of blanking the page later. The window test is sliceWindow itself, the app's
  // one window rule: a 1-day scenario at the window start must slice cleanly.
  const { window: w, defaults, sites, relayConfigs } = loaded.data;
  try {
    sliceWindow(w, w.startUtc, 1); // throws on a missing or non-UTC start, step <= 0, or a step longer than a day
  } catch (e) {
    throw new DataError("bad-shape", `${url}: window: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!(w.count >= 1 && Number.isInteger(w.count))) throw new DataError("bad-shape", `${url}: window count must be an integer >= 1`);
  const nums = ["minElevationDeg", "durationDays", "antennaHeightM"] as const;
  if (!defaults || nums.some((k) => !Number.isFinite(defaults[k]))) throw new DataError("bad-shape", `${url}: defaults needs numeric ${nums.join(", ")}`);
  if (!Array.isArray(sites) || sites.some((x) => typeof x?.id !== "string" || typeof x.dataFile !== "string" || !Array.isArray(x.antennaHeightsM))) {
    throw new DataError("bad-shape", `${url}: each site needs id, dataFile and antennaHeightsM`);
  }
  if (!Array.isArray(relayConfigs) || relayConfigs.some((x) => typeof x?.id !== "string" || typeof x.dataFiles !== "object" || x.dataFiles === null)) {
    throw new DataError("bad-shape", `${url}: each relay config needs id and dataFiles`);
  }
  return loaded;
}

export async function loadSite(index: DatasetIndex, siteId: string, root = DATA_ROOT): Promise<Loaded<SiteData>> {
  const meta = index.sites.find((s) => s.id === siteId);
  if (!meta) throw new DataError("site-not-found", siteId);
  const url = `${root}/${meta.dataFile}`;
  const loaded = await getJson<SiteData>(url);
  checkSite(url, index, meta, loaded.data);
  return loaded;
}

/** The site file matches the contract, the index window and the antenna heights its meta lists. */
function checkSite(url: string, index: DatasetIndex, meta: SiteMeta, data: SiteData) {
  expectKeys(url, data, ["schemaVersion", "siteId", "window", "horizons", "sun", "earth"]);
  const { sun, earth, horizons, window } = data;
  expectId(url, "siteId", data.siteId, meta.id);
  expectWindow(url, window, index.window);
  for (const [name, s] of [
    ["sun.azimuthDeg", sun.azimuthDeg],
    ["sun.elevationDeg", sun.elevationDeg],
    ["earth.azimuthDeg", earth.azimuthDeg],
    ["earth.elevationDeg", earth.elevationDeg],
    ["earth.rangeKm", earth.rangeKm],
  ] as const) {
    expectLength(url, name, s, window.count);
  }
  for (const h of meta.antennaHeightsM) {
    if (!horizons.some((p) => p.antennaHeightM === h)) throw new DataError("bad-shape", `${url}: no horizon for antenna height ${h} m listed in index.json`);
  }
  for (const h of horizons) {
    const n = 360 / h.azimuthStepDeg;
    if (!(h.azimuthStepDeg > 0) || Math.abs(n - Math.round(n)) > 1e-9) {
      throw new DataError("bad-shape", `${url}: horizon step ${h.azimuthStepDeg}° does not divide 360°`);
    }
    expectLength(url, `horizons[${h.antennaHeightM} m].elevationDeg`, h.elevationDeg, Math.round(n), `azimuths at ${h.azimuthStepDeg}°`);
  }
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
  if (!file) throw new DataError("data-file-missing", `no ${configId} file for site ${siteId}`, true);
  const url = `${root}/${file}`;
  const loaded = await getJson<RelayLinkData>(url);
  checkRelay(url, index, siteId, configId, loaded.data);
  return loaded;
}

function checkRelay(url: string, index: DatasetIndex, siteId: string, configId: string, data: RelayLinkData) {
  expectKeys(url, data, ["schemaVersion", "siteId", "configId", "window", "satellites"]);
  expectId(url, "siteId", data.siteId, siteId);
  expectId(url, "configId", data.configId, configId);
  expectWindow(url, data.window, index.window);
  for (const sat of data.satellites) {
    for (const [name, s] of [
      ["azimuthDeg", sat.azimuthDeg],
      ["elevationDeg", sat.elevationDeg],
      ["rangeKm", sat.rangeKm],
      ["seesEarth", sat.seesEarth],
    ] as const) {
      expectLength(url, `${sat.id}.${name}`, s, data.window.count);
    }
  }
}

/** The optional live point server (D-25), set once in Netlify. Unset means offline. */
const POINT_SERVER_URL = (process.env.NEXT_PUBLIC_POINT_SERVER_URL ?? "").replace(/\/+$/, "");
const POINT_TIMEOUT_MS = 30_000; // a new point takes ~5 s on the server; leave room for a cold Horizons cache

export type LivePoint = { meta: SiteMeta; site: SiteData; relays: Record<string, RelayLinkData> };

/**
 * Pick a point (F8): the server's reply, checked like the files. Throws DataError "point-rejected" with the server's
 * reason when it refuses the input (HTTP 400), and "point-offline" when there's no server, no answer in time, or a 5xx.
 */
export async function loadPoint(index: DatasetIndex, latDeg: number, lonEastDeg: number): Promise<LivePoint> {
  if (!POINT_SERVER_URL) throw new DataError("point-offline", "no point server configured");
  const url = `${POINT_SERVER_URL}/point?lat=${latDeg}&lon=${lonEastDeg}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(POINT_TIMEOUT_MS) });
  } catch {
    throw new DataError("point-offline", url);
  }
  if (res.status === 400) {
    const body: unknown = await res.json().catch(() => null);
    const reason = (body as { error?: unknown } | null)?.error;
    throw new DataError("point-rejected", typeof reason === "string" ? reason : "the server refused this point");
  }
  if (!res.ok) throw new DataError("point-offline", `${url} (HTTP ${res.status})`);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new DataError("bad-shape", `${url} is not valid JSON`);
  }
  const { meta, site, relays } = (raw ?? {}) as Partial<LivePoint>;
  if (typeof meta?.id !== "string" || !Number.isFinite(meta.latDeg) || !Number.isFinite(meta.lonEastDeg) || !Array.isArray(meta.antennaHeightsM)) {
    throw new DataError("bad-shape", `${url}: meta needs id, latDeg, lonEastDeg and antennaHeightsM`);
  }
  if (!site || typeof relays !== "object" || relays === null) throw new DataError("bad-shape", `${url}: needs site and relays`);
  checkSite(url, index, meta, site);
  for (const [configId, r] of Object.entries(relays)) {
    if (!index.relayConfigs.some((c) => c.id === configId)) throw new DataError("config-not-found", `${url}: ${configId}`);
    checkRelay(url, index, meta.id, configId, r);
  }
  return { meta, site, relays };
}
