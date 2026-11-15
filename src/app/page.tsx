"use client";

import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { ControlBar } from "@/components/control-bar";
import { MaskControl } from "@/components/mask-control";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { DATA_ROOT, DataError, loadIndex, loadRelay, loadSite } from "@/lib/lunanav/data";
import { analyzeScenario } from "@/lib/lunanav/analysis";
import { sliceWindow } from "@/lib/lunanav/network";
import { comparisonRows, uncertaintySummaries } from "@/lib/lunanav/series";
import { dateOf, normalizeScenario, parseScenario, toSearch, windowDates, windowDays, windowLastDate } from "@/lib/lunanav/scenario";
import type { DatasetIndex, RelayLinkData, Scenario, SiteData } from "@/lib/lunanav/types";

const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const NO_RESULT = { result: null, direct: null, error: null, grid: null, uncertainty: [] as string[] };

/**
 * The analysis for one choice, or the reason there is none. Cheap (~13k samples), so it runs on render.
 * `relayUnpublished`: the chosen relay has no data file yet, so the result is direct-to-Earth only and says so.
 */
function runAnalysis(
  scenario: Scenario,
  slice: { startIndex: number; endIndex: number },
  site: SiteData,
  relay: RelayLinkData | null,
  relayUnpublished: boolean,
) {
  if (scenario.relayConfigId && !relay) {
    // Still loading: no result, never a DTE-only result shown as relay-assisted
    if (!relayUnpublished) return NO_RESULT;
    // Not published: the honest answer is the direct-to-Earth result, labelled as such (never a made-up relay)
    return runAnalysis({ ...scenario, relayConfigId: null }, slice, site, null, false);
  }
  try {
    // The grid and the uncertainty come from the same files the result was built from, at the same time
    const result = analyzeScenario(scenario, slice, site, relay);
    return {
      result,
      // F5: the same scenario without the relay, from the same files and slice
      direct: relay ? analyzeScenario({ ...scenario, relayConfigId: null }, slice, site, null) : result,
      error: null,
      grid: site.window,
      uncertainty: uncertaintySummaries(site, relay, scenario.antennaHeightM),
    };
  } catch (e) {
    return { ...NO_RESULT, error: message(e) };
  }
}

// I1: the real files in public/data/. The banner still shows if any loaded file is marked placeholder.
const ROOT = DATA_ROOT;

/** A loaded file, tagged with the choice it was loaded for, so a stale result is never shown for a new choice. */
type LoadState<T> = { for: string; data: T | null; placeholder: boolean; error: string | null; unpublished?: boolean };

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [indexPlaceholder, setIndexPlaceholder] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [site, setSite] = useState<LoadState<SiteData> | null>(null);
  const [relay, setRelay] = useState<LoadState<RelayLinkData> | null>(null);

  useEffect(() => {
    loadIndex(ROOT)
      .then(({ data, placeholder }) => {
        // Parse first: if this throws, nothing is set and the .catch shows the error
        const initial = parseScenario(window.location.search, data);
        setIndex(data);
        setIndexPlaceholder(placeholder);
        setScenario(initial);
      })
      .catch((e: unknown) => setIndexError(message(e)));
  }, []);

  // Site and relay load separately: toggling the relay doesn't refetch the site, and each fails on its own
  const siteId = scenario?.siteId ?? "";
  const relayId = scenario?.relayConfigId ?? null;
  const relayKey = relayId ? `${siteId}|${relayId}` : "";
  useEffect(() => {
    if (!index || !siteId) return;
    let live = true;
    loadSite(index, siteId, ROOT).then(
      (r) => live && setSite({ for: siteId, data: r.data, placeholder: r.placeholder, error: null }),
      (e: unknown) => live && setSite({ for: siteId, data: null, placeholder: true, error: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [index, siteId]);
  useEffect(() => {
    if (!index || !relayId) return;
    let live = true;
    loadRelay(index, siteId, relayId, ROOT).then(
      (r) => live && setRelay({ for: relayKey, data: r.data, placeholder: r.placeholder, error: null, unpublished: false }),
      (e: unknown) =>
        live &&
        setRelay({
          for: relayKey,
          data: null,
          // A missing file is not placeholder data; a malformed one is an error and keeps the banner on
          placeholder: !(e instanceof DataError && e.code === "data-file-missing"),
          error: message(e),
          unpublished: e instanceof DataError && e.code === "data-file-missing",
        }),
    );
    return () => {
      live = false;
    };
  }, [index, siteId, relayId, relayKey]);

  // Errors count only for the current choice. The banner follows the last settled files, so it doesn't flash on
  // every change once the data is real; before any file has loaded it stays on.
  const siteNow = site?.for === siteId ? site : null;
  const relayNow = relayKey && relay?.for === relayKey ? relay : null;
  const placeholder = indexPlaceholder || (site ? site.placeholder : true) || (!!relayKey && (relay ? relay.placeholder : true));
  // A relay config listed in index.json whose file isn't there yet is "not published", not an error
  const relayUnpublished = !!relayNow?.unpublished;
  const errors = [indexError, siteNow?.error ?? null, relayUnpublished ? null : (relayNow?.error ?? null)].filter((e): e is string => !!e);

  // Keep the URL in step with the controls, without a history write on every slider tick, and keep any #anchor
  useEffect(() => {
    if (!scenario) return;
    const id = setTimeout(() => window.history.replaceState(null, "", `?${toSearch(scenario)}${window.location.hash}`), 250);
    return () => clearTimeout(id);
  }, [scenario]);

  // One window rule for the whole app: network.sliceWindow (N3). Its return type is the whole ScenarioError
  // union, so the code check is what lets TypeScript read `.supported`.
  const sliced = index && scenario ? sliceWindow(index.window, scenario.startUtc, scenario.durationDays) : null;
  const outside = sliced && "code" in sliced && sliced.code === "outside-window" ? sliced : null;
  const slice = sliced && !("code" in sliced) ? sliced : null;

  // I1: the result for the current choice, once its files are in. Outside the window there is no result (§5);
  // with a relay selected, no result until that relay file is in (never a DTE-only result shown as relay-assisted).
  const siteData = siteNow?.data ?? null;
  const relayData = relayNow?.data ?? null;
  const analysis = scenario && slice && siteData ? runAnalysis(scenario, slice, siteData, relayData, relayUnpublished) : NO_RESULT;
  const result = analysis.result;
  const dates = index && windowDates(index.window);
  const siteMeta = index?.sites.find((s) => s.id === siteId);
  // Only offer relay configs that have a file for this site
  const relays = index?.relayConfigs.filter((c) => !!c.dataFiles[siteId]) ?? [];

  return (
    <>
      {placeholder && <PlaceholderBanner />}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">LunaNav</h1>
          <p className="text-sm text-muted-foreground">
            Lunar south-pole communication planner. Geometric line-of-sight only.
          </p>
        </header>
        {errors.map((e, i) => (
          <p key={i} role="alert" className="text-sm text-red-400">
            Could not load data: {e}
          </p>
        ))}
        {analysis.error && (
          <p role="alert" className="text-sm text-red-400">
            Could not compute this scenario: {analysis.error}
          </p>
        )}
        {index && scenario && dates && (
          <ControlBar
            scenario={scenario}
            sites={index.sites.map(toOption)}
            relays={relays.map(toOption)}
            antennaHeightsM={siteMeta?.antennaHeightsM ?? []}
            dates={dates}
            maxDays={windowDays(index.window)}
            onChange={(next) => setScenario(normalizeScenario(next, index))}
          />
        )}
        {outside && (
          <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
            Outside the supported data window: data covers {dateOf(outside.supported.startUtc)} to {windowLastDate(outside.supported)} UTC,
            so a scenario can start from {dates?.min} to {dates?.max} and must end by {windowLastDate(outside.supported)}. No numbers are
            shown for these dates.
          </p>
        )}
        {relayUnpublished && (
          <p role="status" className="rounded-lg border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-200">
            Relay data for {index?.relayConfigs.find((c) => c.id === scenario?.relayConfigId)?.name ?? "this configuration"} at this site isn&apos;t
            published yet, so these results are direct-to-Earth only.
          </p>
        )}
        <MetricCards
          result={result}
          uncertainty={analysis.uncertainty}
        />
        <Timelines result={result} grid={analysis.grid} />
        <Comparison
          rows={analysis.direct ? comparisonRows(analysis.direct, result?.scenario.relayConfigId ? result : null) : null}
          relayName={index?.relayConfigs.find((c) => c.id === result?.scenario.relayConfigId)?.name ?? null}
          relayNote={relayUnpublished ? "Relay data for this site isn't published yet" : undefined}
        >
          {index && scenario && (
            <MaskControl valueDeg={scenario.minElevationDeg} onChange={(deg) => setScenario(normalizeScenario({ ...scenario, minElevationDeg: deg }, index))} />
          )}
        </Comparison>
      </main>
    </>
  );
}
