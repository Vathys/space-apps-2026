"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { HeroSite, HeroSky } from "@/components/hero-scene";
import { LINK_STATE } from "@/components/link-state";
import type { LinkState } from "@/lib/lunanav/insights";

/** The path at the replay time, read from the analysis result: direct first, else a complete relay path, else none */
export type LinkStatus = LinkState;
const STATUS = LINK_STATE;

// three.js only on the client and after first paint; the deep-space gradient behind it is the no-WebGL fallback
const HeroScene = dynamic(() => import("@/components/hero-scene"), { ssr: false });

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
