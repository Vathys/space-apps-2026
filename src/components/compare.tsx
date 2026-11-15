"use client";

// Scenario A vs B side by side (F16). Renders only: both summaries come from analysis.ts via the page.
import { X } from "lucide-react";
import { DateField, Pick, type ControlOption } from "@/components/control-bar";
import type { StateSegment } from "@/components/replay-bar";
import type { AbRow } from "@/lib/lunanav/series";
import type { CoverageSummary } from "@/lib/lunanav/types";

const SEG = { direct: "var(--link-direct)", relay: "var(--link-relay)", blackout: "var(--link-blocked)" } as const;
const TITLE = "font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase";

export interface Side {
  label: string;
  summary: CoverageSummary;
  segments: StateSegment[];
  n: number;
}

function Strip({ side }: { side: Side }) {
  return (
    <div aria-hidden className="relative h-2.5 overflow-hidden rounded-sm bg-muted">
      {side.segments.map((s) => (
        <span key={s.start} className="absolute inset-y-0" style={{ left: `${(100 * s.start) / side.n}%`, width: `${(100 * (s.end - s.start)) / side.n}%`, background: SEG[s.state] }} />
      ))}
    </div>
  );
}


export function CompareAB({
  a,
  b,
  bNote,
  rows,
  notes,
  sites,
  bSiteId,
  bDate,
  dates,
  onSite,
  onDate,
  onClose,
}: {
  a: Side;
  b: Side | null;
  /** Why B has no numbers (loading, outside the window, load error) */
  bNote: string | null;
  /** From series.abRows: the change column uses the rounded values */
  rows: AbRow[];
  /** What B changes beyond the site and date (antenna height, relay), so the table isn't misread */
  notes: string[];
  sites: ControlOption[];
  bSiteId: string;
  bDate: string;
  dates: { min: string; max: string };
  onSite: (id: string) => void;
  onDate: (date: string) => void;
  onClose: () => void;
}) {
  const fmt = (v: number, unit: string) => (unit === "" ? v.toFixed(0) : `${v.toFixed(1)}${unit === "%" ? "%" : " h"}`);
  return (
    <section aria-label="Compare two scenarios" className="rounded-sm border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={TITLE}>Compare · A vs B</h2>
        <button type="button" onClick={onClose} aria-label="Close the comparison" className="grid size-9 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <p className="min-w-44 flex-1 text-sm">
          <span className="font-mono text-xs text-muted-foreground">A (above)</span>
          <br />
          {a.label}
        </p>
        <div className="flex min-w-72 flex-[2] flex-wrap gap-4">
          <Pick label="B · site" items={sites} value={bSiteId} onChange={onSite} />
          <div className="flex min-w-44 flex-1 flex-col gap-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">B · start date (UTC)</span>
            <DateField value={bDate} min={dates.min} max={dates.max} onCommit={onDate} />
          </div>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Same duration, relay and mask for both; only the site or the start date differs. Geometric line-of-sight only.</p>
      {notes.map((t) => (
        <p key={t} role="note" className="mb-3 rounded-sm border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-xs text-foreground">
          {t}
        </p>
      ))}
      <div className="mb-4 grid gap-2">
        <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 font-mono text-xs">
          <b>A</b>
          <Strip side={a} />
        </div>
        <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 font-mono text-xs">
          <b>B</b>
          {b ? <Strip side={b} /> : <span className="text-muted-foreground">{bNote}</span>}
        </div>
      </div>
      <table className="w-full font-mono text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 font-normal">Metric</th>
            <th className="py-1 text-right font-normal">A</th>
            <th className="py-1 text-right font-normal">B</th>
            <th className="py-1 text-right font-normal">B − A</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const va = r.a;
            const vb = r.b;
            const d = r.change;
            const good = d !== null && d !== 0 && (r.better === "up" ? d > 0 : d < 0);
            return (
              <tr key={r.label} className="border-t border-border/60">
                <td className="py-1.5 font-sans text-sm">{r.label}</td>
                <td className="py-1.5 text-right">{fmt(va, r.unit)}</td>
                <td className="py-1.5 text-right">{vb === null ? "—" : fmt(vb, r.unit)}</td>
                <td className={`py-1.5 text-right ${d === null || d === 0 ? "text-muted-foreground" : good ? "text-[var(--link-relay)]" : "text-[var(--link-blocked)]"}`}>
                  {d === null ? "—" : d === 0 ? "same" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d), r.unit)}${good ? " better" : " worse"}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
