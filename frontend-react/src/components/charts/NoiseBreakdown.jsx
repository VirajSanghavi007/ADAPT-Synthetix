import { memo, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { C } from '@/lib/theme'
import { EmptyState } from '@/components/ui/Spinner'
import { Wind } from 'lucide-react'

const NOISE_COLOR = { clean: C.forest, traffic: C.amber, crowd: C.lavender, machinery: C.clay, indoor: C.teal }

export const NoiseBreakdown = memo(function NoiseBreakdown({ data }) {
  const chartData = useMemo(
    () => Object.entries(data?.breakdown ?? {}).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
    [data?.breakdown],
  )

  if (!data?.total_analyzed) return <EmptyState icon={<Wind size={28} />} title="No noise data yet" />

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 9, color: C.textMuted }}>
        <span>Dominant: <span style={{ color: C.textSecondary }}>{data.most_common}</span></span>
        <span>n={data.total_analyzed}</span>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={46} outerRadius={74} paddingAngle={3} dataKey="value">
            {chartData.map((entry) => <Cell key={entry.name} fill={NOISE_COLOR[entry.name] || C.textMuted} stroke="none" />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1a2232', border: `1px solid ${C.borderBright}`, borderRadius: 6, fontSize: 10 }} />
          <Legend iconSize={7} iconType="circle" formatter={(v) => <span style={{ fontSize: 9, color: C.textSecondary }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, fontSize: 9, color: C.textMuted, marginTop: 6 }}>
        <span>RMS: {data.avg_rms_energy?.toFixed(4)}</span>
        <span>Centroid: {data.avg_spectral_centroid?.toFixed(0)} Hz</span>
      </div>
    </>
  )
})
