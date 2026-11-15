"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataError, loadPoint, type LivePoint } from "@/lib/lunanav/data";
import type { DatasetIndex } from "@/lib/lunanav/types";

const INPUT = "h-9 w-28 rounded-md border border-border bg-background px-2 font-mono text-sm tabular-nums";

/**
 * F8 (D-24): pick any south-pole point; the point server (D-25) computes it live. When it doesn't answer, the
 * precomputed sites in the site picker still work, and this says so.
 */
export function PointPicker({
  index,
  precomputedCount,
  live,
  onPicked,
}: {
  index: DatasetIndex;
  precomputedCount: number;
  /** The picked point now on screen, if the current site is one */
  live: LivePoint | null;
  onPicked: (p: LivePoint) => void;
}) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    loadPoint(index, Number(lat), Number(lon))
      .then(onPicked, (err: unknown) =>
        setMsg(
          err instanceof DataError && err.code === "point-rejected"
            ? `The point server refused this point: ${err.detail}`
            : err instanceof DataError && err.code === "point-offline"
              ? `Live point analysis is offline. Choose one of the ${precomputedCount} precomputed sites above.`
              : `The point server's reply could not be used: ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <section aria-labelledby="pick-title" className="rounded-xl border border-border bg-card p-4">
      <h2 id="pick-title" className="text-sm font-semibold">
        Pick a point
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Any point from −90° to −85° latitude (planetocentric, longitude east). Computed live by the LunaNav point server in a few seconds.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Latitude °
          <input className={INPUT} type="number" required step="any" min={-90} max={-85} placeholder="-87.5" value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Longitude ° E
          <input className={INPUT} type="number" required step="any" min={0} max={360} placeholder="30" value={lon} onChange={(e) => setLon(e.target.value)} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Computing…" : "Compute live"}
        </Button>
      </form>
      <p aria-live="polite" className="mt-2 text-sm">
        {msg ? (
          <span role="alert" className="text-amber-300">
            {msg}
          </span>
        ) : live ? (
          <span className="text-muted-foreground">
            Showing {live.meta.name}: computed live by the LunaNav point server.
          </span>
        ) : null}
      </p>
    </section>
  );
}
