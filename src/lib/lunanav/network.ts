// Network math on per-sample 0/1 visibility series (CLAUDE.md §3: pure, no React/fetch).
// Rule D-17: a sample is connected only via a complete geometric line-of-sight path,
// lander → Earth, or lander → relay → Earth with both legs clear at that sample.

import type { ConnectivityResult } from "./types";

// connected: 1 = some complete path exists; relayPerSatellite: 1 = complete path via that satellite.
export type CompletePaths = Pick<ConnectivityResult, "connected" | "relayPerSatellite">;

// Inputs already include the terrain horizon and elevation mask (visibility.ts),
// so no mask is applied here; applying it again would count it twice.
export function completePaths(
  dte: Uint8Array,
  landerSeesSat: Record<string, Uint8Array>,
  satSeesEarth: Record<string, Uint8Array>,
): CompletePaths {
  const n = dte.length;
  const landerKeys = Object.keys(landerSeesSat).sort();
  const earthKeys = Object.keys(satSeesEarth).sort();
  // A missing satellite must be an error, never a silent "not visible".
  if (landerKeys.join("\n") !== earthKeys.join("\n")) {
    throw new Error(
      `completePaths: satellite ids differ: landerSeesSat [${landerKeys.join(", ")}] vs satSeesEarth [${earthKeys.join(", ")}]`,
    );
  }
  for (const id of landerKeys) {
    if (landerSeesSat[id].length !== n || satSeesEarth[id].length !== n) {
      throw new Error(
        `completePaths: length mismatch for "${id}": dte ${n}, landerSeesSat ${landerSeesSat[id].length}, satSeesEarth ${satSeesEarth[id].length}`,
      );
    }
  }

  const connected = new Uint8Array(n);
  for (let i = 0; i < n; i++) connected[i] = dte[i] ? 1 : 0;

  const relayPerSatellite: Record<string, Uint8Array> = {};
  for (const id of landerKeys) {
    const lander = landerSeesSat[id];
    const earth = satSeesEarth[id];
    const path = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      // Both legs at the same sample: a relay that can't see Earth doesn't help.
      if (lander[i] && earth[i]) {
        path[i] = 1;
        connected[i] = 1;
      }
    }
    relayPerSatellite[id] = path;
  }

  return { connected, relayPerSatellite };
}
