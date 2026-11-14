import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const METRICS = ["Coverage", "Longest blackout", "Blackout count", "Sunlit"];

export function MetricCards() {
  return (
    <section aria-label="Metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRICS.map((name) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">not available</p>
            <p className="mt-2 text-xs text-muted-foreground">Geometric line-of-sight only. Source: none yet.</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
