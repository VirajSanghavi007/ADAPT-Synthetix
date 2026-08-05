"use client";

// Small dependency-free horizontal bar chart — no charting library is installed,
// and this dataset (a handful of category/count pairs) doesn't need one.
export default function SimpleBarChart({
  data,
  colorClassName = "bg-accent",
}: {
  data: { label: string; value: number }[];
  colorClassName?: string;
}) {
  if (data.length === 0) return <p className="text-sm text-muted">Nothing to show yet.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground">{d.label}</span>
            <span className="tabular-nums text-muted">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${colorClassName}`}
              style={{ width: `${Math.max((d.value / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
