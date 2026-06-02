import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getRemediationStatus } from '@/lib/api'
import { C } from '@/lib/theme'
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner'
import { AlertCircle } from 'lucide-react'

export function ErrorTypePie() {
  const { data, isLoading } = useQuery({ queryKey: ['remediation_status'], queryFn: getRemediationStatus, refetchInterval: 15_000 })

  if (isLoading) return <LoadingOverlay />
  const total = data?.total_transcriptions || 0
  if (!total) return <EmptyState icon={<AlertCircle size={28} />} title="No data yet" />

  const chartData = [
    { name: 'Clean',      value: data.clean       || 0, color: C.green },
    { name: 'Remediated', value: data.remediated  || 0, color: C.cyan  },
    { name: 'Pending',    value: data.pending_remediation || 0, color: C.amber },
  ].filter((d) => d.value > 0)

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>{total}</span>
        <span style={{ fontSize: 9, color: C.textMuted, marginLeft: 5 }}>total</span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
            {chartData.map((e) => <Cell key={e.name} fill={e.color} stroke="none" />)}
          </Pie>
          <Tooltip
            formatter={(v, n) => [`${v} (${((v / total) * 100).toFixed(1)}%)`, n]}
            contentStyle={{ background: '#1a1a1a', border: `1px solid ${C.borderBright}`, borderRadius: 6, fontSize: 10 }}
          />
          <Legend iconSize={7} iconType="circle" formatter={(v) => <span style={{ fontSize: 9, color: C.textSecondary }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', fontSize: 10, color: C.textSecondary }}>
        Remediation rate: <span style={{ color: C.cyan, fontWeight: 600 }}>{data.remediation_rate?.toFixed(1)}%</span>
      </div>
    </>
  )
}
