import { TimelineRow } from "@/components/timeline-row";
import { anyRelay, timelineRow } from "@/lib/lunanav/series";
import type { ConnectivityResult, TimeGrid } from "@/lib/lunanav/types";

/**
 * `grid` is the time grid of the data files the result was computed from (the loader rejects a file whose
 * grid differs from index.json), so the From/To times are the files' own times.
 */
export function Timelines({
  result,
  grid,
  noRelayReason = "No relay configuration selected.",
  cursor,
  onSeek,
}: {
  result: ConnectivityResult | null;
  grid: TimeGrid | null;
  /** The replay position inside the slice, drawn as a line on every row; a click on a row seeks there */
  cursor?: number;
  onSeek?: (step: number) => void;
  /** Why the result has no relay: none selected, or the selected relay's data isn't published */
  noRelayReason?: string;
}) {
  if (!result || !grid) {
    return (
      <section aria-label="Timelines" className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Timelines</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No result yet. Timelines appear once the network analysis has run for this scenario.
        </p>
      </section>
    );
  }
  const row = (s: ArrayLike<number>, weighted = false) => timelineRow(s, grid, result.slice, weighted);
  // From the result's own scenario, never the live controls
  const relaySelected = !!result.scenario.relayConfigId;
  const rows = [
    { label: "Earth direct", hint: "direct-to-Earth line of sight", color: "var(--link-direct)", data: row(result.dte) },
    {
      label: "Relay",
      hint: "a relay path is complete",
      color: "var(--link-relay)",
      data: row(anyRelay(result)),
      // Nothing was evaluated, which is not the same as "the relay never helped"
      note: relaySelected ? undefined : noRelayReason,
    },
    { label: "Connected", hint: "direct or relay path available", color: "var(--link-connected)", data: row(result.connected) },
    {
      label: "Sunlight",
      hint: "any part of the Sun above the terrain; hours are weighted by the visible fraction of the disk",
      color: "var(--link-sun)",
      data: row(result.sunlitFraction, true),
    },
  ];
  return (
    <section aria-label="Timelines" className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Timelines</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Filled = the state holds (Sunlight: any part of the Sun visible). Vertical lines mark UTC midnights.
      </p>
      {rows.map((r) => (
        <TimelineRow key={r.label} label={r.label} hint={r.hint} color={r.color} data={r.data} note={r.note} cursor={cursor} onSeek={onSeek} />
      ))}
    </section>
  );
}
