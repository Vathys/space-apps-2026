"use client";

import dynamic from "next/dynamic";
import { Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HeroSite, HeroSky } from "@/components/hero-scene";

/** The path at the replay time, read from the analysis result: direct first, else a complete relay path, else none */
export type LinkStatus = "direct" | "relay" | "blackout";
const STATUS = {
  direct: { text: "Direct to Earth", color: "var(--link-direct)" },
  relay: { text: "Via relay", color: "var(--link-relay)" },
  blackout: { text: "Blackout", color: "var(--link-blocked)" },
} as const;

// three.js only on the client and after first paint; the deep-space gradient behind it is the no-WebGL fallback
const HeroScene = dynamic(() => import("@/components/hero-scene"), { ssr: false });

const STEPS = ["Pick a site", "Pick a window", "Add a relay", "Read the timeline"];

/** Line of sight now (from the analysis result), as a coloured dot and words: never colour alone. */
export function LinkChip({ status, large = false }: { status: LinkStatus | null; large?: boolean }) {
  if (!status) return <span className="font-mono text-xs text-muted-foreground">No result yet</span>;
  return (
    <span
      role="status"
      aria-label={`Line of sight now: ${STATUS[status].text}`}
      className={`flex items-center gap-2 font-mono font-semibold tracking-[0.1em] uppercase ${large ? "text-base" : "text-[11px]"}`}
      style={{ color: STATUS[status].color }}
    >
      <i className={`inline-block rounded-full ${large ? "size-3" : "size-2"} ${status === "blackout" ? "motion-safe:animate-pulse" : ""}`} style={{ background: STATUS[status].color }} />
      {STATUS[status].text}
    </span>
  );
}

/** What LunaNav answers, in a panel above the stage (never on the 3D). Closable. */
export function Briefing({ onClose, onStory }: { onClose: () => void; onStory: () => void }) {
  return (
    <section aria-labelledby="hero-title" className="relative grid gap-4 rounded-sm border border-border bg-card/60 px-4 py-5 pr-14 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end lg:gap-10">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the briefing"
        className="absolute top-2 right-2 grid size-11 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X aria-hidden className="size-5" />
      </button>
      <div>
        <p className="mb-3 flex items-center gap-2.5 font-mono text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          <b className="font-semibold text-[var(--signal)]">00</b> Mission briefing
          <span aria-hidden className="h-px w-10 bg-border" />
        </p>
        <h1
          id="hero-title"
          className="text-[clamp(40px,4.6vw,72px)] leading-[0.86] font-extrabold whitespace-nowrap tracking-[-0.02em] text-[var(--head)] uppercase [font-stretch:125%]"
        >
          LunaNav
          <i aria-hidden className="ml-[0.06em] inline-block size-[0.16em] bg-[var(--signal)] align-[0.02em]" />
        </h1>
      </div>
      <div>
        <p className="max-w-[44ch] text-[clamp(17px,1.3vw,21px)] leading-[1.36] text-foreground">
          Pick the south-pole landing site, and the dates, where your lander can talk to Earth.
        </p>
        <p className="mt-2 hidden max-w-[66ch] text-sm text-muted-foreground sm:block">
          For each site and window, see every ten minutes whether there is a path to Earth, direct or through a relay, and
          whether the Sun is up. Geometric line-of-sight only.
        </p>
        <ol aria-label="How it works" className="mt-3 hidden flex-wrap gap-2 sm:flex">
          {STEPS.map((x, i) => (
            <li key={x} className="flex items-center gap-2.5 rounded-sm border border-border bg-card/80 py-1.5 pr-3 pl-1.5 text-sm font-semibold">
              <b className="grid size-6 place-items-center rounded-sm bg-primary font-mono text-xs text-primary-foreground">{i + 1}</b>
              {x}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onStory}
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm bg-primary px-4 font-mono text-xs font-semibold tracking-[0.1em] text-primary-foreground uppercase hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Play aria-hidden className="size-4" />
          Watch the mission story
        </button>
      </div>
    </section>
  );
}

/**
 * The orbit view: the Moon with the south pole up, the sites, and the Sun, Earth and relay satellites where the files put
 * them at the replay time. Draws only while `active` (its stage tab is shown), on screen, and motion is allowed.
 */
export function OrbitView({
  sites,
  selectedId,
  sky,
  active,
  landingKey,
}: {
  sites: HeroSite[];
  selectedId: string | null;
  sky: HeroSky | null;
  active: boolean;
  landingKey: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    // Stop drawing frames while the stage is scrolled away
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    if (box.current) io.observe(box.current);
    return () => {
      mq.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={box}
      className="h-full cursor-grab bg-[radial-gradient(50%_60%_at_50%_50%,rgba(58,116,232,.14)_0%,transparent_72%),linear-gradient(180deg,#0b1222_0%,#070b14_100%)] active:cursor-grabbing"
    >
      <HeroScene animate={active && visible && !reduced} sites={sites} selectedId={selectedId} sky={sky} landingKey={landingKey} />
    </div>
  );
}
