"use client";

import { useMemo } from "react";
import { ReplayBar, type Replay } from "@/components/replay-bar";
import SkyScene from "@/components/sky-scene";
import { bodiesAt, horizonFor } from "@/lib/lunanav/sky";
import type { ConnectivityResult, RelayLinkData, SiteData, TimeGrid } from "@/lib/lunanav/types";

const utcLabel = (w: TimeGrid, i: number) => new Date(Date.parse(w.startUtc) + i * w.stepSeconds * 1000).toISOString().slice(0, 16).replace("T", " ");

/** The sky from the lander at the page's replay time. Draws file values only; link colours come from `result`. */
export default function SkyPanel({
  site,
  relay,
  window,
  slice,
  antennaHeightM,
  minElevationDeg,
  result,
  replay,
}: {
  site: SiteData;
  relay: RelayLinkData | null;
  window: TimeGrid;
  slice: { startIndex: number; endIndex: number };
  antennaHeightM: number;
  minElevationDeg: number;
  result: ConnectivityResult | null;
  replay: Replay;
}) {
  const { step, n, playing, setStep, setPlaying } = replay;
  const i = slice.startIndex + Math.min(step, n - 1);
  const bodies = useMemo(() => bodiesAt(site, relay, i), [site, relay, i]);
  const horizon = horizonFor(site, antennaHeightM);
  const links = useMemo(() => {
    if (!result) return null;
    const rel = i - result.slice.startIndex;
    const out: Record<string, boolean> = { earth: result.dte[rel] === 1 };
    for (const [id, s] of Object.entries(result.relayPerSatellite)) out[id] = s[rel] === 1;
    return out;
  }, [result, i]);

  // First view: toward Earth if it's up, else the Sun if it's up, else Earth (view choice only, no number)
  const earthBody = bodies.find((b) => b.kind === "earth");
  const sunBody = bodies.find((b) => b.kind === "sun");
  const lookAz = (earthBody && earthBody.elevationDeg > 0 ? earthBody : sunBody && sunBody.elevationDeg > 0 ? sunBody : earthBody)?.azimuthDeg ?? 0;

  if (!horizon) return <p role="alert" className="text-sm text-red-400">This site file has no terrain horizon.</p>;

  const onKey = (e: React.KeyboardEvent) => {
    // Only keys on the scene itself: the slider and buttons inside handle their own
    if (e.target !== e.currentTarget) return;
    if (e.key === " ") {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === "ArrowRight") setStep(Math.min(n - 1, step + 1));
    else if (e.key === "ArrowLeft") setStep(Math.max(0, step - 1));
  };

  return (
    <section aria-label="3D sky view" className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sky from the lander</h2>
        <p className="text-xs text-muted-foreground">Drag to look around. Space plays, arrows step.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div tabIndex={0} onKeyDown={onKey} className="relative overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="aspect-[4/3] w-full">
            <SkyScene horizon={horizon} minElevationDeg={minElevationDeg} bodies={bodies} links={links} lookAzimuthDeg={lookAz} />
          </div>
          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-sm border border-white/10 bg-[#0d1730]/90 px-2 py-1 font-mono text-xs font-semibold text-[#e9efff]">
            {utcLabel(window, i)} UTC
          </div>
          <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-sm border border-white/10 bg-[#0d1730]/90 px-2 py-1 font-mono text-[10px] leading-4 text-muted-foreground">
            {links ? (
              <>
                links: <b className="text-[var(--link-direct)]">blue</b> = direct clear, <b className="text-[var(--link-relay)]">green</b> = relay path complete,{" "}
                <b className="text-[var(--link-blocked)]">red</b> = blocked
              </>
            ) : (
              "links: no result yet"
            )}
            <br />
            {relay ? "large marker = complete path via that relay" : "no relay selected"}
            {minElevationDeg > 0 && (
              <>
                <br />
                dashes = horizon + {minElevationDeg}° mask
              </>
            )}
          </div>
          <ReplayBar replay={replay} className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6" />
        </div>
        <div className="min-w-0 overflow-auto">
          <table className="w-full font-mono text-xs">
            <caption className="pb-1 text-left font-sans text-muted-foreground">At {utcLabel(window, i)} UTC (file values)</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-normal">Body</th>
                <th className="py-1 pr-2 text-right font-normal">Az °</th>
                <th className="py-1 pr-2 text-right font-normal">El °</th>
                <th className="py-1 text-right font-normal">Range km</th>
              </tr>
            </thead>
            <tbody>
              {bodies.map((b) => (
                <tr key={b.id} className="border-t border-border/60">
                  <td className="py-1 pr-2">
                    {b.label}
                    {b.seesEarth !== null && <span className="text-muted-foreground">{b.seesEarth ? " · sees Earth" : " · no Earth"}</span>}
                  </td>
                  <td className="py-1 pr-2 text-right">{b.azimuthDeg.toFixed(1)}</td>
                  <td className="py-1 pr-2 text-right">{b.elevationDeg.toFixed(1)}</td>
                  <td className="py-1 text-right">{b.rangeKm === null ? "-" : Math.round(b.rangeKm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Not to scale: body sizes and the star field are decoration. Positions are the azimuth and elevation in the data files. Geometric line-of-sight only.
      </p>
    </section>
  );
}
