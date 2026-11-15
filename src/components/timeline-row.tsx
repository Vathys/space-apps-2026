import type { TimelineRowData } from "@/lib/lunanav/series";

const fmt = (utc: string) => utc.slice(0, 16).replace("T", " ");

/** One timeline: filled where the state holds, UTC midnight lines, and the same numbers in a table. Renders only. */
export function TimelineRow({
  label,
  hint,
  color,
  data,
  note,
}: {
  label: string;
  hint: string;
  color: string;
  data: TimelineRowData;
  /** Shown instead of the strip when the row wasn't evaluated (e.g. no relay selected) */
  note?: string;
}) {
  const { runs, totalHours, dayTicks, samples } = data;
  if (note) {
    return (
      <div className="border-t border-border py-3 first:border-t-0">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </div>
    );
  }
  return (
    <div className="border-t border-border py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{label}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {runs.length} {runs.length === 1 ? "interval" : "intervals"} · {totalHours.toFixed(1)} h
        </span>
      </div>
      <svg
        role="img"
        aria-label={`${label}: ${runs.length} intervals, ${totalHours.toFixed(1)} hours in total`}
        viewBox={`0 0 ${samples} 1`}
        preserveAspectRatio="none"
        className="mt-2 h-6 w-full rounded-sm border border-border bg-background"
      >
        {dayTicks.map((x) => (
          <line key={x} x1={x} x2={x} y1={0} y2={1} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {runs.map((r) => (
          <rect key={r.startIndex} x={r.startIndex} width={r.endIndex - r.startIndex} y={0} height={1} fill={color} />
        ))}
      </svg>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Table: {hint}</summary>
        {runs.length === 0 ? (
          <p className="py-2 text-muted-foreground">No interval in this slice.</p>
        ) : (
          <div className="max-h-48 overflow-auto">
            <table className="w-full font-mono">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-normal">From (UTC)</th>
                  <th className="py-1 pr-4 font-normal">To (UTC)</th>
                  <th className="py-1 text-right font-normal">Hours</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.startIndex} className="border-t border-border/60">
                    <td className="py-1 pr-4">{fmt(r.startUtc)}</td>
                    <td className="py-1 pr-4">{fmt(r.endUtc)}</td>
                    <td className="py-1 text-right">{r.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
