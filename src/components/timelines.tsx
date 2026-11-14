const ROWS = ["Earth direct", "Relay", "Connected", "Sunlight"];

export function Timelines() {
  return (
    <section aria-label="Timelines" className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Timelines</h2>
      <div className="flex flex-col gap-2">
        {ROWS.map((name) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">{name}</span>
            <div
              role="img"
              aria-label={`${name}: no data yet`}
              className="h-6 flex-1 rounded border border-dashed border-border bg-background/40"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
