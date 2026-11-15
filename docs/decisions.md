# Decisions

One line per decision: ID · date · what · status · who agreed. Claude reads this before
proposing to change any of them. Change a decision in a PR, not in your own copy.
**Never delete a row:** mark it *superseded by D-xx* instead.

Status: **agreed** (team said yes) · **proposed** (written down, waiting for the team) ·
**superseded** (replaced, kept for history).

## Earlier decisions (2026-11-14, morning)

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-01 | Web app: Next.js (static export) + bun + Tailwind + shadcn, deployed to Vercel | agreed in PR #1; **reaffirmed by D-11**; **hosting superseded by D-22** | PR #1 approver |
| D-02 | Architecture: precompute offline, the app reads committed JSON only; no API routes, backend or database | agreed in PR #1; **reaffirmed by D-11**; **"no backend" relaxed by D-25** (one optional point server) | PR #1 approver |
| D-03 | Data pipeline is Python (uv) in `data/`; web app is TypeScript (bun). They meet only at `data/precomputed/*.json` | agreed in PR #1; **output folder superseded by D-12** (`public/data/`) | PR #1 approver |
| D-04 | South-pole DEMs: PGDA product 78, LOLA 5 m/px (Barker et al. 2021) for Connecting Ridge and Shackleton Rim | agreed; kept as the near-field DEM (D-15) | Vathys (via `main`) |
| D-05 | One-day build: no automated tests, no Docker | **superseded by D-13** (two-day schedule); "no automated test suite, no Docker" kept | PR #1 approver |
| D-06 | Workflow: `/contribute` + `/review` skills; nobody pushes to `main` | agreed; kept | PR #1 approver |
| D-07 | Scope: three priorities (terrain-aware Sun/Earth visibility, landing suitability, side-by-side science comparison) | **superseded by D-10** | PR #1 approver |
| D-08 | Three lanes A (ephemeris/visibility), B (terrain/suitability), C (science/UI) | **superseded by D-14** | PR #1 approver |

## New scope and schedule (2026-11-14, afternoon): proposed

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-10 | **Scope:** LunaNav becomes a *Lunar Communication Network Planner* for early-stage south-pole mission planners: DTE visibility, simulated relay network, direct vs relay coverage and blackouts, with Sun/Earth sunlight kept. Landing safety, geology and science ranking move to P2 (excluded). Answers PR #2's request to confirm the relay scope | proposed | TBD |
| D-11 | **Deployment:** static-first Next.js export on Vercel; no Python, FastAPI, database, Docker, Redis or Kubernetes at runtime. **Hosting part superseded by D-22 (Netlify)**; **"no FastAPI/Python at runtime" relaxed by D-25** (one optional point server, not on Netlify) | proposed | TBD |
| D-12 | **Data location:** `data/precompute.py` writes to `public/data/` (index.json, sites/, relays/) so Vercel serves it from the CDN. Replaces `data/precomputed/` | proposed | TBD |
| D-13 | **Schedule:** two-day hackathon; all development, integration and first deployment finish on Day 1 (feature freeze H12); Day 2 is touch-ups only; final submission freeze 3 h before the deadline | proposed | TBD |
| D-14 | **Ownership:** Dev 1 satellite simulation & networking · Dev 2 NASA data & lunar geometry · Dev 3 frontend & Vercel (files in CLAUDE.md §4) | proposed | TBD |
| D-15 | **Terrain horizon:** PGDA 5 m near field + LOLA `LDEM_75S_120M` (120 m) far field to ≥ 150 km, 0.5° azimuth step, lunar curvature included | proposed (depends on PR #2's `lola.py`) | TBD |
| D-16 | **Relay model:** two-body Kepler + uniform Moon spin; configs are *simulated reference* orbits (P0: one Queqiao-2-like elliptical frozen orbit, elements from `relays.csv`, argp = 90°, RAAN stated); NASA LCRNS used as a reference, never presented as deployed | **superseded by D-18 and D-19** (Queqiao-2 fails the Accords rule; uniform spin can't place LCRNS's published orbits) | — |
| D-17 | **Connectivity rule:** a sample is connected only if DTE is clear **or** some relay is above the lander's terrain horizon + mask **and** sees Earth. Geometric line-of-sight only: no link budget, DSN scheduling or inter-satellite links | proposed | TBD |

## Relays, site and mask (2026-11-14, evening): proposed in #35

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-18 | **Artemis Accords rule:** relay configs are based only on relays whose operator's country has signed the [Artemis Accords](https://www.nasa.gov/artemis-accords/). We judge by operator country, because ESA as an agency isn't a party (Lunar Pathfinder → SSTL, UK; Moonlight → Telespazio, Italy). Each relay's status and signing date are in the `operator_country`, `artemis_accords` and `accords_signed` columns of `data/relays.csv`. This rules out Queqiao-1/2, Tiandu-1/2 and the ILRS Queqiao constellation, so it replaces the Queqiao-2-based P0 relay in D-16. Consequence to state in the pitch: no Accords relay offers south-pole relay service today, so for now the app compares DTE with *planned* relays | proposed | Deep (proposer) |
| D-19 | **Relay model (replaces D-16):** P0 relay config `lcrns-ref-5sat` = NASA's [LCRNS reference constellation v3.1](https://www.nasa.gov/wp-content/uploads/2025/08/nasa-lunar-communications-relay-and-navigation-systems-lcrns-reference-constellation-3-1.pdf), using the published orbits from its Tables 1–2 (5 satellites, ~30 h elliptical frozen orbits, apolune over the south pole, reference epoch 2027-03-01 00:00 UTC per the PDF, inside the window). Copied into `data/relay_orbits.csv`, which joins to `relays.csv` by its `relay` column. The epoch is where the published elements apply, **not a deployment date**: the constellation isn't deployed in any month of the window, so every relay result is "if this reference design were in place" and labeled that way. The elements are in the Moon principal-axis frame frozen at J2000 (= 12:00 TT, stored as 11:58:55.816 UTC; checked: the IAU J2000 body frame agrees within 0.03°; elements rebuilt to ICRF reproduce the published states within 10 km). Propagation is two-body, backward 2 months and forward 1 month from the epoch (a stated shortcut: no gravity field or Earth pull). Rotation to Moon-fixed uses the **IAU 2015 lunar rotation model** (the frame Horizons uses), not uniform spin, because the published RAANs are tied to an inertial frame. The contract stores the elements exactly as published (`KeplerElements.trueAnomalyDeg`, `frame`, `frameEpochUtc`); the true-to-mean anomaly conversion happens only inside `relays.py`. Lunar Pathfinder has elements only (no published state), so N1's ≲ 10 km state check covers the LCRNS rows. P1 configs: `lcrns-ref-1sat` (SV-1 only: the first satellite before the full constellation) and `lunar-pathfinder` (SSTL service-guide baseline; epoch, RAAN and phase assumed). LCRNS is a government reference design for the Intuitive Machines NSN relays, never presented as deployed: IM chooses the final design | proposed | Deep (proposer) |
| D-20 | **Elevation-mask slider (changes the F3 plan):** keep a 0–10° slider, default 0° (geometric), applied to both DTE and lander→relay legs (D-17 unchanged). But it lives with the DTE results and is labeled "minimum elevation above terrain (affects direct-to-Earth most)". Checked 2026-11-14 at the **new** P0 coordinate over the **whole** window (2027-01-01 → 04-01, 12,961 samples), with G2's `data/terrain.py` horizon (2 m antenna) and the LCRNS orbits two-body + IAU rotation: the best LCRNS satellite that also sees Earth stays ≥ 41.0° above the terrain horizon (median 54°; Jan–Feb 41.7°, March 41.0°), so relay-assisted line of sight is 100% at masks 0°, 5° and 10°. DTE drops from 46.9% (0°) to 26.9% (5°) to 0.0% (10°): Earth's smooth elevation there is −7.50° to +6.23°. So the mask is a DTE sensitivity control. These are exploration numbers; the app's numbers come from `precompute.py` after G1/G2 are rerun at this coordinate. F3 done-when adds: raising the mask from 0° to 5° lowers DTE coverage, and the relay-assisted number is recomputed, not hidden | proposed | Deep (proposer) |

## To decide at H0 (fill in, then mark agreed)

| Decision | Proposed value | Value |
|---|---|---|
| Deadline (local time); Day-1 freeze; final submission freeze | Day-1 freeze H12; submission freeze deadline − 3 h | TBD |
| Names for Dev 1 / Dev 2 / Dev 3 | Shaheen / Deep / Amisha (UI) | Shaheen / Deep / Amisha, per Shaheen 2026-11-14; confirm at H0 |
| P0 site + coordinates | `site01_connecting_ridge` at **(−89.4869, 223.6980 E)**: the spot in the Site01 PGDA tile with the largest worst-case Earth clearance (notebook `04_comms_coverage`, 500 m grid; 1,887 m height, 790 m from the tile center). The old value (−89.4632, 222.5104 E) is the DEM's center, not a chosen spot: moving 350 m there flipped a day's DTE from 100% to 0%. Confirm with G2's 5 m horizon before H3, then update `SITES` in `data/horizons.py` and rerun G1/G2. Done in #54: `SITES` updated and G1/G2 rerun there (ground 1,889.0 m from the 5 m DEM, vs 1,887 m on the 500 m grid) | TBD |
| P1 site | `site04_shackleton_rim` (−89.7849, 204.0405 E): the flattest PGDA Site04 ROI point (`pgda.roi_points`; on the rim crest: 1,737 m, 2.2° slope, the highest ground within 1 km is 1,739 m; the tile's 1,805 m maximum is 8.2 km away, off the rim). The earlier DEM-bbox center (−89.7630, 187.9976 E) sits on Shackleton's inner wall (762 m, 33° slope; terrain horizon up to 34°), so it is not a rim site (G5, 2026-11-14) | TBD |
| Supported mission window + step | 2027-01-01T00:00Z → 2027-04-01T00:00Z, 10 min (12,961 samples). Current dumps end 2026-11-28, so new ones are needed | TBD |
| Minimum link elevation mask above terrain | 0° default (geometric), user-adjustable 0–10°, presented as a DTE sensitivity control (D-20) | TBD |
| P0 relay config | `lcrns-ref-5sat`: NASA LCRNS reference constellation v3.1, published orbits in `data/relay_orbits.csv` (D-19). Was `qq2-like-elfo-1` (Queqiao-2), dropped by D-18 | TBD |
| P1 relay configs | `lcrns-ref-1sat` (LCRNS SV-1 only), `lunar-pathfinder` (SSTL baseline, epoch/RAAN/phase assumed) (D-19) | TBD |
| Moon body-fixed frame (Horizons IAU vs LOLA MOON_ME) | Treat as equal; quantify in V2. Relay orbits are rotated with the IAU 2015 model, so they share Horizons' frame (D-19) | TBD |
| Demo scenario | Site01, direct-only vs `lcrns-ref-5sat`, then the date shifted +14 days | TBD |

## Open questions

- From the brainstorm: gravity anomalies, lunar seasons, temperature, seismic events. All out of scope under D-10.
- Real orbiter tracks (LRO, Danuri, Chandrayaan-2 from PR #2): Horizons predictions end before or near 2027 (Chandrayaan-2 2026-12-11, Danuri 2027-06-03), so they can't cover the proposed window. Use them only to validate the propagator, not as relay configs?

## Hosting (2026-11-14, evening): agreed orally

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-22 | **Hosting: Netlify instead of Vercel.** Same static export (`output: "export"`), published from `out/` by `netlify.toml`. Reason: the Vercel Hobby setup was blocked on the repo owner and a team-seat limit. Netlify still needs the repo owner to connect the repo once; it has free Deploy Previews on PRs. D-01, D-11, D-12 and D-14 keep their other content; read "Vercel" in them as Netlify | agreed (discussed orally by the team, 2026-11-14; recorded by Amisha) | team, oral; PR approver to confirm |

## 3D view (2026-11-14, evening): proposed

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-21 | **3D lander sky view (F7, P1):** a three.js scene, client-only, showing the sky as seen from the lander: terrain horizon ring, Sun, Earth, relay satellites, link state, starfield. It reads only existing `SiteData`/`RelayLinkData` fields, so **no contract change**. Not a globe and not photorealistic. Also covers a decorative 3D first-look hero (illustrative Moon, Earth and relay orbit, labelled not to scale, no data). First to be cut if CP3 slips past H8. Refines the P2 "3D globe" exclusion | proposed: approved by Shaheen (PR #34, 2026-11-14) | Shaheen; Deep pending |

## P1 timing (2026-11-14, evening): agreed orally

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-23 | **P1 may start before P0 is done.** Replaces "P1 only if P0 is done" (CLAUDE.md §2). A P1 task may be built in parallel on placeholder data, but P0 PRs are reviewed and merged first, a P1 task never holds up its owner's P0 rows, and P1 is cut first if CP3 slips past H8. "Never trade P0 for P1" still holds | agreed (discussed orally by the team, 2026-11-14; recorded by Deep) | team, oral; PR approver to confirm |

## Pick a point (2026-11-14, evening): agreed orally

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-24 | **"Pick a point" is in scope (P1).** The user picks any south-pole point and gets the same DTE/relay analysis. **Online:** the point server (D-25) computes it live with the same pipeline functions that write `public/data/`, and returns the same `SiteData`/`RelayLinkData` shapes, so no contract change. **Offline:** the app says the live server is offline and offers **9 more precomputed sites** (11 in all with site01 and site04). Live results say "computed live by the LunaNav point server". Under D-23 it may start in parallel with P0; it is cut with the other P1 rows if CP3 slips | agreed (discussed orally by the team, 2026-11-14; recorded by Deep) | team, oral; PR approver to confirm |
| D-25 | **One optional backend: `data/point_server.py`.** Lifts the "no backend" rule (D-02, D-11, CLAUDE.md) for this server only. It runs on Deep's machine, not on Netlify, exposed with **Tailscale Funnel**, which gives a fixed public HTTPS address (`https://<machine>.<tailnet>.ts.net`) that survives restarts as long as the machine and tailnet names stay the same; the app gets it from `NEXT_PUBLIC_POINT_SERVER_URL`, set once in Netlify. Plain Tailscale isn't enough: judges' browsers aren't on the tailnet. Funnel serves only on ports 443, 8443 or 10000, and the machine must be awake. It validates input (latitude/longitude range, south-pole cap only), allows CORS from the Netlify origins only, and caches results by point. The deployed app must work fully with it down: the Day-1 exit condition never depends on it. No database, no Docker | agreed (discussed orally by the team, 2026-11-14; recorded by Deep) | team, oral; PR approver to confirm |
| D-26 | **Data budget: `public/data/` < 30 MB total** (was 10 MB), each file still < 2 MB. Reason: 11 precomputed sites (D-24) with every relay config is about 20–27 MB | agreed (discussed orally by the team, 2026-11-14; recorded by Deep) | team, oral; PR approver to confirm |

## Science sanity check (V2, 2026-11-14): proposed

Notebook [`07_science_sanity_check`](../notebooks/07_science_sanity_check.ipynb), run on the committed `public/data/sites/` files (site01 at −89.4869, 223.6980 E; site04 at −89.7849, 204.0405 E; 2 m antenna, 0° mask).

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-27 | **DTE % vs NASA's Earth-visibility map.** Reference: LRO LOLA Average Earth Visibility, 60 m/px (Trek `AVGVISIB_85S_060M_201608_EARTH_SP`, Mazarico et al. 2011, Icarus 211; the raw Float32 file stores a 0–1 fraction of Earth's disc, averaged hourly over 18.6 years). Ours over 2027-01-01 → 2045-08-01 at 3 h steps (Horizons Moon-fixed Earth track + our horizon): site01 **53.3%** vs map **58.0%**; site04 **52.0%** vs **56.7%**. Ours is ~5 points lower at both sites. That gap is inside the map's own spread 1–2 pixels around each site (5×5 box: site01 40.6–58.0%, site04 15.7–56.7%; both sites sit on the local maximum), so the two agree to within the map's sensitivity to position. Likely causes, **not separated by a test**: our 5 m near-field DEM resolves blockers that a 60 m grid smooths away; their observer height and DEM version aren't stated in the Trek record (we use a 2 m antenna); different 18.6-year epochs. The app's window number is lower again (site01 46.9%, site04 45.3%) because Jan–Mar 2027 is not a full libration cycle: show it as the mission-window value, never as a long-term average | proposed | Deep (proposer) |
| D-28 | **Earth elevation vs libration.** Sub-Earth point over 18.6 years: latitude −6.86° to +6.86°, longitude −8.05° to +8.08° (the known optical libration). Earth's smooth elevation over 18.6 years: site01 −7.52° to +6.28°, site04 −7.31° to +6.42°, inside the bound \|libration in latitude\| + colatitude + parallax (≈ 6.86 + 0.51 + 0.26 = 7.63° at site01). The 3-month window already reaches 98–100% of that range (site01 −7.50° to +6.23°). The site files' Earth elevation (Horizons observer table) and our own `geometry.topocentric` from the Moon-fixed track agree within **0.006°** at both sites | proposed | Deep (proposer) |
| D-29 | **Horizon vs known terrain.** (a) Shackleton: the lowest LOLA point within 15 km of the pole is −89.624°, 118.59 E, −2,866 m (the crater floor). From site04 on the rim, the horizon toward it (az 243.7°) is **−1.86°, set 21.2 km away**: the far rim seen across the bowl, as expected for a ~21 km crater, not a nearby wall. (b) site04's highest horizon (+1.02°, az 30.5°) is set 9.9 km away at −89.48°, 222.5 E: the connecting ridge toward site01. (c) site01's highest horizon (+10.12°, az 307°) is a rise only 70 m away, far from Earth's azimuths there (128.6–143.7° over the window), so it costs sunlight, not DTE. The rerun of `terrain.horizon` matches the committed files exactly | proposed | Deep (proposer) |
| D-30 | **Frame: Horizons (IAU Moon) vs DEMs (MOON_ME, DE421) — answers the H0 row "quantify in V2".** The IAU rotation equations are quoted as precise to ~150 m on the surface (WGCCRE, via [NAIF spice_discussion, May 2015](https://naif.jpl.nasa.gov/pipermail/spice_discussion/2015-May/000405.html)). Direction error to Earth from that is ~0.005°, negligible. Position error matters at a rim: moving each site 150 m N/E/S/W and re-ray-casting, **site01's window DTE stays 46.6–47.1% (base 46.9%)**, but **site04 drops from 45.3% to 27.2% when moved 150 m west** (horizon changes up to 20°: it falls off the rim crest). Keep treating the frames as equal, and state site04's DTE as position-sensitive (±150 m → 27–45%) in its uncertainty text and the pitch. Fixing this properly (SPICE ME↔IAU rotation) is out of Day-1 scope | proposed | Deep (proposer) |

## LunaNet alignment (2026-11-14): proposed

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-31 | **LunaNav is described as a planning tool for LunaNet-era missions, checked against LNIS v5** ([spec PDF](https://www.nasa.gov/wp-content/uploads/2025/02/lunanet-interoperability-specification-v5-baseline.pdf), 29 Jan 2025). Checked: south-pole focus (same), DWE = DTE and real-time service needs the full end-to-end path (same as D-17), navigation needs 4 satellites in view (not modelled: we count communication paths only). LNIS v5 sets no surface elevation mask and defers the lunar frame and LunaNet Reference Time to a standard not yet published, so our IAU frame, UTC and default 0° mask don't conflict with it. Revisit if that standard picks a frame (e.g. Mean Earth) whose difference matters at our resolution. No code change | proposed | Deep (Claude-drafted) |

## Offline sites (G6, 2026-11-14): proposed

| ID | Decision | Status | Agreed by |
|---|---|---|---|
| D-32 | **9 more precomputed sites (D-24), LOLA 120 m only.** One per region in NASA's Artemis III candidate list (13 regions, Aug 2022) that has a PGDA 5 m tile south of −85°. NASA's Oct 2024 update cut the list to 9 and dropped Faustini Rim A and Leibnitz Beta Plateau: they stay here as studied south-pole sites, not current candidates (north of that the 300 km horizon rays leave LDEM_75S_120M). Each point is `terrain.highest_flat_point` of the tile center: the highest LOLA 120 m pixel within 4 km with slope ≤ 5° (high ground lowers the horizon; not a landing-safety pick, P2). The PGDA tiles are **not downloaded** (~1 GB for 8 tiles), so the horizon is LOLA 120 m from the antenna out, and its source and uncertainty ("unknown") say so. Site01 and site04 keep their PGDA 5 m horizons. The 9 sites and why (lat, lon E; LOLA height, slope): | proposed | Deep (proposer) |
| | `site07_peak_near_shackleton` (−88.8075, 123.7692): Peak near Shackleton; 1,648 m (the highest ground within 4 km), 0.8° | | |
| | `sl3_connecting_ridge_extension` (−89.0093, 265.3029): Connecting Ridge Extension; 1,552 m, 0.3° | | |
| | `site06_nobile_rim_1` (−85.5384, 37.6166): Nobile Rim 1; 6,124 m, 2.3° (the 6,736 m max within 4 km is steeper than 5°) | | |
| | `site11_de_gerlache_rim` (−88.6652, 291.6595): de Gerlache Rim (PGDA Site11); 1,812 m (the highest ground within 4 km), 1.1° | | |
| | `site42_de_gerlache_kocher_massif` (−85.7218, 243.3283): de Gerlache–Kocher Massif; 2,868 m, 1.7° | | |
| | `haworth` (−86.7663, 339.4809): Haworth; 1,906 m, 0.8° | | |
| | `site23_malapert_massif` (−85.9539, 1.4846): Malapert Massif; 5,016 m, 4.7° | | |
| | `site20_leibnitz_beta_plateau` (−85.4047, 31.6996): Leibnitz Beta Plateau; 6,462 m (the highest ground within 4 km), 0.4° | | |
| | `lm7_faustini_rim_a` (−87.8386, 92.9907): Faustini Rim A; 396 m, 4.3° | | |
| D-33 | **G6 horizons vs NASA's Earth-visibility map** (same check as D-27, script [`notebooks/08_g6_trek_check.py`](../notebooks/08_g6_trek_check.py)). Ours = % of Earth's disc above our LOLA 120 m horizon, 18.6 years at 3 h; map = Trek `AVGVISIB_85S_060M_201608_EARTH_SP` at the site pixel (5×5 px range): Peak near Shackleton **53.4** vs 46.0 (33.7–57.1); Connecting Ridge Ext. **54.7** vs 55.4 (0.0–59.4); Nobile Rim 1 **63.8** vs 63.4 (45.7–70.1); de Gerlache Rim **56.7** vs 61.1 (19.1–61.4); de Gerlache–Kocher **45.5** vs 45.2 (29.7–59.7); Haworth **66.7** vs 64.6 (37.2–72.1); Malapert **98.0** vs 100.0 (57.9–100.0); Leibnitz Beta **85.6** vs 82.3 (46.0–100.0); Faustini Rim A **46.8** vs 51.4 (51.3–51.4). All 9 within 7.4 points of the map, 8 of 9 inside the map's 5×5 spread. Faustini Rim A is the exception: 4.6 points low where the map is flat, the same ~5-point low offset D-27 found at site01/site04 (−4.7 each), so not a LOLA-only effect. Peak near Shackleton is the largest gap (+7.4, ours higher), as expected when LOLA 120 m smooths away nearby blockers the 60 m map keeps: treat LOLA-only DTE % as possibly a few points high | proposed | Deep (proposer) |
