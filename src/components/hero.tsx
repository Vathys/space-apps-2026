"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";

// three.js only on the client and after first paint; the gradient behind it is the no-WebGL fallback
const HeroScene = dynamic(() => import("@/components/hero-scene"), { ssr: false });

const STEPS = [
  { n: "01", title: "Pick a site and dates", text: "A south-pole landing site and a mission window inside the supported data." },
  { n: "02", title: "See the line of sight", text: "When Earth clears the real terrain horizon, and when the Sun is up." },
  { n: "03", title: "Add a relay", text: "Compare direct-to-Earth with a simulated relay orbit: coverage and blackouts." },
];

/** The first look: an illustrative 3D scene with what LunaNav does, then how to start. */
export function Hero() {
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
    <>
      <section
        ref={box}
        aria-labelledby="hero-title"
        className="relative isolate overflow-hidden rounded-2xl border border-border bg-[radial-gradient(ellipse_at_75%_70%,#1b2235_0%,#05060c_60%)]"
      >
        <div className="absolute inset-0 -z-10">
          <HeroScene animate={visible && !reduced} />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
        <div className="flex min-h-[620px] max-w-xl flex-col justify-start p-6 sm:min-h-[440px] sm:justify-center sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-sky-300/90">NASA Space Apps 2026 · Lunar south pole</p>
          <h1 id="hero-title" className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            LunaNav
          </h1>
          <p className="mt-3 text-lg text-slate-200">When can a south-pole lander see Earth, and how much does a relay satellite help?</p>
          <p className="mt-2 text-sm text-slate-400">
            Built on JPL Horizons, LOLA terrain and published relay orbits. Geometric line-of-sight only: no link budget, scheduling or
            interference.
          </p>
          {/* A link, not a button: it moves to the planner */}
          <a href="#planner" className={buttonVariants({ size: "lg", className: "mt-6 w-fit cursor-pointer" })}>
            Start planning
          </a>
        </div>
        <p className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">Illustration · not to scale</p>
      </section>
      <ol aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-xl border border-border bg-card p-4">
            <span className="font-mono text-xs text-sky-300">{s.n}</span>
            <h2 className="mt-1 text-sm font-semibold">{s.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
