"use client";

import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { ControlBar } from "@/components/control-bar";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { loadIndex, loadRelay, loadSite, PLACEHOLDER_ROOT } from "@/lib/lunanav/data";
import { checkWindow, dateOf, parseScenario, toSearch, windowDates, windowEndMs } from "@/lib/lunanav/scenario";
import type { DatasetIndex, Scenario } from "@/lib/lunanav/types";

const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  // Shown until the files say otherwise, so a failed load never hides it
  const [placeholder, setPlaceholder] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // shortcut: reads public/data/placeholder/, switch to DATA_ROOT in I1 once the real CP2 files are on main
  useEffect(() => {
    (async () => {
      const { data, placeholder: isPlaceholder } = await loadIndex(PLACEHOLDER_ROOT);
      const initial = parseScenario(window.location.search, data);
      const [s, r] = await Promise.all([
        loadSite(data, initial.siteId, PLACEHOLDER_ROOT),
        initial.relayConfigId ? loadRelay(data, initial.siteId, initial.relayConfigId, PLACEHOLDER_ROOT) : null,
      ]);
      setIndex(data);
      setScenario(initial);
      // Any loaded file marked placeholder shows the banner, not only the index
      setPlaceholder(isPlaceholder || s.placeholder || !!r?.placeholder);
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (scenario) window.history.replaceState(null, "", `?${toSearch(scenario)}`);
  }, [scenario]);

  const outside = index && scenario ? checkWindow(scenario, index) : null;
  const dates = index && windowDates(index.window);
  const site = index?.sites.find((s) => s.id === scenario?.siteId);

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
            antennaHeightsM={site?.antennaHeightsM ?? []}
            dates={dates}
            onChange={(next) => setScenario(parseScenario(toSearch(next), index))}
          />
        )}
        {outside && (
          <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
            Outside the supported data window ({dateOf(outside.supported.startUtc)} to {dateOf(new Date(windowEndMs(outside.supported) - 1).toISOString())}). No numbers are
            shown for these dates.
          </p>
        )}
        <MetricCards />
        <Timelines />
        <Comparison />
      </main>
    </>
  );
}
