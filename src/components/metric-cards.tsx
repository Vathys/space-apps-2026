import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { blackoutClipped, uniqueSources } from "@/lib/lunanav/series";
import type { ConnectivityResult } from "@/lib/lunanav/types";

/** Renders the numbers network.ts computed, with their source and uncertainty (CLAUDE.md §5). */
export function MetricCards({
  result,
  uncertainty,
}: {
  result: ConnectivityResult | null;
  /** Uncertainty summaries of the files behind the result; empty is shown as "unknown", never left out */
  uncertainty: string[];
}) {
  const s = result?.summary;
  // From the result's own scenario, never the live controls, so the card always describes the numbers it shows
  const relaySelected = !!result?.scenario.relayConfigId;
  const metrics = [
    {
      name: "Coverage",
      value: s ? s.coveragePct.toFixed(1) : null,
      unit: "%",
      note: s
        ? relaySelected
          ? `direct only ${s.dteCoveragePct.toFixed(1)}%, relay adds ${s.relayGainPct.toFixed(1)}%`
          : "direct to Earth only: no relay in this result"
        : null,
    },
    {
      name: "Longest blackout",
      value: s ? s.longestBlackoutHours.toFixed(1) : null,
      unit: "h",
      note: result && blackoutClipped(result) ? "may be longer: a blackout is cut by the start or end of the scenario" : null,
    },
    { name: "Blackouts", value: s ? String(s.blackoutCount) : null, unit: "", note: null },
    { name: "Sunlit", value: s ? s.sunlitPct.toFixed(1) : null, unit: "%", note: null },
  ];
  const sources = result ? uniqueSources(result.provenance) : [];
  return (
    <section aria-label="Metrics" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.name} size="sm">
            <CardHeader>
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl tabular-nums">
                {m.value ?? <span className="font-sans text-lg text-muted-foreground">not available</span>}
                {m.value !== null && m.unit && <span className="ml-1 text-base text-muted-foreground">{m.unit}</span>}
              </p>
              {m.note && <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Geometric line-of-sight only: no link budget, scheduling or interference. Source: {sources.length ? sources.join("; ") : "none yet"}.
      </p>
      {result &&
        (uncertainty.length ? (
          // Long texts from the files: one line names what is covered, the full text is one click away (§5: shown, not omitted)
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Uncertainty of {uncertainty.map((u) => u.split(":")[0]).join(", ")} (open to read)
            </summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {uncertainty.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-xs text-muted-foreground">Uncertainty: unknown.</p>
        ))}
    </section>
  );
}
