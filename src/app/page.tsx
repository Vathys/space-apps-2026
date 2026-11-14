"use client";

import { useEffect, useState } from "react";
import { Comparison } from "@/components/comparison";
import { ControlBar } from "@/components/control-bar";
import { MetricCards } from "@/components/metric-cards";
import { PlaceholderBanner } from "@/components/placeholder-banner";
import { Timelines } from "@/components/timelines";

interface Named {
  id: string;
  name: string;
}

interface PlaceholderIndex {
  window: { startUtc: string };
  sites: Named[];
  relayConfigs: Named[];
  defaults: { minElevationDeg: number; durationDays: number };
}

const toOption = (n: Named) => ({ value: n.id, label: n.name });

export default function Home() {
  const [index, setIndex] = useState<PlaceholderIndex | null>(null);
  const [error, setError] = useState(false);

  // shortcut: bare fetch, F2 replaces it with the typed loader in data.ts
  useEffect(() => {
    fetch("/data/placeholder/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setIndex)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <PlaceholderBanner />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">LunaNav</h1>
          <p className="text-sm text-muted-foreground">
            Lunar south-pole communication planner. Geometric line-of-sight only.
          </p>
        </header>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            Could not load data/placeholder/index.json
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
