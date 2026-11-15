"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export const SPEEDS = [1, 6, 36] as const; // samples per tick (10 min each)
export type Speed = (typeof SPEEDS)[number];

export interface Replay {
  /** Position inside the scenario slice, 0..n-1 */
  step: number;
  n: number;
  playing: boolean;
  speed: Speed;
  setStep: (step: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: Speed) => void;
}

const SEG = { direct: "var(--link-direct)", relay: "var(--link-relay)", blackout: "var(--link-blocked)" } as const;
export interface StateSegment {
  start: number;
  end: number;
  state: keyof typeof SEG;
}

/**
 * One set of replay controls for the whole page. With `segments` it is the mission scrubber: the link state over the
 * scenario as a coloured strip (click to seek) above the slider (drag or keyboard). Renders only.
 */
export function ReplayBar({ replay, className = "", segments }: { replay: Replay; className?: string; segments?: StateSegment[] }) {
  const { step, n, playing, speed, setStep, setPlaying, setSpeed } = replay;
  if (n <= 1) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button size="icon-sm" aria-label={playing ? "Pause the replay" : "Play the replay"} onClick={() => setPlaying(!playing)}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {segments && (
          <div
            aria-hidden
            className="relative h-3 cursor-pointer overflow-hidden rounded-sm bg-muted"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setStep(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)))); // same mapping as the strip (step / n)
            }}
          >
            {segments.map((s) => (
              <span key={s.start} className="absolute inset-y-0" style={{ left: `${(100 * s.start) / n}%`, width: `${(100 * (s.end - s.start)) / n}%`, background: SEG[s.state] }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={{ left: `${(100 * step) / n}%` }} />
          </div>
        )}
        <Slider
          aria-label="Time in the scenario"
          min={0}
          max={n - 1}
          value={[Math.min(step, n - 1)]}
          onValueChange={(v) => setStep(typeof v === "number" ? v : (v[0] ?? 0))}
        />
      </div>
      <div role="group" aria-label="Replay speed" className="flex gap-1">
        {SPEEDS.map((s) => (
          <Button key={s} size="xs" variant={s === speed ? "default" : "secondary"} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
            {s}×
          </Button>
        ))}
      </div>
    </div>
  );
}
