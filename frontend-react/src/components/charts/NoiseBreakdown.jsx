import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getNoiseReport } from '@/lib/api'
import { C } from '@/lib/theme'
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner'
import { Wind } from 'lucide-react'

const NOISE_COLOR = { clean: C.green, traffic: C.amber, crowd: C.purple, machinery: C.red, indoor: C.cyan }

export function NoiseBreakdown() {
  const { data, isLoading } = useQuery({ queryKey: ['noise_report'], queryFn: getNoiseReport, refetchInterval: 20_000 })

  if (isLoading) return <LoadingOverlay />
  if (!data?.total_analyzed) return <EmptyState icon={<Wind size={28} />} title="No noise data yet" />

  const chartData = Object.entries(data.breakdown || {}).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

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
          <Tooltip contentStyle={{ background: '#1a1a1a', border: `1px solid ${C.borderBright}`, borderRadius: 6, fontSize: 10 }} />
          <Legend iconSize={7} iconType="circle" formatter={(v) => <span style={{ fontSize: 9, color: C.textSecondary }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, fontSize: 9, color: C.textMuted, marginTop: 6 }}>
        <span>RMS: {data.avg_rms_energy?.toFixed(4)}</span>
        <span>Centroid: {data.avg_spectral_centroid?.toFixed(0)} Hz</span>
      </div>
    </>
  )
}
