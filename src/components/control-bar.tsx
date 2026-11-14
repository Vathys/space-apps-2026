"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DIRECT, MAX_DAYS, MAX_MASK_DEG, MIN_DAYS, dateOf } from "@/lib/lunanav/scenario";
import type { Scenario } from "@/lib/lunanav/types";

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

function Pick({ label, items, value, onChange }: { label: string; items: ControlOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(String(v))}>
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

const first = (v: number | readonly number[]) => (typeof v === "number" ? v : (v[0] ?? 0));

export function ControlBar({
  scenario,
  sites,
  relays,
  antennaHeightsM,
  dates,
  onChange,
}: {
  scenario: Scenario;
  sites: ControlOption[];
  relays: ControlOption[];
  antennaHeightsM: number[];
  dates: { min: string; max: string };
  onChange: (s: Scenario) => void;
}) {
  return (
    <section aria-label="Scenario controls" className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
      <Pick label="Landing site" items={sites} value={scenario.siteId} onChange={(siteId) => onChange({ ...scenario, siteId })} />
      <Pick
        label="Relay"
        items={[{ value: DIRECT, label: "Direct only" }, ...relays]}
        value={scenario.relayConfigId ?? DIRECT}
        onChange={(v) => onChange({ ...scenario, relayConfigId: v === DIRECT ? null : v })}
      />
      <Field label="Start date (UTC)">
        <input
          type="date"
          aria-label="Start date (UTC)"
          min={dates.min}
          max={dates.max}
          value={dateOf(scenario.startUtc)}
          onChange={(e) => e.target.value && onChange({ ...scenario, startUtc: `${e.target.value}T00:00:00Z` })}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        />
      </Field>
      <Field label={`Duration: ${scenario.durationDays} ${scenario.durationDays === 1 ? "day" : "days"}`}>
        <Slider
          aria-label="Duration in days"
          min={MIN_DAYS}
          max={MAX_DAYS}
          value={[scenario.durationDays]}
          onValueChange={(v) => onChange({ ...scenario, durationDays: first(v) })}
        />
      </Field>
      <Field label={`Elevation mask: ${scenario.minElevationDeg}°`}>
        <Slider
          aria-label="Elevation mask in degrees"
          min={0}
          max={MAX_MASK_DEG}
          value={[scenario.minElevationDeg]}
          onValueChange={(v) => onChange({ ...scenario, minElevationDeg: first(v) })}
        />
      </Field>
      {antennaHeightsM.length > 1 && (
        <Pick
          label="Antenna height"
          items={antennaHeightsM.map((h) => ({ value: String(h), label: `${h} m` }))}
          value={String(scenario.antennaHeightM)}
          onChange={(v) => onChange({ ...scenario, antennaHeightM: Number(v) })}
        />
      )}
    </section>
  );
}
