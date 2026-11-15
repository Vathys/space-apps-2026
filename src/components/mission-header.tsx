/** Mission-briefing chrome, from the team pitch: a thin full-width top bar. */
export function MissionBar() {
  return (
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-4 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="font-sans text-[15px] font-extrabold tracking-[0.03em] text-[var(--head)] [font-stretch:125%]">
            LunaNav
            <i aria-hidden className="ml-1.5 inline-block size-[7px] bg-[var(--signal)] align-[1px]" />
          </span>
          <span className="hidden sm:inline">Mission planner</span>
          <span className="flex-1" />
          <span className="hidden md:inline">
            NASA Space Apps 2026 · <b className="font-semibold text-foreground">Lunar Landing Site Navigator</b>
          </span>
        </div>
      </div>
  );
}

/** The wide wordmark with the NASA-red square, and what the planner answers. */
export function MissionTitle() {
  return (
      <header className="pt-6">
        <p className="mb-4 flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <b className="font-semibold text-[var(--signal)]">00</b> South-pole communication planner
          <span aria-hidden className="h-px w-10 bg-border" />
        </p>
        <h1 className="text-5xl leading-[0.86] font-extrabold tracking-[-0.02em] text-[var(--head)] uppercase [font-stretch:125%] sm:text-7xl">
          LunaNav
          <i aria-hidden className="ml-[0.06em] inline-block size-[0.16em] bg-[var(--signal)] align-[0.02em]" />
        </h1>
        <p className="mt-5 max-w-[34ch] text-lg leading-snug text-foreground sm:text-xl">
          Pick the south-pole site, and the dates, where your lander can talk to Earth.
        </p>
        <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
          Every ten minutes: is there a path to Earth, direct or through a relay, and is the Sun up. Geometric line-of-sight
          only: no link budget, scheduling or interference.
        </p>
      </header>
  );
}
