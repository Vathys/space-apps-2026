"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SkyScene from "@/components/sky-scene";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { bodiesAt, horizonFor } from "@/lib/lunanav/sky";
import type { ConnectivityResult, RelayLinkData, SiteData, TimeGrid } from "@/lib/lunanav/types";

const SPEEDS = [1, 6, 36] as const; // samples per tick (10 min each at the proposed step)
const TICK_MS = 120;

const utcLabel = (w: TimeGrid, i: number) => new Date(Date.parse(w.startUtc) + i * w.stepSeconds * 1000).toISOString().slice(0, 16).replace("T", " ");

/** The sky from the lander, scrubbable like a replay. Draws file values only; link colours come from `result`. */
export default function SkyPanel({
  site,
  relay,
  window,
  slice,
  antennaHeightM,
  minElevationDeg,
  result,
}: {
  site: SiteData;
  relay: RelayLinkData | null;
  window: TimeGrid;
  slice: { startIndex: number; endIndex: number };
  antennaHeightM: number;
  minElevationDeg: number;
  result: ConnectivityResult | null;
}) {
  const n = slice.endIndex - slice.startIndex;
  const [step, setStep] = useState(0); // position inside the slice
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(6);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep((s) => (s + speed) % n), TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, n]);

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
    if (e.key === " ") {
      e.preventDefault();
      setPlaying((p) => !p);
    } else if (e.key === "ArrowRight") setStep((s) => Math.min(n - 1, s + 1));
    else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
  };

  return (
    <section aria-label="3D sky view" className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Sky from the lander</h2>
        <p className="text-xs text-muted-foreground">Drag to look around. Space plays, arrows step.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div tabIndex={0} onKeyDown={onKey} className="relative overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="aspect-[4/3] w-full">
            <SkyScene horizon={horizon} minElevationDeg={minElevationDeg} bodies={bodies} links={links} lookAzimuthDeg={lookAz} />
          </div>
          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/85 px-2 py-1 font-mono text-xs text-slate-100">
            {utcLabel(window, i)} UTC
          </div>
          <div className="pointer-events-none absolute right-3 top-3 z-20 rounded bg-black/85 px-2 py-1 font-mono text-[10px] leading-4 text-slate-300">
            {relay ? (links ? "links: green = path complete, red = not" : "links: no result yet") : "no relay selected"}
            <br />
            marker bright = relay sees Earth
            {minElevationDeg > 0 && (
              <>
                <br />
                amber dashes = horizon + {minElevationDeg}° mask
              </>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6">
            <Button size="icon-sm" variant="secondary" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <Slider aria-label="Time in the scenario" min={0} max={Math.max(n - 1, 1)} value={[Math.min(step, n - 1)]} onValueChange={(v) => setStep(typeof v === "number" ? v : (v[0] ?? 0))} />
            <div role="group" aria-label="Playback speed" className="flex gap-1">
              {SPEEDS.map((s) => (
                <Button key={s} size="xs" variant={s === speed ? "default" : "secondary"} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
                  {s}×
                </Button>
              ))}
            </div>
          </div>
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
