# Architecture: LunaNav, Lunar Communication Network Planner

Status: **proposed** (see [decisions.md](decisions.md), D-10 to D-17). Data shapes: [data-contracts.md](data-contracts.md).

## In one paragraph

LunaNav is a **static-first** Next.js app hosted on **Vercel**. All heavy science runs **offline in
Python** (uv): Horizons ephemeris, LOLA terrain horizons, relay-orbit propagation and the geometry
that turns all of it into per-site azimuth/elevation series. That pipeline writes compact JSON into
`public/data/`, which is committed and served by Vercel's CDN. The browser loads one site file and
one relay file. It then evaluates, sample by sample, whether a **complete path to Earth** exists
(direct, or via a relay), and computes coverage % and blackout intervals. No backend, no database,
no Python on Vercel.

## Where computation happens

| Step | Where | Why there |
|---|---|---|
| Horizons queries, DEM reading, horizon ray-casting, Kepler propagation, Moon-fixed → topocentric conversion, relay–Earth occultation | **Python, offline** (`data/`) | Slow, needs network or rasterio/NumPy, deterministic: compute once |
| Terrain mask lookup, minimum-elevation mask, path logic (DTE OR relay), coverage %, blackout intervals, sunlight fraction, slicing to the chosen date and duration | **Browser** (`src/lib/lunanav/`) | Cheap boolean and array work (~13k samples). Lets the user change date, duration, elevation mask and relay config instantly |
| Formatting, charts, comparison | **Browser** (`src/components/`, `src/app/`) | Render only, no math |

---

## 1. Vercel static-first deployment

```mermaid
flowchart LR
  subgraph OFF["Offline: a developer laptop (Python + uv)"]
    HZ["JPL Horizons API"] --> PY["data/*.py pipeline"]
    DEM["LOLA GDR + PGDA DEMs"] --> PY
    REL["data/relays.csv"] --> PY
    PY --> OUT["public/data/*.json"]
  end
  OUT -->|"PR merged to main"| GH[("GitHub: main")]
  GH -->|"push triggers build: bun install, bun run build (output: export)"| VB["Vercel build"]
  VB --> CDN["Vercel CDN: static HTML, JS, JSON"]
  CDN -->|"page + /data/*.json"| BR["User's browser: all interactive analysis"]
```

- `next.config` uses `output: "export"`. Vercel framework preset: **Next.js**, install `bun install`,
  build `bun run build`. Python is never run on Vercel. `pyproject.toml` at the root is ignored by the
  Next.js preset (verify at F1).
- Every PR gets a Vercel preview URL. `main` is production and is the demo.

## 2. NASA data preprocessing pipeline (offline)

```mermaid
flowchart TB
  subgraph SRC["Sources (cached in data/raw/, gitignored)"]
    H1["Horizons observer tables: Sun, Earth az/el at each site"]
    H2["Horizons Moon-fixed Earth track: sub-Earth lat, lon, range"]
    D1["LOLA LDEM_75S_120M: 120 m, to 75S"]
    D2["PGDA 5 m site DEMs: near field"]
    RC["relays.csv: orbital elements + sources"]
  end
  H1 --> SITE["data/sites.py: sun/earth series per site"]
  D1 --> TER["data/terrain.py: 360-degree horizon profile, near field from 5 m, far field from 120 m, plus lunar curvature"]
  D2 --> TER
  RC --> ORB["data/relays.py: two-body propagation, Moon-fixed positions"]
  H2 --> ORB
  ORB --> GEO["data/geometry.py: Moon-fixed to topocentric az/el; relay-Earth occultation"]
  TER --> PRE["data/precompute.py: validate + write JSON"]
  SITE --> PRE
  GEO --> PRE
  PRE --> J1["public/data/index.json"]
  PRE --> J2["public/data/sites/SITE.json"]
  PRE --> J3["public/data/relays/SITE/CONFIG.json"]
```

Every output carries a `provenance` block (exact query or product) and an `uncertainty` block.

## 3. Lunar orbit and relay network computation (offline, per relay config)

```mermaid
flowchart TB
  EL["Orbital elements a, e, i, argp, RAAN, M0 (relays.csv or a reference config)"] --> KEP["Kepler propagation in a Moon-centred inertial frame, mu_Moon = 4902.8 km^3/s^2"]
  KEP --> ROT["Rotate to Moon-fixed: uniform spin about the pole, 27.3217 d sidereal"]
  ROT --> SATP["Satellite position, Moon-fixed, km, per sample"]
  EV["Earth unit vector, Moon-fixed (Horizons track)"] --> OCC
  SATP --> OCC{"Is the satellite-to-Earth line blocked by the Moon sphere, R = 1737.4 km?"}
  OCC -->|"no"| SE1["seesEarth = 1"]
  OCC -->|"yes"| SE0["seesEarth = 0"]
  SATP --> TOPO["Topocentric az/el/range from each site"]
  TOPO --> FILE["relays/SITE/CONFIG.json"]
  SE1 --> FILE
  SE0 --> FILE
```

Occultation test, with **s** the satellite position and **ê** the Earth unit vector (Earth treated as
infinitely far, which holds at 384,000 km): visible if `s·ê ≥ 0`, otherwise visible if `|s − (s·ê)ê| > R`.

**Documented shortcuts** (marked in code as `// shortcut:`):
- **Two-body orbits:** no J2 and no Earth third-body perturbation. Frozen orbits are chosen to stay stable, so this holds for coverage statistics but not for operations.
- **Simplified Moon rotation:** uniform spin, ignoring physical libration. Earth's libration is still captured, because the Earth vector comes from Horizons.
- **Queqiao-2's argp/RAAN are unknown.** Per `relays.csv`, argp = 90° (apolune over the south pole) and RAAN is a stated assumption.

## 4. Direct versus relay communication (browser, per sample *t*)

```mermaid
flowchart TB
  T["Sample t"] --> DTE{"Earth elevation at site > terrain horizon at Earth's azimuth + min mask?"}
  DTE -->|"yes"| C1["DTE available"]
  DTE -->|"no"| D0["DTE blocked"]
  T --> LOOP["For each satellite k in the selected config"]
  LOOP --> UP{"Satellite elevation > terrain horizon at its azimuth + min mask?"}
  UP -->|"yes"| DOWN{"seesEarth k at t?"}
  UP -->|"no"| NOK["path via k broken"]
  DOWN -->|"yes"| ROK["relay path via k complete"]
  DOWN -->|"no"| NOK
  C1 --> CON
  ROK --> CON["connected t = DTE OR any complete relay path"]
  CON --> MET["Coverage %, blackout intervals, longest blackout, relay gain over DTE"]
```

- **Connected means a complete geometric path.** The lander seeing a relay that can't see Earth does **not** count.
- **Geometric visibility is not guaranteed connectivity.** There's no link budget, no DSN scheduling, no inter-satellite links. The UI says this next to every metric.

## 5. User request and browser-side analysis

```mermaid
sequenceDiagram
  actor U as Mission planner
  participant P as Next.js page (static, on Vercel)
  participant D as /data JSON (Vercel CDN)
  participant V as lib/lunanav/visibility.ts
  participant N as lib/lunanav/network.ts
  U->>P: Open LunaNav
  P->>D: GET /data/index.json
  D-->>P: sites, relay configs, supported window
  U->>P: Pick site, start date, duration
  alt Date range outside supported window
    P-->>U: "Outside supported data window" (no numbers shown)
  else Inside window
    P->>D: GET /data/sites/SITE.json
    D-->>P: horizon, Sun and Earth series
    P->>V: masks for the selected slice
    V-->>P: DTE and sunlit series
    P-->>U: DTE timeline, sunlight, coverage, blackouts
    U->>P: Enable relay config
    P->>D: GET /data/relays/SITE/CONFIG.json
    D-->>P: satellite az/el + seesEarth series
    P->>N: evaluate paths (DTE OR relay)
    N-->>P: connected series, coverage summary, blackout intervals
    P-->>U: Direct vs relay comparison
    U->>P: Change site or date (Scenario B)
    P-->>U: Side-by-side A vs B
  end
```

## 6. Ownership and integration boundaries

```mermaid
flowchart LR
  subgraph D2["Dev 2: NASA data and lunar geometry"]
    G1["data/horizons.py, lola.py, pgda.py"]
    G2["data/terrain.py, data/sites.py"]
    G3["data/geometry.py"]
    G4["src/lib/lunanav/visibility.ts"]
  end
  subgraph D1["Dev 1: satellite simulation and networking"]
    N1["data/relays.py"]
    N2["data/precompute.py"]
    N3["src/lib/lunanav/network.ts"]
    N0["src/lib/lunanav/types.ts (contract owner)"]
  end
  subgraph D3["Dev 3: frontend and Vercel"]
    F1["src/app/*, src/components/*"]
    F2["Vercel project + deploy"]
  end
  G2 -->|"site series"| N2
  G3 -->|"topocentric + occultation functions"| N1
  N2 -->|"public/data/*.json (contract)"| F1
  G4 -->|"DTE and sunlit masks"| N3
  N3 -->|"ConnectivityResult"| F1
  N0 -.->|"shapes for all"| G2
  N0 -.->|"shapes for all"| F1
```

**Integration contracts** (each owned by one person; change only in a PR the other two have seen):

| Boundary | Producer → consumer | Contract |
|---|---|---|
| Site series | Dev 2 → Dev 1 | `SiteData` in [data-contracts.md](data-contracts.md) |
| Geometry functions | Dev 2 → Dev 1 | `geometry.topocentric(site, positions_km)`, `geometry.sees_earth(positions_km, earth_unit)` |
| JSON files | Dev 1 → Dev 3 | `DatasetIndex`, `SiteData`, `RelayLinkData` |
| Browser masks | Dev 2 → Dev 1 | `visibility.ts` functions returning `Uint8Array` / `Float32Array` |
| Analysis result | Dev 1 → Dev 3 | `ConnectivityResult` |

## Size and performance budget

- **Supported window (proposed, "To decide at H0" in decisions.md):** 2027-01-01T00:00Z → 2027-04-01T00:00Z at a 10-minute step, which is 12,961 samples.
- **File sizes:** a site file is about 0.4 MB; a relay file is about 0.3 MB per satellite. Values are rounded to 0.01°. Vercel gzips both.
- **Total budget:** under 10 MB in `public/data/`, and no single file over 2 MB.
- **Browser cost:** about 13k samples × a few satellites of boolean work, under 50 ms. No web worker is needed.

## 7. 3D lander sky view (F7, P1, D-21)

```mermaid
flowchart LR
  SD["SiteData: horizon, sun, earth az/el"] --> SV
  RD["RelayLinkData: satellites az/el/range"] --> SV
  CR["ConnectivityResult (network.ts): connected per sample"] --> SV
  TS["Timeline scrubber: sample index"] --> SV
  SV["SkyView (three.js, client-only, next/dynamic ssr:false)"] --> OUT["Scene + same numbers in a table"]
```

The scene is the lander's local sky: azimuth/elevation map directly to a dome around the viewer. It adds
no data and no contract field. Satellite distance is not to scale (labelled). It never computes a
metric: link colour and numbers come from `network.ts`. Cost: `three`, `@react-three/fiber`,
`@react-three/drei`, loaded only on the client so `output: "export"` still builds.
