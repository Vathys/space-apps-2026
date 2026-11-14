import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectivityResult } from "@/lib/lunanav/types";

export function MetricCards({ result }: { result: ConnectivityResult | null }) {
  const s = result?.summary;
  const metrics = [
    {
      name: "Coverage",
      value: s ? s.coveragePct.toFixed(1) : null,
      unit: "%",
      note: s ? `direct only ${s.dteCoveragePct.toFixed(1)}%, relay adds ${s.relayGainPct.toFixed(1)}%` : null,
    },
    { name: "Longest blackout", value: s ? s.longestBlackoutHours.toFixed(1) : null, unit: "h", note: null },
    { name: "Blackouts", value: s ? String(s.blackoutCount) : null, unit: "", note: null },
    { name: "Sunlit", value: s ? s.sunlitPct.toFixed(1) : null, unit: "%", note: null },
  ];
  const source = result?.provenance.map((p) => p.source).join("; ");
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
        Geometric line-of-sight only: no link budget, scheduling or interference. Source: {source || "none yet"}.
      </p>
    </section>
  );
}
