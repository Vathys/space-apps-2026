# LunaNav: Lunar Communication Network Planner

Our team's entry for the **2026 NASA Space Apps Challenge**, [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details).

> **Status:** architecture agreed in principle, Day-1 build starting. Live app: _Vercel URL added at task S4_.
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
- **Online (your browser):** the Next.js app on Vercel loads that JSON and does the communication
  analysis instantly as you change dates and configurations. No server runs any computation.

Diagrams: [docs/architecture.md](docs/architecture.md). Data shapes: [docs/data-contracts.md](docs/data-contracts.md).

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

Deployment: every merge to `main` deploys to Vercel as a static site (`output: "export"`).

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
| Amisha | UI & Vercel |
