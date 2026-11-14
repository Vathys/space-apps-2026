# Lunar Landing Site Navigator

Our team's entry for the **2026 NASA Space Apps Challenge**, [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details).

> **Status:** early setup. The tech stack and architecture aren't decided yet.

## The problem

Choosing where and when to land on the Moon depends on two questions:

- **Power:** Where is the Sun relative to the local horizon? Solar elevation drives solar array output and thermal conditions.
- **Communications:** Is Earth above the horizon? Earth visibility decides whether the lander can talk to Earth directly without a relay satellite.

At the lunar south pole, where many upcoming CLPS and Artemis-era missions are headed because of water ice, low Sun angles and rugged terrain make both answers very sensitive to small changes in location or date. Missions also slip often (hardware delays, launch changes), so planners need to re-evaluate nearby sites or new dates quickly.

Tools such as LROC Quickmap, Moon Trek, and JPL Horizons already have the underlying data. They are built for detailed analysis, though, not for quickly comparing many site/date scenarios, and non-specialists find them hard to use.

## Our goal

Build an intuitive tool that lets mission planners, educators, and the public **compare lunar landing sites and dates quickly**, showing Sun and Earth positions relative to the local horizon so they can judge power potential and direct-to-Earth communication windows.

### Planned features

> Task breakdown, owners and dependencies: **[tasks/BOARD.md](tasks/BOARD.md)** · Data needs: [docs/data-needs.md](docs/data-needs.md) · Open decisions: [docs/open-questions.md](docs/open-questions.md)

- [ ] **Site selection:** a curated list of notable sites (Apollo, CLPS targets, commercial and international missions) plus custom lat/lon input
- [ ] **Side-by-side comparison** of multiple sites and/or dates
- [ ] **Date and time selection** and exploration across lunar days and seasons
- [ ] **Sun and Earth sky view:** azimuth and elevation against the local (terrain-aware) horizon
- [ ] **Operational metrics:** solar elevation angle, sunlight duration, Earth visibility windows, and time to sunset / Earthset
- [ ] **Timeline and animation** of Sun and Earth motion over a lunar day
- [ ] **Terrain-aware horizon** built from LOLA topography (no atmosphere means no refraction, so terrain and lunar curvature set the horizon)
- [ ] **Modes for different audiences:** technical detail for planners, plain explanations for educators and the public

### Technical considerations

- **Ephemeris:** get Sun and Earth positions from JPL Horizons (API or pre-computed tables) for topocentric lunar observers.
- **Topography:** use LOLA DEMs to compute the horizon profile around each site; this matters most near the south pole's steep slopes and deep craters.
- **Libration:** Earth's apparent position in the lunar sky wobbles because of lunar libration. This is critical for near-limb sites like the south pole, where Earth sits close to the horizon.
- **Visualization:** 2D sky charts / horizon plots, map views, and possibly 3D surface rendering.

## Resources

| Resource | Description |
| --- | --- |
| [LROC Quickmap](https://quickmap.lroc.asu.edu/) | Interactive LRO imagery and topography maps (ASU) |
| [NASA Moon Trek](https://trek.nasa.gov/moon/) | 3D lunar surface visualization and topographic data |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | Ephemeris service for Sun and Earth positions from any lunar location |
| [CSA Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Canadian Space Agency lunar exploration portal |

## Getting started

_TBD: setup and run instructions will go here once the stack is chosen._

## Team

_TBD_
