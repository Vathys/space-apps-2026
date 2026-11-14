const SIDES = ["Direct only", "Relay-assisted"];

export function Comparison() {
  return (
    <section aria-label="Direct versus relay" className="grid gap-3 sm:grid-cols-2">
      {SIDES.map((name) => (
        <div key={name} className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{name}</h2>
          <p className="mt-3 text-sm text-muted-foreground">Coverage: not available</p>
          <p className="text-sm text-muted-foreground">Longest blackout: not available</p>
        </div>
      ))}
    </section>
  );
}
