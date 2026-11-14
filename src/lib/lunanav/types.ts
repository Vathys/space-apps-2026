// Source of truth for public/data/*.json and browser results.
// Mirrors docs/data-contracts.md: change both in the same PR (CLAUDE.md §3).

// ---------- shared ----------
export interface TimeGrid {
  startUtc: string;        // "2027-01-01T00:00:00Z"
  stepSeconds: number;     // 600
  count: number;           // number of samples
}

export interface Provenance {
  source: string;          // "JPL Horizons API", "LOLA GDR LDEM_75S_120M", "relays.csv (Queqiao-2, S. Tilley 2024-09-22)"
  query?: string;          // exact Horizons query or product ID
  url?: string;
  generatedAtUtc: string;
  notes?: string;
}

export interface Uncertainty {
  summary: string;         // plain words; "unknown" if unknown, never omitted
  magnitude?: string;      // e.g. "±0.1° horizon from 120 m DEM beyond 10 km"
}

// ---------- public/data/index.json ----------
export interface DatasetIndex {
  schemaVersion: 1;
  window: TimeGrid;                    // the ONLY dates the app supports
  frame: "moon-body-fixed-planetocentric-east";
  moonRadiusKm: 1737.4;
  sites: SiteMeta[];
  relayConfigs: RelayConfigMeta[];
  defaults: { minElevationDeg: number; durationDays: number; antennaHeightM: number };  // antennaHeightM: e.g. 2
}

export interface SiteMeta {
  id: string;                          // "site01_connecting_ridge"
  name: string;
  latDeg: number;
  lonEastDeg: number;
  heightM: number | null;              // ground height above 1737.4 km sphere
  antennaHeightsM: number[];           // antenna/tower heights above ground with a precomputed horizon, e.g. [2] (P0) or [2, 10, 20, 50]
  dataFile: string;                    // "sites/site01_connecting_ridge.json"
  source: Provenance;
}

export interface RelayConfigMeta {
  id: string;                          // "qq2-like-elfo-1"
  name: string;
  kind: "simulated-reference";         // never presented as an operational constellation
  description: string;                 // what it represents and what it doesn't
  satelliteCount: number;
  basedOn: Provenance;                 // e.g. Queqiao-2 published elements, NASA LCRNS reference
  dataFiles: Record<string, string>;   // siteId -> "relays/<siteId>/<configId>.json"
}

// ---------- public/data/sites/<siteId>.json ----------
export interface SiteData {
  schemaVersion: 1;
  siteId: string;
  window: TimeGrid;
  horizons: HorizonProfile[];          // one per antenna height, same heights as SiteMeta.antennaHeightsM
  sun: {                               // Sun centre, smooth horizontal
    azimuthDeg: number[];
    elevationDeg: number[];
    angularRadiusDeg: number;          // ~0.27, for partial-disk sunlight
    source: Provenance;
    uncertainty: Uncertainty;
  };
  earth: {                             // Earth centre, smooth horizontal
    azimuthDeg: number[];
    elevationDeg: number[];
    rangeKm: number[];
    source: Provenance;
    uncertainty: Uncertainty;
  };
}

// Terrain horizon seen from an antenna antennaHeightM above the ground. Only the horizon depends on
// antenna height: Sun, Earth and relays are far enough away that their az/el don't change measurably.
export interface HorizonProfile {
  antennaHeightM: number;              // above local ground (mast/tower), not above the 1737.4 km sphere
  azimuthStepDeg: number;              // e.g. 0.5 → 720 values
  elevationDeg: number[];              // terrain horizon, index k at azimuth k × step
  maxRangeKm: number;
  demResolutionM: { nearField: number; farField: number };
  source: Provenance;
  uncertainty: Uncertainty;
}

// ---------- public/data/relays/<siteId>/<configId>.json ----------
export interface RelayLinkData {
  schemaVersion: 1;
  siteId: string;
  configId: string;
  window: TimeGrid;
  satellites: SatelliteSeries[];
}

export interface KeplerElements {
  aKm: number; e: number; iDeg: number; argpDeg: number; raanDeg: number; meanAnomalyDeg: number;
  epochUtc: string;
}

export interface SatelliteSeries {
  id: string;
  name: string;
  elements: KeplerElements;            // what was propagated
  azimuthDeg: number[];                // from the site, smooth horizontal
  elevationDeg: number[];
  rangeKm: number[];
  seesEarth: (0 | 1)[];                // relay → Earth line not blocked by the Moon
  source: Provenance;
  uncertainty: Uncertainty;            // two-body, assumed argp/RAAN, uniform Moon spin
}

export interface Scenario {
  siteId: string;
  startUtc: string;          // must fall inside index.window
  durationDays: number;
  relayConfigId: string | null;   // null = direct-to-Earth only
  minElevationDeg: number;        // link mask above the terrain horizon (default from index)
  antennaHeightM: number;         // picks SiteData.horizons[]; must be one of SiteMeta.antennaHeightsM
}

export interface BlackoutInterval {
  startUtc: string;
  endUtc: string;            // exclusive: first connected sample
  durationHours: number;
  openStart: boolean;        // already in blackout at the slice's first sample: may have started earlier
  openEnd: boolean;          // still in blackout at the slice's last sample: endUtc = time of sample endIndex, may last longer
}

export interface CoverageSummary {
  samples: number;
  coveragePct: number;        // connected (DTE OR relay)
  dteCoveragePct: number;     // direct only
  relayGainPct: number;       // coveragePct − dteCoveragePct
  sunlitPct: number;          // mean sunlit fraction × 100
  longestBlackoutHours: number;
  blackoutCount: number;
}

export interface ConnectivityResult {
  scenario: Scenario;
  slice: { startIndex: number; endIndex: number };   // into the file series; endIndex exclusive
  dte: Uint8Array;
  relayPerSatellite: Record<string, Uint8Array>;      // complete path via that satellite
  connected: Uint8Array;
  sunlitFraction: Float32Array;                       // 0..1 of the Sun's disk above terrain
  summary: CoverageSummary;
  blackouts: BlackoutInterval[];
  provenance: Provenance[];                            // collected from the files used
  caveat: "Geometric line-of-sight only: no link budget, scheduling or interference.";
}

export type ScenarioError =
  | { code: "outside-window"; supported: TimeGrid }
  | { code: "site-not-found" | "config-not-found" | "data-file-missing"; detail: string };
