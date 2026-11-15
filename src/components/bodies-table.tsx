import type { SkyBody } from "@/lib/lunanav/sky";

/** Where everything is in the lander's sky at the replay time: the file values the 3D views draw (§5: same numbers beside the scene). */
export function BodiesTable({ bodies, atUtc }: { bodies: SkyBody[]; atUtc: string | null }) {
  return (
    <div className="min-w-0 overflow-auto">
      <table className="w-full font-mono text-xs">
        <caption className="pb-1 text-left font-sans text-muted-foreground">
          {atUtc ? `At ${atUtc.slice(0, 16).replace("T", " ")} UTC` : "Sky"} (file values)
        </caption>
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 pr-2 font-normal">Body</th>
            <th className="py-1 pr-2 text-right font-normal">Az °</th>
            <th className="py-1 pr-2 text-right font-normal">El °</th>
            <th className="py-1 text-right font-normal">Range km</th>
          </tr>
        </thead>
        <tbody>
          {bodies.map((b) => (
            <tr key={b.id} className="border-t border-border/60">
              <td className="py-1 pr-2">
                {b.label}
                {b.seesEarth !== null && <span className="text-muted-foreground">{b.seesEarth ? " · sees Earth" : " · no Earth"}</span>}
              </td>
              <td className="py-1 pr-2 text-right">{b.azimuthDeg.toFixed(1)}</td>
              <td className="py-1 pr-2 text-right">{b.elevationDeg.toFixed(1)}</td>
              <td className="py-1 text-right">{b.rangeKm === null ? "-" : Math.round(b.rangeKm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
