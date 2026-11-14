# Open questions

Decide these as a team, then record the answer here.

## Web stack (blocking: UI0)
We're building a **web app**. Still to decide:
- **Frontend:** e.g. React/Vite, or a plain HTML/JS page. Charting library for the sky/horizon chart and timeline.
- **Backend:** e.g. Python (FastAPI/Flask) so DEM processing (numpy/rasterio) and the API share one language, or a Node backend that serves only precomputed JSON.
- **Hosting:** where the judges open a public URL (DP1).
- **Precompute vs on-demand:** precompute the curated sites (recommended for the demo). Is on-demand custom lat/lon worth it?

Decide by hour 1.

## From the brainstorm, marked "(?)"
- **Gravity anomalies:** do they matter to an early-stage planner's landing decision? Currently a stretch goal (X2).
- **Lunar seasons:** show them as a separate view, or let the year-long date range cover them? Currently a stretch goal (X4).

## Other
- Default lander constraints (max slope, landing-ellipse size, minimum flat patch). Need one sourced reference value (LS1).
- DEM resolution per site: polar high-res vs global LDEM. What do we say when the lander footprint is below DEM resolution? (LS4)
- Which 2 sites + dates make the demo scenario? (PT1)
- Team owners for each workstream.
