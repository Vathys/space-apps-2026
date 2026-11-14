"use client";

import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { ControlBar } from "@/components/control-bar";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { loadIndex, loadRelay, loadSite, PLACEHOLDER_ROOT } from "@/lib/lunanav/data";
import { checkWindow, dateOf, parseScenario, toSearch, windowDates } from "@/lib/lunanav/scenario";
import type { DatasetIndex, Scenario } from "@/lib/lunanav/types";

const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [placeholder, setPlaceholder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // F3 replaces PLACEHOLDER_ROOT with the real root once CP2 data lands (I1)
  useEffect(() => {
    (async () => {
      const { data, placeholder: isPlaceholder } = await loadIndex(PLACEHOLDER_ROOT);
      const initial = parseScenario(window.location.search, data);
      await loadSite(data, initial.siteId, PLACEHOLDER_ROOT);
      if (initial.relayConfigId) await loadRelay(data, initial.siteId, initial.relayConfigId, PLACEHOLDER_ROOT);
      setIndex(data);
      setScenario(initial);
      setPlaceholder(isPlaceholder);
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
            onChange={setScenario}
          />
        )}
        {outside && (
          <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
            Outside the supported data window ({dateOf(outside.supported.startUtc)} to {windowDates(outside.supported).max}). No numbers are
            shown for these dates.
          </p>
        )}
        <MetricCards result={null} />
        <Timelines result={null} window={index?.window ?? null} />
        <Comparison />
      </main>
    </>
  );
}
