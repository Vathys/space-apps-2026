import type { LinkState } from "@/lib/lunanav/insights";

/** The link state's name and colour (the --link-* tokens of globals.css), everywhere a state is shown. */
export const LINK_STATE: Record<LinkState, { text: string; color: string }> = {
  direct: { text: "Direct to Earth", color: "var(--link-direct)" },
  relay: { text: "Via relay", color: "var(--link-relay)" },
  blackout: { text: "Blackout", color: "var(--link-blocked)" },
};
