"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { Hero } from "@/components/hero";
import { ControlBar } from "@/components/control-bar";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { loadIndex, loadRelay, loadSite, PLACEHOLDER_ROOT } from "@/lib/lunanav/data";
import { sliceWindow } from "@/lib/lunanav/network";
import { dateOf, parseScenario, toSearch, windowDates, windowDays, windowLastDate } from "@/lib/lunanav/scenario";
import type { DatasetIndex, RelayLinkData, Scenario, SiteData } from "@/lib/lunanav/types";

// three.js is client-only and big: load it after the page, never in the static HTML
const SkyPanel = dynamic(() => import("@/components/sky-panel"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading 3D sky view…</p>,
});

const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// shortcut: reads public/data/placeholder/, switch to DATA_ROOT in I1 once the real CP2 files are on main
const ROOT = PLACEHOLDER_ROOT;

/** A loaded file, tagged with the choice it was loaded for, so a stale result is never shown for a new choice. */
type Loaded<T> = { for: string; data: T | null; placeholder: boolean; error: string | null };

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [indexPlaceholder, setIndexPlaceholder] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [site, setSite] = useState<Loaded<SiteData> | null>(null);
  const [relay, setRelay] = useState<Loaded<RelayLinkData> | null>(null);

  useEffect(() => {
    loadIndex(ROOT)
      .then(({ data, placeholder }) => {
        setIndex(data);
        setIndexPlaceholder(placeholder);
        setScenario(parseScenario(window.location.search, data));
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
      (r) => live && setRelay({ for: relayKey, data: r.data, placeholder: r.placeholder, error: null }),
      (e: unknown) => live && setRelay({ for: relayKey, data: null, placeholder: true, error: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [index, siteId, relayId, relayKey]);

  // Only results for the current choice count; while the next file loads, the banner stays on and old errors go
  const siteNow = site?.for === siteId ? site : null;
  const relayNow = relayKey && relay?.for === relayKey ? relay : null;
  const placeholder = indexPlaceholder || !siteNow || siteNow.placeholder || (!!relayKey && (!relayNow || relayNow.placeholder));
  const errors = [indexError, siteNow?.error ?? null, relayNow?.error ?? null].filter((e): e is string => !!e);

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
  const dates = index && windowDates(index.window);
  const siteMeta = index?.sites.find((s) => s.id === siteId);
  // Only offer relay configs that have a file for this site
  const relays = index?.relayConfigs.filter((c) => !!c.dataFiles[siteId]) ?? [];

  return (
    <>
      {placeholder && <PlaceholderBanner />}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <Hero />
        {errors.map((e, i) => (
          <p key={i} role="alert" className="text-sm text-red-400">
            Could not load data: {e}
          </p>
        ))}
        <div id="planner" className="scroll-mt-4" />
        {index && scenario && dates && (
          <ControlBar
            scenario={scenario}
            sites={index.sites.map(toOption)}
            relays={relays.map(toOption)}
            antennaHeightsM={siteMeta?.antennaHeightsM ?? []}
            dates={dates}
            maxDays={windowDays(index.window)}
            onChange={(next) => setScenario(parseScenario(toSearch(next), index))}
          />
        )}
        {outside && (
          <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
            Outside the supported data window ({dateOf(outside.supported.startUtc)} to {windowLastDate(outside.supported)} UTC). No numbers
            are shown for these dates.
          </p>
        )}
        <MetricCards result={null} />
        <Timelines result={null} window={index?.window ?? null} />
        {index && scenario && slice && siteNow?.data && (
          <SkyPanel
            key={`${siteId}-${scenario.startUtc}-${scenario.durationDays}`}
            site={siteNow.data}
            relay={relayNow?.data ?? null}
            window={index.window}
            slice={slice}
            antennaHeightM={scenario.antennaHeightM}
            minElevationDeg={scenario.minElevationDeg}
            result={null}
          />
        )}
        <Comparison />
      </main>
    </>
  );
}
