"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { Hero } from "@/components/hero";
import { ControlBar } from "@/components/control-bar";
import { MaskControl } from "@/components/mask-control";
import { MetricCards } from "@/components/metric-cards";
import { MissionBar } from "@/components/mission-header";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { DATA_ROOT, DataError, loadIndex, loadRelay, loadSite } from "@/lib/lunanav/data";
import { analyzeScenario } from "@/lib/lunanav/analysis";
import { relayTracks } from "@/lib/lunanav/moon";
import { sliceWindow } from "@/lib/lunanav/network";
import { comparisonRows, uncertaintySummaries } from "@/lib/lunanav/series";
import { dateOf, normalizeScenario, parseScenario, toSearch, windowDates, windowDays, windowLastDate } from "@/lib/lunanav/scenario";
import type { DatasetIndex, RelayLinkData, Scenario, SiteData } from "@/lib/lunanav/types";

// three.js is client-only and big: load it after the page, never in the static HTML
const SkyPanel = dynamic(() => import("@/components/sky-panel"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading 3D sky view…</p>,
});

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
          // A failed relay load shows no relay number (the error says why), so it never turns the placeholder banner on
          placeholder: false,
          error: message(e),
          // Only a file known not to exist (404, or not listed in index.json) is "not published";
          // a network failure or a 5xx is a load error, never reported as a fact about the dataset
          unpublished: e instanceof DataError && e.absent,
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
  // The relay only counts once it is loaded for the current choice: no relay-assisted number is shown before that,
  // so a load for another key can't turn the banner on or off for this one
  const placeholder = indexPlaceholder || (site ? site.placeholder : true) || (!!relayNow && relayNow.placeholder);
  // A relay config listed in index.json whose file isn't there yet is "not published", not an error
  const relayUnpublished = !!relayNow?.unpublished;
  const selectedRelayName = index?.relayConfigs.find((c) => c.id === scenario?.relayConfigId)?.name ?? null;
  const noRelayReason = relayUnpublished ? `${selectedRelayName ?? "the selected relay"} data isn't published yet for this site` : undefined;
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
  // The first look shows the selected site's sky at the first sample of the scenario: file values, and DTE from the result
  const s0 = slice?.startIndex ?? -1;
  const sd = siteNow?.data;
  const siteMeta = index?.sites.find((s) => s.id === siteId);
  const heroSky =
    sd && s0 >= 0
      ? {
          earthAzDeg: sd.earth.azimuthDeg[s0]!,
          earthElDeg: sd.earth.elevationDeg[s0]!,
          sunAzDeg: sd.sun.azimuthDeg[s0]!,
          sunElDeg: sd.sun.elevationDeg[s0]!,
          dte: result ? result.dte[0] === 1 : null,
          // Relay orbits from the relay file's az/el/range; a satellite's link is its complete path from the result (§5)
          relays:
            relayData && siteMeta
              ? relayTracks(siteMeta.latDeg, siteMeta.lonEastDeg, relayData, s0).map((t) => ({
                  ...t,
                  linked: result?.scenario.relayConfigId ? result.relayPerSatellite[t.id]?.[0] === 1 : null,
                }))
              : [],
        }
      : null;
  const dates = index && windowDates(index.window);
  // Only offer relay configs that have a file for this site
  const relays = index?.relayConfigs.filter((c) => !!c.dataFiles[siteId]) ?? [];

  return (
    <>
      {placeholder && <PlaceholderBanner />}
      <MissionBar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <Hero
          sites={index?.sites.map((x) => ({ id: x.id, name: x.name, latDeg: x.latDeg, lonEastDeg: x.lonEastDeg })) ?? []}
          selectedId={siteId || null}
          sky={heroSky}
          atUtc={slice && scenario ? scenario.startUtc : null}
        />
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
        <div id="planner" className="scroll-mt-16" />
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
          noRelayReason={noRelayReason}
        />
        <Timelines result={result} grid={analysis.grid} noRelayReason={noRelayReason && `No relay result: ${noRelayReason}.`} />
        {index && scenario && slice && siteNow?.data && (
          <SkyPanel
            key={`${siteId}-${scenario.startUtc}-${scenario.durationDays}`}
            site={siteNow.data}
            relay={relayNow?.data ?? null}
            window={index.window}
            slice={slice}
            antennaHeightM={scenario.antennaHeightM}
            minElevationDeg={scenario.minElevationDeg}
            result={result}
          />
        )}
        <Comparison
          rows={analysis.direct ? comparisonRows(analysis.direct, result?.scenario.relayConfigId ? result : null) : null}
          relayName={selectedRelayName}
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
