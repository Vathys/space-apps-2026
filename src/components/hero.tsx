"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { HeroSite, HeroSky } from "@/components/hero-scene";
import { ReplayBar, type Replay } from "@/components/replay-bar";
import { buttonVariants } from "@/components/ui/button";

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

/**
 * The first look, after the team pitch's opening slide: the Moon with the south pole up, the sites, and the Sun and
 * Earth where they are at the start of the chosen scenario, with what LunaNav answers on the left.
 */
export function Hero({
  sites,
  selectedId,
  sky,
  atUtc,
  replay,
  status,
}: {
  sites: HeroSite[];
  selectedId: string | null;
  sky: HeroSky | null;
  atUtc: string | null;
  replay: Replay | null;
  status: LinkStatus | null;
}) {
  const box = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    // Stop drawing frames while the hero is scrolled away
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    if (box.current) io.observe(box.current);
    return () => {
      mq.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);

  return (
    <section
      ref={box}
      aria-labelledby="hero-title"
      className="relative isolate -mx-4 overflow-hidden border-b border-border bg-[radial-gradient(40%_58%_at_72%_50%,rgba(61,123,255,.18)_0%,transparent_72%),linear-gradient(180deg,#081028_0%,#050a17_55%,#0a1430_100%)] sm:mx-0 sm:rounded-sm sm:border"
    >
      <div className="absolute inset-0 -z-10 cursor-grab active:cursor-grabbing">
        <HeroScene animate={visible && !reduced} sites={sites} selectedId={selectedId} sky={sky} />
      </div>
      {/* Veil: keeps the text readable over the scene, like the pitch */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,10,23,.97)_0%,rgba(5,10,23,.9)_30%,rgba(5,10,23,0)_56%)] max-sm:bg-[linear-gradient(180deg,rgba(5,10,23,.97)_0%,rgba(5,10,23,.88)_45%,rgba(5,10,23,0)_70%)]" />
      <div className="pointer-events-none flex min-h-[820px] max-w-[620px] flex-col justify-start px-4 pt-8 pb-36 sm:min-h-[600px] sm:justify-center sm:px-10 sm:pb-28">
        <p className="mb-5 flex items-center gap-2.5 font-mono text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          <b className="font-semibold text-[var(--signal)]">00</b> Mission briefing
          <span aria-hidden className="h-px w-10 bg-border" />
        </p>
        <h1
          id="hero-title"
          className="text-[clamp(48px,6.4vw,92px)] leading-[0.86] whitespace-nowrap font-extrabold tracking-[-0.02em] text-[var(--head)] uppercase [font-stretch:125%]"
        >
          LunaNav
          <i aria-hidden className="ml-[0.06em] inline-block size-[0.16em] bg-[var(--signal)] align-[0.02em]" />
        </h1>
        <p className="mt-6 max-w-[32ch] text-[clamp(19px,1.6vw,24px)] leading-[1.36] text-foreground">
          Pick the south-pole landing site, and the dates, where your lander can talk to Earth.
        </p>
        <p className="mt-3 max-w-[48ch] text-base text-muted-foreground">
          For each site and window, see every ten minutes whether there is a path to Earth, direct or through a relay, and
          whether the Sun is up. Geometric line-of-sight only.
        </p>
        <ol aria-label="How it works" className="mt-6 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 rounded-sm border border-border bg-card/80 py-2 pr-3.5 pl-2 text-sm font-semibold">
              <b className="grid size-6 place-items-center rounded-sm bg-primary font-mono text-xs text-primary-foreground">{i + 1}</b>
              {s}
            </li>
          ))}
        </ol>
        {/* A link, not a button: it moves to the planner */}
        <a href="#planner" className={buttonVariants({ size: "lg", className: "pointer-events-auto mt-7 w-fit cursor-pointer" })}>
          Start planning
        </a>
      </div>
      {/* Mission replay: the scene, the sky view and the timelines all follow this one clock */}
      <div className="absolute inset-x-3 bottom-3 flex flex-col items-end gap-2">
        <p className="pointer-events-none rounded-sm border border-[#4a3d1c] bg-card/90 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-[#f3c463] uppercase">
          {atUtc ? <b className="text-foreground">{atUtc.slice(0, 16).replace("T", " ")} UTC</b> : null}
          {atUtc ? " · " : null}Horizons + LOLA{sky?.relays.length ? " · simulated relay orbits, heights shrunk" : ""} · not to scale
        </p>
        {replay && (
          <div className="flex w-full items-center gap-3 rounded-sm border border-border bg-card/90 px-3 py-2">
            {status && (
              <span
                role="status"
                aria-label={`Line of sight now: ${STATUS[status].text}`}
                className="flex shrink-0 items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: STATUS[status].color }}
              >
                <i className={`inline-block size-2 rounded-full ${status === "blackout" ? "motion-safe:animate-pulse" : ""}`} style={{ background: STATUS[status].color }} />
                {STATUS[status].text}
              </span>
            )}
            <ReplayBar replay={replay} className="min-w-0 flex-1" />
          </div>
        )}
      </div>
    </section>
  );
}
