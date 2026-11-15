import type { LinkState } from "@/lib/lunanav/insights";

/** The 3D stage is always dark (space), so the scenes use the dark theme's --link-* values in both themes. */
export const LINK_3D = { direct: "#4a86f0", relay: "#14a67c", blocked: "#d9503c", idle: "#93a0b8" };

/** The link state's name and colour (the --link-* tokens of globals.css), everywhere a state is shown. */
export const LINK_STATE: Record<LinkState, { text: string; color: string }> = {
  direct: { text: "Direct to Earth", color: "var(--link-direct)" },
  relay: { text: "Via relay", color: "var(--link-relay)" },
  blackout: { text: "Blackout", color: "var(--link-blocked)" },
};
