"use client";

import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { ControlBar } from "@/components/control-bar";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";
import { loadIndex, loadRelay, loadSite, PLACEHOLDER_ROOT } from "@/lib/lunanav/data";
import type { DatasetIndex } from "@/lib/lunanav/types";

const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [placeholder, setPlaceholder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // F3 replaces PLACEHOLDER_ROOT with the real root once CP2 data lands (I1)
  useEffect(() => {
    (async () => {
      const { data, placeholder: isPlaceholder } = await loadIndex(PLACEHOLDER_ROOT);
      const site = data.sites[0];
      const config = data.relayConfigs[0];
      if (site) await loadSite(data, site.id, PLACEHOLDER_ROOT);
      if (site && config) await loadRelay(data, site.id, config.id, PLACEHOLDER_ROOT);
      setIndex(data);
      setPlaceholder(isPlaceholder);
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

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
        {index && (
          <ControlBar
            sites={index.sites.map(toOption)}
            relays={index.relayConfigs.map(toOption)}
            startUtc={index.window.startUtc}
            durationDays={index.defaults.durationDays}
            minElevationDeg={index.defaults.minElevationDeg}
          />
        )}
        <MetricCards />
        <Timelines />
        <Comparison />
      </main>
    </>
  );
}
