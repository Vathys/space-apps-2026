"use client";

import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";

export interface Chapter {
  title: string;
  /** Text with numbers already filled in from the result (lib/lunanav), never typed by hand */
  text: string;
}

const BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-3 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

/** The story's current chapter, shown in the readout column (beside the 3D, never on it). Renders only. */
export function StoryCard({
  chapters,
  at,
  demo,
  onGo,
  onClose,
  onDemo,
}: {
  chapters: Chapter[];
  at: number;
  demo: boolean;
  onGo: (chapter: number) => void;
  onClose: () => void;
  onDemo: (on: boolean) => void;
}) {
  const c = chapters[at]!;
  return (
    <section aria-label="Mission story" aria-live="polite" className="rounded-sm border border-primary/50 bg-primary/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          Story · {at + 1} / {chapters.length}
        </p>
        <button type="button" onClick={onClose} aria-label="Skip the story" className={`${BTN} -mr-2 text-muted-foreground hover:bg-muted hover:text-foreground`}>
          Skip <X aria-hidden className="size-4" />
        </button>
      </div>
      <h2 className="mt-1 text-lg font-bold text-foreground">{c.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
      <div aria-hidden className="mt-3 flex gap-1">
        {chapters.map((_, k) => (
          <span key={k} className={`h-1 flex-1 rounded-full ${k <= at ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onGo(at - 1)} disabled={at === 0} className={`${BTN} border border-border text-foreground hover:bg-muted`}>
          <ChevronLeft aria-hidden className="size-4" /> Back
        </button>
        <button type="button" onClick={() => onGo(at + 1)} className={`${BTN} bg-primary text-primary-foreground hover:bg-primary/90`}>
          {at === chapters.length - 1 ? "Start planning" : "Next"} <ChevronRight aria-hidden className="size-4" />
        </button>
        <button type="button" onClick={() => onDemo(!demo)} aria-pressed={demo} className={`${BTN} ml-auto text-muted-foreground hover:bg-muted hover:text-foreground`}>
          {demo ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          {demo ? "Pause demo" : "Auto-play"}
        </button>
      </div>
    </section>
  );
}
