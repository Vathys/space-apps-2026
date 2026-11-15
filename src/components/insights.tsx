"use client";

// Render-only panels for lib/lunanav/insights.ts results. No number is computed here.
import { useState } from "react";
import { LINK_STATE } from "@/components/link-state";
import type { LinkEvent, LinkState, SatelliteShare, WindowScore } from "@/lib/lunanav/insights";

const STATE = LINK_STATE;
// The link colours themselves (validated on the card surface: dataviz validate_palette.js, all pass)
const SERIES = { relay: "var(--link-relay)", direct: "var(--link-direct)" } as const;

const H = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`);
const utc = (s: string) => s.slice(0, 16).replace("T", " ");
const PANEL = "rounded-sm border border-border bg-card p-4";
const TITLE = "font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase";

/** "Blackout in 12.5 h" style countdown to the next link change. */
export function NextChange({ next }: { next: { state: LinkState; inHours: number } | null }) {
  return (
    <p className="font-mono text-xs text-muted-foreground">
      {next ? (
        <>
          Next: <b style={{ color: STATE[next.state].color }}>{STATE[next.state].text}</b> in <b className="text-foreground">{H(next.inHours)}</b>
        </>
      ) : (
        "No change until the end of the scenario"
      )}
    </p>
  );
}

/** Every link change, with a jump to it on the replay clock. */
export function EventsLog({ events, step, onJump }: { events: LinkEvent[]; step: number; onJump: (step: number) => void }) {
  const current = events.findLastIndex((e) => e.step <= step);
  return (
    <section aria-label="Mission events" className={PANEL}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className={TITLE}>Mission events</h2>
        <span className="font-mono text-[10px] text-muted-foreground">N / P: next / previous</span>
      </div>
      <ol className="max-h-72 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {events.map((e, k) => (
          <li key={e.step}>
            <button
              type="button"
              onClick={() => onJump(e.step)}
              aria-current={k === current ? "step" : undefined}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-2 text-left font-mono text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${k === current ? "bg-muted" : ""}`}
            >
              <span className="w-28 shrink-0 text-muted-foreground">{utc(e.utc)}</span>
              <i className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATE[e.state].color }} />
              <span className="flex-1 text-foreground">{STATE[e.state].text}</span>
              <span className="text-muted-foreground">{H(e.hours)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Hours each relay satellite gives a complete path, and the hours it is the only one. */
export function SatelliteShares({ shares }: { shares: SatelliteShare[] }) {
  if (!shares.length) return null;
  return (
    <section aria-label="Relay satellites" className={PANEL}>
      <h2 className={`${TITLE} mb-3`}>Relay satellites · complete-path hours</h2>
      <ul className="flex flex-col gap-2.5">
        {shares.map((s) => (
          <li key={s.id} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 font-mono text-xs">
            <span className="truncate text-foreground">{s.name}</span>
            <span aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${s.pct}%`, background: SERIES.relay }} />
            </span>
            <span className="text-right text-muted-foreground">
              {s.hours.toFixed(0)} h{s.soleHours > 0 ? ` · only path ${s.soleHours.toFixed(1)} h` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        {shares.every((s) => s.soleHours === 0)
          ? "No satellite is ever the only path: losing any one of them loses no coverage in this scenario."
          : "“Only path”: hours with no direct line and no other relay, lost without that satellite."}
      </p>
    </section>
  );
}

/** Coverage against the link mask, with relay and direct only, as a line chart and a table. */
export function MaskCurve({
  points,
  currentDeg,
  hasRelay,
}: {
  points: { maskDeg: number; coveragePct: number; dteCoveragePct: number }[];
  currentDeg: number;
  hasRelay: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const Hh = 150;
  const pad = { l: 32, r: 12, t: 10, b: 24 };
  const x = (m: number) => pad.l + (m / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - p / 100) * (Hh - pad.t - pad.b);
  const line = (key: "coveragePct" | "dteCoveragePct") => points.map((p, k) => `${k ? "L" : "M"}${x(p.maskDeg)},${y(p[key])}`).join(" ");
  const h = hover !== null ? points[hover] : null;
  return (
    <section aria-label="Mask sensitivity" className={PANEL}>
      <h2 className={`${TITLE} mb-2`}>Mask sensitivity</h2>
      <div className="mb-1 flex gap-4 font-mono text-[11px] text-muted-foreground">
        {hasRelay && (
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-0.5 w-4" style={{ background: SERIES.relay }} /> With relay
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-0.5 w-4" style={{ background: SERIES.direct }} /> Direct only
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${Hh}`} className="max-h-52 w-full" role="img" aria-label="Coverage percent against the minimum elevation mask, 0 to 10 degrees" onMouseLeave={() => setHover(null)}>
          {[0, 50, 100].map((p) => (
            <g key={p}>
              <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={pad.l - 6} y={y(p) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {p}%
              </text>
            </g>
          ))}
          {points.map((p) => (
            <text key={p.maskDeg} x={x(p.maskDeg)} y={Hh - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
              {p.maskDeg % 2 === 0 ? `${p.maskDeg}°` : ""}
            </text>
          ))}
          <line x1={x(currentDeg)} x2={x(currentDeg)} y1={pad.t} y2={Hh - pad.b} stroke="currentColor" className="text-muted-foreground" strokeDasharray="3 3" strokeWidth={1} />
          {hasRelay && <path d={line("coveragePct")} fill="none" stroke={SERIES.relay} strokeWidth={2} strokeLinejoin="round" />}
          <path d={line("dteCoveragePct")} fill="none" stroke={SERIES.direct} strokeWidth={2} strokeLinejoin="round" />
          {h && (
            <g>
              <line x1={x(h.maskDeg)} x2={x(h.maskDeg)} y1={pad.t} y2={Hh - pad.b} stroke="currentColor" className="text-foreground/40" strokeWidth={1} />
              {hasRelay && <circle cx={x(h.maskDeg)} cy={y(h.coveragePct)} r={4} fill={SERIES.relay} stroke="var(--card)" strokeWidth={2} />}
              <circle cx={x(h.maskDeg)} cy={y(h.dteCoveragePct)} r={4} fill={SERIES.direct} stroke="var(--card)" strokeWidth={2} />
            </g>
          )}
          {/* Hit targets wider than the marks: one column per mask value */}
          {points.map((p, k) => (
            <rect key={p.maskDeg} x={x(p.maskDeg) - (W - pad.l - pad.r) / (points.length - 1) / 2} y={0} width={(W - pad.l - pad.r) / (points.length - 1)} height={Hh} fill="transparent" onMouseEnter={() => setHover(k)} />
          ))}
        </svg>
        {h && (
          <div className="pointer-events-none absolute top-1 right-1 rounded-sm border border-border bg-background/95 px-2 py-1 font-mono text-[11px]">
            <b className="text-foreground">{h.maskDeg}° mask</b>
            {hasRelay && <div className="text-muted-foreground">With relay {h.coveragePct.toFixed(1)}%</div>}
            <div className="text-muted-foreground">Direct only {h.dteCoveragePct.toFixed(1)}%</div>
          </div>
        )}
      </div>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Table: coverage by mask</summary>
        <table className="mt-1 w-full font-mono">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="font-normal">Mask</th>
              {hasRelay && <th className="text-right font-normal">With relay</th>}
              <th className="text-right font-normal">Direct only</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.maskDeg} className="border-t border-border/60">
                <td>{p.maskDeg}°</td>
                {hasRelay && <td className="text-right">{p.coveragePct.toFixed(1)}%</td>}
                <td className="text-right">{p.dteCoveragePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

/** Coverage for each possible start date (same duration, relay and mask): a heat strip of days; click picks the start. */
export function WindowCalendar({
  scores,
  best,
  currentStartUtc,
  durationDays,
  onPick,
}: {
  scores: WindowScore[];
  best: WindowScore | null;
  currentStartUtc: string;
  durationDays: number;
  onPick: (startUtc: string) => void;
}) {
  const [hover, setHover] = useState<WindowScore | null>(null);
  const shown = hover ?? scores.find((s) => s.startUtc.slice(0, 10) === currentStartUtc.slice(0, 10)) ?? null;
  return (
    <section aria-label="Best launch window" className={PANEL}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={TITLE}>Best window · {durationDays}-day missions</h2>
        {best && (
          <button
            type="button"
            onClick={() => onPick(best.startUtc)}
            className="min-h-9 cursor-pointer rounded-sm bg-primary px-3 font-mono text-[11px] font-semibold tracking-[0.08em] text-primary-foreground uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Use best: {best.startUtc.slice(0, 10)} · {best.coveragePct.toFixed(1)}%
          </button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-[2px]" onMouseLeave={() => setHover(null)}>
        {scores.map((s) => {
          const on = s.startUtc.slice(0, 10) === currentStartUtc.slice(0, 10);
          const isBest = best?.startUtc === s.startUtc;
          return (
            <button
              key={s.startUtc}
              type="button"
              onClick={() => onPick(s.startUtc)}
              onMouseEnter={() => setHover(s)}
              onFocus={() => setHover(s)}
              aria-label={`Start ${s.startUtc.slice(0, 10)}: coverage ${s.coveragePct.toFixed(1)}%`}
              aria-pressed={on}
              className={`aspect-square cursor-pointer rounded-[3px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${on ? "ring-2 ring-foreground" : isBest ? "ring-1 ring-[var(--signal)]" : ""}`}
              // Sequential, one hue: the card surface toward the direct-link blue as coverage rises
              style={{ background: `color-mix(in oklab, ${SERIES.direct} ${12 + 0.88 * s.coveragePct}%, var(--card))` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[11px] text-muted-foreground">
        <span>
          {shown
            ? `${shown.startUtc.slice(0, 10)} → ${shown.coveragePct.toFixed(1)}% coverage · longest blackout ${H(shown.longestBlackoutHours)}`
            : "Hover a day"}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          0%
          <i className="inline-block h-2 w-16 rounded-full" style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${SERIES.direct} 12%, var(--card)), ${SERIES.direct})` }} />
          100%
        </span>
      </div>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Table: every start date</summary>
        <div className="mt-1 max-h-48 overflow-y-auto">
          <table className="w-full font-mono">
            <thead className="sticky top-0 bg-card text-left text-muted-foreground">
              <tr>
                <th className="font-normal">Start</th>
                <th className="text-right font-normal">Coverage</th>
                <th className="text-right font-normal">Direct</th>
                <th className="text-right font-normal">Longest blackout</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.startUtc} className="border-t border-border/60">
                  <td>{s.startUtc.slice(0, 10)}</td>
                  <td className="text-right">{s.coveragePct.toFixed(1)}%</td>
                  <td className="text-right">{s.dteCoveragePct.toFixed(1)}%</td>
                  <td className="text-right">{H(s.longestBlackoutHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
