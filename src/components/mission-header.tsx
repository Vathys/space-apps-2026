"use client";

import { Moon, Sun } from "lucide-react";

/** Flips the theme on <html> and remembers it (the layout's script applies it before paint next time). */
function ThemeToggle() {
  const flip = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("lunanav.theme", dark ? "dark" : "light");
    } catch {
      // Storage blocked: the switch still works for this visit
    }
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label="Switch between light and dark theme"
      className="-mr-2 grid size-11 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Sun aria-hidden className="hidden size-5 dark:block" />
      <Moon aria-hidden className="size-5 dark:hidden" />
    </button>
  );
}

/** Mission-briefing chrome, from the team pitch: a thin full-width top bar. */
export function MissionBar({ children }: { children?: React.ReactNode }) {
  return (
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-[1600px] items-center gap-4 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="font-sans text-[15px] font-extrabold tracking-[0.03em] text-[var(--head)] [font-stretch:125%]">
            LunaNav
            <i aria-hidden className="ml-1.5 inline-block size-[7px] bg-[var(--signal)] align-[1px]" />
          </span>
          <span className="hidden sm:inline">Mission planner</span>
          <span className="flex-1" />
          {children}
          <span className="hidden 2xl:inline">
            NASA Space Apps 2026 · <b className="font-semibold text-foreground">Lunar Landing Site Navigator</b>
          </span>
          <ThemeToggle />
        </div>
      </div>
  );
}
