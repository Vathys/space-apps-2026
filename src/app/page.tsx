"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { ControlBar } from "@/components/control-bar";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { loadIndex, loadRelay, loadSite, PLACEHOLDER_ROOT } from "@/lib/lunanav/data";
import { sliceWindow } from "@/lib/lunanav/network";
import { dateOf, parseScenario, toSearch, windowDates, windowEndMs } from "@/lib/lunanav/scenario";
import type { DatasetIndex, RelayLinkData, Scenario, SiteData } from "@/lib/lunanav/types";

// three.js is client-only and big: load it after the page, never in the static HTML
const SkyPanel = dynamic(() => import("@/components/sky-panel"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading 3D sky view…</p>,
});

const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });

// shortcut: reads public/data/placeholder/, switch to DATA_ROOT in I1 once the real CP2 files are on main
const ROOT = PLACEHOLDER_ROOT;

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [site, setSiteData] = useState<SiteData | null>(null);
  const [relay, setRelayData] = useState<RelayLinkData | null>(null);
  // Shown until the files say otherwise, so a failed load never hides it
  const [indexPlaceholder, setIndexPlaceholder] = useState(true);
  const [filesPlaceholder, setFilesPlaceholder] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIndex(ROOT)
      .then(({ data, placeholder }) => {
        setIndex(data);
        setIndexPlaceholder(placeholder);
        setScenario(parseScenario(window.location.search, data));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const siteId = scenario?.siteId;
  const relayId = scenario?.relayConfigId;
  useEffect(() => {
    if (!index || !siteId) return;
    let live = true;
    Promise.all([loadSite(index, siteId, ROOT), relayId ? loadRelay(index, siteId, relayId, ROOT) : null])
      .then(([s, r]) => {
        if (!live) return;
        setSiteData(s.data);
        setRelayData(r?.data ?? null);
        // Any loaded file marked placeholder shows the banner, not only the index
        setFilesPlaceholder(s.placeholder || !!r?.placeholder);
        setError(null);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [index, siteId, relayId]);

  useEffect(() => {
    if (scenario) window.history.replaceState(null, "", `?${toSearch(scenario)}`);
  }, [scenario]);

  // One window rule for the whole app: network.sliceWindow (N3)
  const sliced = index && scenario ? sliceWindow(index.window, scenario.startUtc, scenario.durationDays) : null;
  const outside = sliced && "code" in sliced && sliced.code === "outside-window" ? sliced : null;
  const slice = sliced && !("code" in sliced) ? sliced : null;
  const dates = index && windowDates(index.window);
  const siteMeta = index?.sites.find((s) => s.id === scenario?.siteId);
  // Only show the sky for the files that belong to the current choice, never a stale one while the next loads
  const siteReady = site && scenario && site.siteId === scenario.siteId ? site : null;
  const relayReady = relay && siteReady && relay.siteId === siteReady.siteId && relay.configId === scenario?.relayConfigId ? relay : null;

  return (
    <>
      {(indexPlaceholder || filesPlaceholder) && <PlaceholderBanner />}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">LunaNav</h1>
          <p className="text-sm text-muted-foreground">
            Lunar south-pole communication planner. Geometric line-of-sight only.
          </p>
        </header>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            Could not load data: {error}
          </p>
        )}
        {index && scenario && dates && (
          <ControlBar
            scenario={scenario}
            sites={index.sites.map(toOption)}
            relays={index.relayConfigs.map(toOption)}
            antennaHeightsM={siteMeta?.antennaHeightsM ?? []}
            dates={dates}
            onChange={(next) => setScenario(parseScenario(toSearch(next), index))}
          />
        )}
        {outside && (
          <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
            Outside the supported data window ({dateOf(outside.supported.startUtc)} to{" "}
            {dateOf(new Date(windowEndMs(outside.supported) - 1).toISOString())} UTC). No numbers are shown for these dates.
          </p>
        )}
        <MetricCards result={null} />
        <Timelines result={null} window={index?.window ?? null} />
        {siteReady && index && scenario && slice && (
          <SkyPanel
            key={`${siteReady.siteId}-${scenario.startUtc}-${scenario.durationDays}`}
            site={siteReady}
            relay={relayReady}
            window={index.window}
            slice={slice}
            antennaHeightM={scenario.antennaHeightM}
            result={null}
          />
        )}
        <Comparison />
      </main>
    </>
  );
}
