// Source of truth for public/data/*.json and browser results.
// Mirrors docs/data-contracts.md: change both in the same PR (CLAUDE.md §3).

// ---------- shared ----------
export interface TimeGrid {
  startUtc: string;        // "2027-01-01T00:00:00Z"
  stepSeconds: number;     // 600
  count: number;           // number of samples
}

export interface Provenance {
  source: string;          // "JPL Horizons API", "LOLA GDR LDEM_75S_120M", "relay_orbits.csv (NASA LCRNS reference constellation v3.1)"
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
  defaults: { minElevationDeg: number; durationDays: number };
}

export interface SiteMeta {
  id: string;                          // "site01_connecting_ridge"
  name: string;
  latDeg: number;
  lonEastDeg: number;
  heightM: number | null;              // above 1737.4 km sphere
  dataFile: string;                    // "sites/site01_connecting_ridge.json"
  source: Provenance;
}

export interface RelayConfigMeta {
  id: string;                          // "lcrns-ref-5sat"
  name: string;
  kind: "simulated-reference";         // never presented as an operational constellation
  description: string;                 // what it represents and what it doesn't
  satelliteCount: number;
  basedOn: Provenance;                 // e.g. NASA LCRNS reference constellation v3.1 (D-19)
  dataFiles: Record<string, string>;   // siteId -> "relays/<siteId>/<configId>.json"
}

// ---------- public/data/sites/<siteId>.json ----------
export interface SiteData {
  schemaVersion: 1;
  siteId: string;
  window: TimeGrid;
  horizon: {
    azimuthStepDeg: number;            // e.g. 0.5 → 720 values
    elevationDeg: number[];            // terrain horizon, index k at azimuth k × step
    maxRangeKm: number;
    demResolutionM: { nearField: number; farField: number };
    source: Provenance;
    uncertainty: Uncertainty;
  };
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

// ---------- public/data/relays/<siteId>/<configId>.json ----------
export interface RelayLinkData {
  schemaVersion: 1;
  siteId: string;
  configId: string;
  window: TimeGrid;
  satellites: SatelliteSeries[];
}

// Stored exactly as published (data/relay_orbits.csv), so every orbit traces to its source table (D-19).
export interface KeplerElements {
  aKm: number; e: number; iDeg: number; argpDeg: number; raanDeg: number;
  trueAnomalyDeg: number;              // at epochUtc, as published (LCRNS and Lunar Pathfinder give true anomaly)
  epochUtc: string;                    // when trueAnomalyDeg applies, e.g. "2027-03-01T00:00:00Z"
  frame: string;                       // reference frame of i/raan/argp, e.g. "Moon PA at J2000 (≈ IAU body frame, 0.03°)"
  frameEpochUtc: string;               // epoch the frame is frozen at: "2000-01-01T12:00:00Z" for LCRNS
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
  uncertainty: Uncertainty;            // two-body, reference (not final) design, assumed epoch/RAAN where unpublished
}

export interface Scenario {
  siteId: string;
  startUtc: string;          // must fall inside index.window
  durationDays: number;
  relayConfigId: string | null;   // null = direct-to-Earth only
  minElevationDeg: number;        // link mask above the terrain horizon (default from index)
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
