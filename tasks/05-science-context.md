# 05 · Science context & site catalog (P3; SC1 is P1)

**Goal:** A curated site list, plus a science card per site with sources and confidence.
**Owner:** TBD

- [ ] **SC1** Curated site list (3h). **Blocks most other work. Do this first.**
  - Apollo, Luna, Chang'e, CLPS (e.g. IM-1 near Malapert A, IM-2 near Mons Mouton, Blue Ghost in Mare Crisium), Artemis III candidate regions
  - Out: `data/raw/sites/sites.csv` with id, name, lat, lon, category, source_url
- [ ] **SC2** Geology per site from the USGS Unified Geologic Map of the Moon (unit, age) (3h). Depends on SC1
- [ ] **SC3** Water/ice & PSR proximity for polar sites (LRO / PDS) (2h). Depends on SC1
- [ ] **SC4** Mission history & samples per site (NSSDCA, Apollo sample catalog) (2h). Depends on SC1
- [ ] **SC5** Science summary card per site: why it's interesting, evidence, citations, confidence (2h). Depends on SC2–SC4
  - Out: `data/processed/<site>_science.json` for the API
