# LunaNav: Lunar Communication Network Planner

Our team's entry for the **2026 NASA Space Apps Challenge**, [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details).

> **Status:** Day-1 build in progress: the planner runs on real data (JPL Horizons, LOLA/PGDA terrain, simulated LCRNS reference relays); site and relay config pending team sign-off. Live app: https://lunanav.pages.dev
> Plan: [tasks/BOARD.md](tasks/BOARD.md) · Architecture: [docs/architecture.md](docs/architecture.md) · Team rules: [CLAUDE.md](CLAUDE.md) · Decisions: [docs/decisions.md](docs/decisions.md)

## The problem

Many upcoming missions are headed to the lunar **south pole**. There, Earth sits within a few degrees of
the horizon and wobbles with lunar libration, so **direct-to-Earth (DTE) communication** keeps
dropping out, and nearby crater rims and ridges block it for long stretches. **Relay satellites** in
lunar orbit can provide another path, but working out how much a relay helps at a given site and date
takes specialist tools and hand-built analysis.

## Who it's for

**Early-stage lunar mission planners** who need a fast first answer to: *"If we land here, on these
dates, how often can we talk to Earth? With a relay, how much better is it?"*

## What LunaNav does

1. Pick a south-pole landing site.
2. Pick a mission start date and duration.
3. See **DTE line of sight** against the real terrain horizon, plus **sunlight** for the same period.
4. Turn on a **simulated relay satellite configuration**.
5. LunaNav checks, every 10 minutes, whether a **complete path** exists: lander → Earth, or
   lander → relay → Earth.
6. Compare **direct vs relay-assisted**: coverage %, number of blackouts, longest blackout.
7. Change the site, date or relay setup and compare scenarios side by side.

## How it works

- **Offline (Python):** JPL Horizons gives Sun and Earth positions. NASA LOLA elevation data (plus 5 m
  PGDA site models) gives a 360° terrain horizon around each site. Relay orbits are propagated from
  published orbital elements. All of it becomes compact JSON in `public/data/`.
- **Online (your browser):** the Next.js app on Cloudflare Pages loads that JSON and does the communication
  analysis instantly as you change dates and configurations. No server runs any computation.

Diagrams: [docs/architecture.md](docs/architecture.md). Data shapes: [docs/data-contracts.md](docs/data-contracts.md).

## How it relates to LunaNet

[LunaNet](https://www.nasa.gov/communicating-with-missions/scan/lcrns/lunanet-interoperability-specification/)
is the NASA–ESA–JAXA framework that lets several lunar relay networks work together, defined in the
LunaNet Interoperability Specification (LNIS v5, January 2025). NASA's LCRNS program buys
LunaNet-compatible relay service, and our default relay setup is LCRNS's published reference constellation. LunaNav does not
implement LunaNet. It answers a planning question that comes before it: when, at a given south-pole
site and date, does a lander have a geometric path to Earth, and how much would LunaNet-style relays add?

How our model lines up with LNIS v5:

- **Same priority region.** LNIS v5 names the south pole (and the far side) as the focus of LunaNet 1.0.
- **Same path rule.** LNIS treats Direct-with-Earth (DWE) and direct-to-Earth (DTE) as synonyms and
  says real-time service needs the full end-to-end path. We count a sample as connected only when a
  complete lander → Earth or lander → relay → Earth path exists.
- **Communication only, not navigation.** LNIS also defines a navigation broadcast with a goal of
  four satellites in view. LunaNav's coverage counts one complete communication path; it says nothing
  about navigation coverage.
- **Things LNIS v5 leaves open.** It sets no minimum elevation angle for surface users (our mask is
  a user setting, default 0°), and it defers the lunar reference frame and LunaNet Reference Time to a
  separate standard not yet published in v5. We use the IAU Moon body-fixed frame and UTC; nothing
  in LNIS v5 conflicts with either.
- **Out of scope here:** frequencies (S/Ka-band), link budgets, delay-tolerant networking and
  satellite-to-satellite crosslinks.

## Limitations (please read)

- **Geometric line of sight only.** "Connected" means a clear line of sight exists. It doesn't
  model link budgets, antennas, data rates, interference or DSN scheduling.
- **Relays are simulated reference configurations,** not live positions of operating satellites. The
  default uses the published orbits of NASA's LCRNS reference constellation, a government
  reference design that is not yet deployed. Only relays from Artemis Accords signatories are used.
- **Simplified orbits:** two-body propagation (Moon rotation from the IAU model). Good for coverage statistics,
  not for operations.
- **Supported dates only:** results exist only inside the precomputed window shown in the app.
  Outside it, the app says so instead of guessing.
- **Terrain resolution:** 5 m near the site, 120 m for distant terrain. Smaller obstacles aren't
  represented.

## Run it locally

```bash
# web app
bun install
bun run dev              # http://localhost:3000

# data pipeline (only to regenerate public/data/)
uv sync
uv run python -m data.precompute
```

Deployment: every merge to `main` deploys to Cloudflare Pages as a static site (`output: "export"`).

### Pick a point server (optional)

The deployed app never depends on it: when it doesn't answer, the app says live point analysis is offline
and offers the precomputed sites. When it runs, a user can pick any south-pole point (latitude −85° to the
pole) and get it computed live by the same pipeline functions that write `public/data/` (D-24, D-25).

```bash
uv run python -m data.point_server --port 8787    # listens on 127.0.0.1 only
tailscale funnel --bg 8787                        # public HTTPS at https://<machine>.<tailnet>.ts.net
```

- `GET /point?lat=-89.4869&lon=223.698` returns `{"meta": SiteMeta, "site": SiteData, "relays": {configId: RelayLinkData}}`,
  the same shapes as `public/data/`. Out-of-range input gets a 400. `GET /health` returns `{"ok": true}`.
- Needs the local caches from `uv run python -m data.lola` and `data.pgda` (DEMs) and network access to JPL Horizons
  for new points (each query is cached in `data/raw/horizons/cache/`). Replies are cached in `data/raw/points/`.
- Points outside the downloaded PGDA 5 m tiles use LOLA 120 m terrain all the way in; their horizon uncertainty says so.
- CORS allows `https://lunanav.pages.dev`, its preview deployments (`<hash>.lunanav.pages.dev`, `<branch>.lunanav.pages.dev`) and `http://localhost:3000` (override with the
  `POINT_SERVER_ORIGINS` regex). Set `NEXT_PUBLIC_POINT_SERVER_URL` in the Cloudflare Pages project's build variables (production and preview) to the Funnel address; Funnel
  keeps it fixed as long as the machine and tailnet names stay the same, and the machine must stay awake.

## Data sources

| Source | Used for |
|---|---|
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) ([API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)) | Sun and Earth positions from the lunar surface; Moon-fixed Earth direction |
| [LOLA GDR](https://imbrium.mit.edu/DATA/LOLA_GDR/) (`LDEM_75S_120M`) | Far-field terrain horizon |
| [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78) (LOLA 5 m, Barker et al. 2021) | Near-field terrain at south-pole sites |
| [data/relays.csv](data/relays.csv) | Relay orbital elements and status, with sources |
| [NASA Moon Trek](https://trek.nasa.gov/moon/) | Sanity-check maps (average Earth visibility) |

## Team

| Name | Role |
|---|---|
| Shaheen | Relay satellites & network math |
| Deep | NASA data & Moon geometry |
| Amisha | UI & Cloudflare Pages |
