"use client";

type Cell = { reference: string; hypothesis: string; count: number };

export default function ConfusionHeatmap({
  referenceCodes,
  hypothesisCodes,
  referenceLabels,
  hypothesisLabels,
  cells,
}: {
  referenceCodes: string[];
  hypothesisCodes: string[];
  referenceLabels: string[];
  hypothesisLabels: string[];
  cells: Cell[];
}) {
  if (referenceCodes.length === 0 || hypothesisCodes.length === 0) {
    return <p className="text-sm text-muted">Not enough substitution errors yet to build a heatmap.</p>;
  }

  const max = Math.max(...cells.map((c) => c.count), 1);
  const grid = new Map<string, number>();
  cells.forEach((c) => grid.set(`${c.reference}|${c.hypothesis}`, c.count));

  function intensity(count: number) {
    if (count === 0) return 0;
    return 0.15 + (count / max) * 0.85;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="p-1 text-right align-bottom text-muted">heard as →<br />actually said ↓</th>
            {hypothesisLabels.map((label) => (
              <th key={label} className="w-10 p-1 text-center align-bottom text-muted">
                <span className="inline-block -rotate-45 whitespace-nowrap">{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {referenceLabels.map((refLabel, ri) => (
            <tr key={refLabel}>
              <td className="p-1 text-right text-muted">{refLabel}</td>
              {hypothesisLabels.map((hypLabel, hi) => {
                const count = grid.get(`${referenceCodes[ri]}|${hypothesisCodes[hi]}`) ?? 0;
                const alpha = intensity(count);
                return (
                  <td key={hi} className="p-0">
                    <div
                      title={`${refLabel} → ${hypLabel}: ${count}×`}
                      className="flex h-8 w-10 items-center justify-center rounded-sm text-[10px] tabular-nums"
                      style={{
                        backgroundColor: count > 0 ? `color-mix(in oklch, var(--accent), transparent ${100 - alpha * 100}%)` : "transparent",
                        border: "1px solid var(--border)",
                        color: alpha > 0.5 ? "var(--on-accent)" : "var(--muted)",
                      }}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
