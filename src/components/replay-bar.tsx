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

/** One set of replay controls; the hero and the sky view both drive the same page-level replay. Renders only. */
export function ReplayBar({ replay, className = "" }: { replay: Replay; className?: string }) {
  const { step, n, playing, speed, setStep, setPlaying, setSpeed } = replay;
  if (n <= 1) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button size="icon-sm" aria-label={playing ? "Pause the replay" : "Play the replay"} onClick={() => setPlaying(!playing)}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <Slider
        aria-label="Time in the scenario"
        min={0}
        max={n - 1}
        value={[Math.min(step, n - 1)]}
        onValueChange={(v) => setStep(typeof v === "number" ? v : (v[0] ?? 0))}
      />
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
