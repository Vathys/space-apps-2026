"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DIRECT, MIN_DAYS, dateOf, isDate } from "@/lib/lunanav/scenario";
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

/**
 * The date input keeps its own draft, so what the user is typing is never written back mid-edit (a
 * controlled input that skips "0002-01-01" resets the browser's year buffer, and the year can't be typed).
 * Only a complete real date with a 4-digit year reaches the scenario.
 */
export function DateField({ value, min, max, onCommit }: { value: string; min: string; max: string; onCommit: (date: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    // The scenario changed from outside (URL, normalisation): show it
    setSeen(value);
    setDraft(value);
  }
  return (
    <input
      type="date"
      aria-label="Start date (UTC)"
      min={min}
      max={max}
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (isDate(v) && v >= "1000") onCommit(v);
      }}
      // Leaving the field with a cleared or half-typed date shows the date the scenario really uses
      onBlur={() => setDraft(value)}
      className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
    />
  );
}

export function Pick({ label, items, value, onChange }: { label: string; items: ControlOption[]; value: string; onChange: (v: string) => void }) {
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
  maxDays,
  onChange,
}: {
  scenario: Scenario;
  sites: ControlOption[];
  relays: ControlOption[];
  antennaHeightsM: number[];
  dates: { min: string; max: string };
  /** Whole days the window holds, so the slider never offers a duration that is always out of window */
  maxDays: number;
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
        <DateField
          value={dateOf(scenario.startUtc)}
          min={dates.min}
          max={dates.max}
          onCommit={(d) => onChange({ ...scenario, startUtc: `${d}T00:00:00Z` })}
        />
      </Field>
      <Field label={`Duration: ${scenario.durationDays} ${scenario.durationDays === 1 ? "day" : "days"}`}>
        <Slider
          aria-label="Duration in days"
          min={MIN_DAYS}
          max={Math.max(MIN_DAYS + 1, maxDays)}
          // A window of a single day leaves nothing to choose (and min = max would break the slider)
          disabled={maxDays <= MIN_DAYS}
          value={[scenario.durationDays]}
          onValueChange={(v) => onChange({ ...scenario, durationDays: first(v) })}
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
