import { memo, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { C } from '@/lib/theme'
import { EmptyState } from '@/components/ui/Spinner'
import { Activity } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a2232', border: `1px solid ${C.borderBright}`, borderRadius: 6, padding: '7px 12px', fontSize: 10 }}>
      <div style={{ color: C.textSecondary }}>conf ≥ {label}</div>
      <div style={{ color: C.teal, fontWeight: 600 }}>{payload[0].value} samples</div>
    </div>
  )
}

// Accepts data as prop — parent owns the query, no duplicate subscription
export const ConfidenceHistogram = memo(function ConfidenceHistogram({ data }) {
  const chartData = useMemo(() => {
    if (!data?.bins?.length) return []
    return data.bins.map((bin, i) => ({
      name:  bin.toFixed(2),
      count: data.counts?.[i] ?? 0,
    }))
  }, [data?.bins, data?.counts])

  const maxCount = useMemo(
    () => Math.max(...chartData.map((d) => d.count), 1),
    [chartData],
  )

  if (!data?.total_samples)
    return <EmptyState icon={<Activity size={28} />} title="No confidence data yet" sub="Start transcribing" />

  return (
    <>
      <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 8, textAlign: 'right' }}>
        {data.total_samples} samples
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} barCategoryGap="8%">
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: C.textMuted }} axisLine={{ stroke: C.border }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: C.textMuted }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: C.border + '55' }} />
          <ReferenceLine x="0.50" stroke={C.amber + '55'} strokeDasharray="4 2" />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={24}>
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={parseFloat(entry.name) >= 0.5 ? C.teal : C.clay}
                opacity={0.55 + 0.45 * (entry.count / maxCount)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  )
})
