"use client";

import { Slider } from "@/components/ui/slider";
import { MAX_MASK_DEG } from "@/lib/lunanav/scenario";

/**
 * D-20: the elevation mask sits with the direct-to-Earth results, because it mostly moves DTE coverage
 * (at the P0 site the relays stay far above it). It still applies to both DTE and lander→relay legs (D-17).
 */
export function MaskControl({ valueDeg, onChange }: { valueDeg: number; onChange: (deg: number) => void }) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <label id="mask-label" className="text-xs font-medium text-muted-foreground">
        Minimum elevation above terrain: <span className="font-mono text-foreground">{valueDeg}°</span>
        <span className="block font-normal">Affects direct-to-Earth most; applies to relay links too.</span>
      </label>
      <Slider
        aria-labelledby="mask-label"
        min={0}
        max={MAX_MASK_DEG}
        value={[valueDeg]}
        onValueChange={(v) => onChange(typeof v === "number" ? v : (v[0] ?? 0))}
      />
    </div>
  );
}
