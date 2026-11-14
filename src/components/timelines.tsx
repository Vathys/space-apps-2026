import { TimelineRow } from "@/components/timeline-row";
import { anyRelay, runsOf } from "@/lib/lunanav/series";
import type { ConnectivityResult, TimeGrid } from "@/lib/lunanav/types";

export function Timelines({ result, window }: { result: ConnectivityResult | null; window: TimeGrid | null }) {
  if (!result || !window) {
    return (
      <section aria-label="Timelines" className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Timelines</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No result yet. Timelines appear once the network analysis has run for this scenario.
        </p>
      </section>
    );
  }
  const { startIndex, endIndex } = result.slice;
  const samples = endIndex - startIndex;
  const runs = (s: ArrayLike<number>) => runsOf(s, window.startUtc, window.stepSeconds, startIndex);
  const rows = [
    { label: "Earth direct", hint: "direct-to-Earth line of sight", color: "var(--link-direct)", series: result.dte },
    { label: "Relay", hint: "a relay path is complete", color: "var(--link-relay)", series: anyRelay(result) },
    { label: "Connected", hint: "direct or relay path available", color: "var(--link-connected)", series: result.connected },
    { label: "Sunlight", hint: "any part of the Sun above the terrain", color: "var(--link-sun)", series: result.sunlitFraction },
  ];
  return (
    <section aria-label="Timelines" className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Timelines</h2>
      <p className="mb-2 text-xs text-muted-foreground">Filled = the state holds. Vertical lines mark UTC midnights.</p>
      {rows.map((r) => (
        <TimelineRow
          key={r.label}
          label={r.label}
          hint={r.hint}
          color={r.color}
          samples={samples}
          stepSeconds={window.stepSeconds}
          runs={runs(r.series)}
        />
      ))}
    </section>
  );
}
