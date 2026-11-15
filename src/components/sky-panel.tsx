"use client";

import { useMemo, useState } from "react";
import type { Replay } from "@/components/replay-bar";
import SkyScene, { type Surface } from "@/components/sky-scene";
import { skyTrack } from "@/lib/lunanav/insights";
import { bodiesAt, horizonFor } from "@/lib/lunanav/sky";
import { horizonElevationDeg } from "@/lib/lunanav/visibility";
import type { ConnectivityResult, RelayLinkData, SiteData } from "@/lib/lunanav/types";

/** A small segmented control (pressed buttons), used for the camera and the surface filter. */
function Toggle<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-sm border border-border p-0.5">
      <span className="px-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{label}</span>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-9 cursor-pointer rounded-[3px] px-3 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * The lander on the terrain at the page's replay time (the stage's "At the lander" tab). Draws file values only; link
 * colours come from `result`. Renders frames only while `active`.
 */
export default function SkyPanel({
  site,
  relay,
  slice,
  antennaHeightM,
  minElevationDeg,
  result,
  replay,
  active,
}: {
  site: SiteData;
  relay: RelayLinkData | null;
  slice: { startIndex: number; endIndex: number };
  antennaHeightM: number;
  minElevationDeg: number;
  result: ConnectivityResult | null;
  replay: Replay;
  active: boolean;
}) {
  const { step, n, playing, setStep, setPlaying } = replay;
  const [view, setView] = useState<"chase" | "lander">("chase");
  const [surface, setSurface] = useState<Surface>("ice");
  const i = slice.startIndex + Math.min(step, n - 1);
  const bodies = useMemo(() => bodiesAt(site, relay, i), [site, relay, i]);
  const horizon = horizonFor(site, antennaHeightM);
  const paths = useMemo(
    () => ({ earth: skyTrack(site.earth.azimuthDeg, site.earth.elevationDeg, slice), sun: skyTrack(site.sun.azimuthDeg, site.sun.elevationDeg, slice) }),
    [site, slice],
  );
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

  // At the pole the Sun skims the horizon (about ±1.5° in these files), so the ridge decides light or dark: say which
  const sunFrac = result ? result.sunlitFraction[i - result.slice.startIndex] : null;

  if (!horizon) return <p role="alert" className="p-4 text-sm text-red-400">This site file has no terrain horizon.</p>;

  const onKey = (e: React.KeyboardEvent) => {
    // Only keys on the scene itself: the buttons inside handle their own
    if (e.target !== e.currentTarget) return;
    if (e.key === " ") {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === "ArrowRight") setStep(Math.min(n - 1, step + 1));
    else if (e.key === "ArrowLeft") setStep(Math.max(0, step - 1));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Toggle label="Camera" value={view} onChange={setView} options={[["chase", "Chase cam"], ["lander", "Lander cam"]]} />
        <Toggle label="Surface" value={surface} onChange={setSurface} options={[["regolith", "Regolith"], ["ice", "Ice"], ["data", "Data only"]]} />
        {sunBody && (
          <p className="ml-auto font-mono text-[11px] text-muted-foreground">
            Sun <b className="text-foreground">{sunBody.elevationDeg.toFixed(1)}°</b> · ridge there {horizonElevationDeg(horizon, sunBody.azimuthDeg).toFixed(1)}°
            {sunFrac !== null &&
              (sunFrac > 0 ? (
                <b className="text-[var(--link-sun)]"> · {Math.round(sunFrac * 100)}% of the disk up</b>
              ) : (
                <b className="text-foreground"> · behind the ridge: no sunlight</b>
              ))}
          </p>
        )}
        <p className="hidden text-xs text-muted-foreground 2xl:block">
          {view === "chase" ? "Drag to orbit the lander, scroll to zoom." : "Drag to look around."} Space plays, arrows step.
        </p>
      </div>
      <div tabIndex={0} onKeyDown={onKey} aria-label="Lander on the terrain, 3D" className="relative min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <SkyScene view={view} surface={surface} active={active} paths={paths} horizon={horizon} minElevationDeg={minElevationDeg} bodies={bodies} links={links} lookAzimuthDeg={lookAz} />
        {view === "lander" && (
          <>
            {/* Lander cam HUD: a crosshair and the mast height the elevations are measured at */}
            <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-10 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute top-1/2 left-0 h-px w-full bg-white/40" />
              <span className="absolute top-0 left-1/2 h-full w-px bg-white/40" />
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-sm border border-white/10 bg-[#0e1524]/90 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] text-[#e8edf6] uppercase">
              <i className="inline-block size-2 rounded-full bg-[var(--link-blocked)] motion-safe:animate-pulse" />
              Lander cam · {antennaHeightM} m mast
            </div>
          </>
        )}
        <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-sm border border-white/10 bg-[#0e1524]/90 px-2 py-1 font-mono text-[10px] leading-4 text-muted-foreground">
          {links ? (
            <>
              <b className="text-[var(--link-direct)]">blue</b> direct clear · <b className="text-[var(--link-relay)]">green</b> relay path complete ·{" "}
              <b className="text-[var(--link-blocked)]">red</b> blocked
            </>
          ) : (
            "links: no result yet"
          )}
          <br />
          dotted: <b className="text-[var(--link-direct)]">Earth</b> and <b className="text-[#b8871f]">Sun</b> paths over the scenario
          {minElevationDeg > 0 && (
            <>
              <br />
              dashes = horizon + {minElevationDeg}° mask
            </>
          )}
        </div>
      </div>
    </div>
  );
}
