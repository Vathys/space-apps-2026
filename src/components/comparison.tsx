import type { ComparisonRow } from "@/lib/lunanav/series";

const fmt = (v: number, unit: ComparisonRow["unit"]) => (unit === "" ? String(v) : `${v.toFixed(1)} ${unit === "%" ? "%" : "h"}`);
// Zero after rounding to what is shown (0.1) reads "no change", never "+0.0 pts"
const fmtChange = (v: number, unit: ComparisonRow["unit"]) =>
  Math.abs(v) < (unit === "" ? 0.5 : 0.05)
    ? "no change"
    : `${v > 0 ? "+" : "−"}${unit === "" ? Math.abs(v) : Math.abs(v).toFixed(1)}${unit === "%" ? " pts" : unit === "h" ? " h" : ""}`;
const MayBeLonger = () => <span className="block text-xs text-muted-foreground">may be longer: cut by the scenario edge</span>;

/** F5: direct vs relay-assisted for the same scenario, as a table with bars for coverage. Renders only. */
export function Comparison({
  rows,
  relayName,
  relayNote = "Choose a relay configuration above to compare",
  children,
}: {
  /** null: no result yet */
  rows: ComparisonRow[] | null;
  /** The selected relay configuration, or null for direct only */
  relayName: string | null;
  /** Shown in the relay column when there is no relay result */
  relayNote?: string;
  /** The DTE sensitivity control (D-20 puts the mask with the DTE results) */
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="compare-title" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="compare-title" className="text-sm font-semibold">
            Direct to Earth vs relay-assisted
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {relayName ? <>Relay: <span className="text-foreground">{relayName}</span>. </> : null}
            Same site, dates and mask; the only difference is the relay. Geometric line-of-sight only.
          </p>
        </div>
        {children}
      </div>
      {!rows ? (
        <p className="mt-4 text-sm text-muted-foreground">No result yet. The comparison appears once the analysis has run.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 pr-3 font-medium">Direct only</th>
                <th className="py-2 pr-3 font-medium">With relay</th>
                <th className="py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border align-top">
                  <th scope="row" className="py-3 pr-3 text-left font-medium">
                    {r.label}
                  </th>
                  <td className="py-3 pr-3">
                    <span className="font-mono tabular-nums">{fmt(r.direct, r.unit)}</span>
                    {r.clipped?.direct && <MayBeLonger />}
                    {r.percent && <Bar value={r.direct} color="var(--link-direct)" label={`Direct only coverage ${r.direct.toFixed(1)}%`} />}
                  </td>
                  <td className="py-3 pr-3">
                    {r.relay === null ? (
                      <span className="text-muted-foreground">{relayNote}</span>
                    ) : (
                      <>
                        <span className="font-mono tabular-nums">{fmt(r.relay, r.unit)}</span>
                        {r.clipped?.relay && <MayBeLonger />}
                        {r.percent && <Bar value={r.relay} color="var(--link-connected)" label={`Relay-assisted coverage ${r.relay.toFixed(1)}%`} />}
                      </>
                    )}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {r.change === null ? "—" : fmtChange(r.change, r.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div role="img" aria-label={label} className="mt-1.5 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
