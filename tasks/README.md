# tasks/

One file per workstream. The master list with dependencies is [BOARD.md](BOARD.md).

| # | Workstream | Priority | Code lives in |
|---|---|---|---|
| 01 | [Horizons data](01-data-horizons.md) | P1 | src/ingest, data/raw/horizons |
| 02 | [LOLA / LROC terrain](02-data-lola-lroc.md) | P1–P2 | src/ingest, data/raw/lola, data/raw/lroc |
| 03 | [Visibility engine](03-visibility-engine.md) | P1 | src/visibility |
| 04 | [Landing suitability](04-landing-suitability.md) | P2 | src/suitability |
| 05 | [Science context & site catalog](05-science-context.md) | P3 (SC1 is P1) | src/science, data/raw/sites, data/raw/usgs |
| 06 | [Web app: API + UI](06-web-app.md) | P1–P3 | src/api, src/compare, app |
| 07 | [Demo & pitch](07-demo-pitch.md) | — | docs |

Subtasks are sized for one person in roughly 1–4 hours. Owners are TBD.
