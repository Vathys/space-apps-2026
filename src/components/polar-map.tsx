"use client";

// 2D map of the sites around the south pole (F17). Positions are index.json lat/lon; the projection is for the picture.
interface MapSite {
  id: string;
  name: string;
  latDeg: number;
  lonEastDeg: number;
}

// Outer ring radius in the 0..100 picture, leaving room for the meridian labels outside it
const R = 40;
const TITLE = "font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase";

/**
 * South-polar azimuthal equidistant view: distance from the centre is the angle from the pole, 0° E at the top and
 * east clockwise (looking down on the south pole). The outer ring adapts to the farthest site.
 */
export function PolarMap({ sites, selectedId, onSelect }: { sites: MapSite[]; selectedId: string; onSelect: (id: string) => void }) {
  const farthestDeg = Math.max(0.25, ...sites.map((s) => 90 + s.latDeg));
  const stepDeg = farthestDeg <= 1 ? 0.25 : farthestDeg <= 2.5 ? 0.5 : 1;
  const spanDeg = Math.ceil((farthestDeg * 1.25) / stepDeg) * stepDeg;
  const rings = Array.from({ length: Math.round(spanDeg / stepDeg) }, (_, k) => (k + 1) * stepDeg);
  const pos = (latDeg: number, lonEastDeg: number) => {
    const r = (90 + latDeg) / spanDeg;
    const a = (lonEastDeg * Math.PI) / 180;
    return { x: 50 + R * r * Math.sin(a), y: 50 - R * r * Math.cos(a) };
  };
  return (
    <section aria-label="Sites around the south pole" className="rounded-sm border border-border bg-card p-4">
      <h2 className={`${TITLE} mb-2`}>South pole · sites</h2>
      <div className="relative mx-auto aspect-square w-full max-w-80">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {rings.map((d) => (
            <g key={d}>
              <circle cx={50} cy={50} r={(R * d) / spanDeg} fill="none" stroke="var(--border)" strokeWidth={0.4} />
              {/* Ring labels on the diagonal, clear of the meridian labels */}
              <text x={50 + ((R * d) / spanDeg) * 0.707 + 0.8} y={50 + ((R * d) / spanDeg) * 0.707 + 0.8} className="fill-muted-foreground font-mono text-[3px]">
                {(-90 + d).toFixed(stepDeg < 1 ? 2 : 0)}°
              </text>
            </g>
          ))}
          {[0, 90, 180, 270].map((lon) => {
            const p = pos(-90 + spanDeg, lon);
            return (
              <g key={lon}>
                <line x1={50} y1={50} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={0.4} />
                <text x={50 + (R + 4) * Math.sin((lon * Math.PI) / 180)} y={50 - (R + 4) * Math.cos((lon * Math.PI) / 180) + 1} textAnchor="middle" className="fill-muted-foreground font-mono text-[3px]">
                  {lon}°E
                </text>
              </g>
            );
          })}
          <circle cx={50} cy={50} r={0.8} fill="var(--muted-foreground)" />
        </svg>
        {sites.map((s) => {
          const p = pos(s.latDeg, s.lonEastDeg);
          const on = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={on}
              aria-label={`${s.name}, ${s.latDeg.toFixed(3)}°, ${s.lonEastDeg.toFixed(2)}° E`}
              className="group absolute grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <span className={`block rounded-full ring-2 ring-[var(--card)] ${on ? "size-3.5 bg-[var(--signal)]" : "size-2.5 bg-muted-foreground group-hover:bg-foreground"}`} />
              <span className={`pointer-events-none absolute top-8 whitespace-nowrap rounded-sm bg-background/90 px-1.5 py-0.5 font-mono text-[10px] ${on ? "text-foreground" : "text-muted-foreground"}`}>{s.name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Rings: latitude. 0° E at the top, east clockwise. Click a site to plan there.</p>
    </section>
  );
}
