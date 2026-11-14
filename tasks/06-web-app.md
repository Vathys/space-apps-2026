# 06 · Web app: API + UI (P1–P3)

**Goal:** A web app where a planner picks sites and dates, sees Sun/Earth over the real horizon, and compares two scenarios side by side.
**Owner:** TBD

## Setup
- [ ] **UI0** Choose the web stack: frontend framework, charting library, backend, hosting (1h). **Blocking.** See [open-questions](../docs/open-questions.md)
- [ ] **UI8** Scaffold the web app + API skeleton, with one "hello" endpoint wired end to end (2h). Depends on UI0

## API (src/api, src/compare)
- [ ] **AP1** Endpoints (3h). Depends on UI8, SC1
  - `GET /sites` · `GET /sites/{id}/horizon` · `GET /visibility?site&start&end` · `GET /suitability?site&...` · `GET /science/{id}` · `GET /compare?a=site,date&b=site,date`
  - Serve precomputed JSON from data/processed first. Compute live later
- [ ] **AP2** Compare logic: merge visibility + suitability + science for two scenarios, including date shift (VS5) (2h). Depends on VS3, LS3, SC5

## UI (app/)
- [ ] **UI1** Site & date picker: curated list + custom lat/lon (3h). Depends on UI8, AP1
- [ ] **UI2** Sky/horizon chart: terrain horizon profile with Sun and Earth tracks (4h). Depends on VS2, AP1
- [ ] **UI3** Timeline of sunlight and Earth-comm windows (3h). Depends on VS3, AP1
- [ ] **UI4** Side-by-side compare page: metrics table, suitability, science card (4h). Depends on AP2, UI2, UI3
- [ ] **UI5** *(stretch)* Planner vs public mode with plain-language text (2h). Depends on UI4
- [ ] **UI6** *(stretch)* Map view with slope overlay + LROC image (3h). Depends on TR4, TR5
- [ ] **UI7** Responsive layout + loading/error states for the demo (2h). Depends on UI4

## Ship
- [ ] **DP1** Deploy to a public URL for the judges, and test it on a phone and on a fresh browser (2h). Depends on UI4
