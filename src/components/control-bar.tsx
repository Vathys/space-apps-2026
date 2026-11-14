"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export interface ControlOption {
  value: string;
  label: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Pick({ label, items, value }: { label: string; items: ControlOption[]; value: string }) {
  return (
    <Field label={label}>
      <Select items={items} defaultValue={value}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// F1: controls render only; F3 wires them to state and the URL.
export function ControlBar({
  sites,
  relays,
  startUtc,
  durationDays,
  minElevationDeg,
}: {
  sites: ControlOption[];
  relays: ControlOption[];
  startUtc: string;
  durationDays: number;
  minElevationDeg: number;
}) {
  return (
    <section aria-label="Scenario controls" className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
      <Pick label="Landing site" items={sites} value={sites[0]?.value ?? ""} />
      <Pick label="Relay" items={[{ value: "direct", label: "Direct only" }, ...relays]} value="direct" />
      <Field label="Start date (UTC)">
        <input
          type="date"
          aria-label="Start date (UTC)"
          defaultValue={startUtc.slice(0, 10)}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        />
      </Field>
      <Field label={`Duration: ${durationDays} days`}>
        <Slider aria-label="Duration in days" min={1} max={30} defaultValue={[durationDays]} />
      </Field>
      <Field label={`Elevation mask: ${minElevationDeg}°`}>
        <Slider aria-label="Elevation mask in degrees" min={0} max={10} defaultValue={[minElevationDeg]} />
      </Field>
    </section>
  );
}
