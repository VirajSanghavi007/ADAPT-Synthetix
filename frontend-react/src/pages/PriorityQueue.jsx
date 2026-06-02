import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ListOrdered, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getPriorityQueue } from '@/lib/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

function PriorityBar({ value }) {
  const max = 2.5
  const pct = Math.min(100, (value / max) * 100)
  const c   = pct > 60 ? C.red : pct > 30 ? C.amber : C.green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden', maxWidth: 110 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', background: c, borderRadius: 3, boxShadow: `0 0 5px ${c}77` }}
        />
      </div>
      <span style={{ fontSize: 9, color: C.textSecondary, minWidth: 30 }}>{value.toFixed(3)}</span>
    </div>
  )
}

function DomainPills({ matches }) {
  if (!matches) return null
  const terms    = matches.split(',').map((s) => s.trim()).filter(Boolean)
  const medical  = terms.some((t) => ['patient','cardiac','dosage','medication','hospital','seizure'].includes(t))
  const emergency= terms.some((t) => ['help','fire','ambulance','danger','emergency','rescue'].includes(t))
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {emergency && <Badge label="emergency" preset="emergency" />}
      {medical   && <Badge label="medical"   preset="medical" />}
      {terms.slice(0, 2).map((t) => (
        <span key={t} style={{ fontSize: 8, color: C.textMuted, padding: '1px 4px', background: C.surfaceAlt, borderRadius: 2 }}>{t}</span>
      ))}
    </div>
  )
}

export default function PriorityQueue() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['priority_queue'], queryFn: getPriorityQueue, refetchInterval: 8_000 })

  const stats = data?.stats || {}
  const queue = data?.queue || []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard label="Pending"    value={stats.pending    ?? 0} accent={C.amber} icon={<Clock size={14} />} />
        <StatCard label="Processing" value={stats.processing ?? 0} accent={C.cyan}  icon={<ListOrdered size={14} />} />
        <StatCard label="Completed"  value={stats.completed  ?? 0} accent={C.green} icon={<CheckCircle size={14} />} />
        <StatCard label="Avg Priority" value={stats.avg_priority?.toFixed(3) ?? '—'} sub="0–2.5 scale" accent={C.purple} icon={<AlertTriangle size={14} />} />
      </div>

      {/* Queue table */}
      <Card>
        <CardHeader title="Remediation Queue" subtitle={`${stats.total ?? 0} items · sorted by final priority`}
          right={<button onClick={refetch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 9, fontFamily: 'inherit', letterSpacing: '0.08em' }}>↺ refresh</button>}
        />
        {isLoading ? (
          <LoadingOverlay />
        ) : !queue.length ? (
          <EmptyState icon={<ListOrdered size={28} />} title="Queue is empty" sub="Transcriptions with errors will appear here" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderBright}` }}>
                  {['#','Transcription','Error','Priority Score','Domain','Status','Age'].map((h) => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((item, i) => (
                  <motion.tr key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                    style={{ borderBottom: `1px solid ${C.border}`, background: item.status === 'completed' ? 'rgba(57,255,20,0.02)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', color: C.textMuted, fontSize: 8 }}>#{item.id}</td>
                    <td style={{ padding: '9px 12px', maxWidth: 200 }}>
                      <div className="truncate" style={{ color: C.textPrimary }}>{item.transcription}</div>
                    </td>
                    <td style={{ padding: '9px 12px' }}><Badge preset={item.error_type} label={item.error_type || 'unknown'} /></td>
                    <td style={{ padding: '9px 12px', minWidth: 150 }}>
                      <PriorityBar value={item.final_priority} />
                      <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>
                        base {item.base_confidence?.toFixed(2)} × {item.domain_multiplier?.toFixed(1)}× domain
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px' }}><DomainPills matches={item.domain_matches} /></td>
                    <td style={{ padding: '9px 12px' }}><Badge preset={item.status} label={item.status} dot /></td>
                    <td style={{ padding: '9px 12px', fontSize: 9, color: C.textMuted, whiteSpace: 'nowrap' }}>
                      {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Formula explanation */}
      <Card>
        <CardHeader title="Priority Formula" subtitle="nonconformity × domain × error-type — research basis: Ernez et al. PMLR 2023 + DyPCL" />
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ padding: '12px 14px', background: C.surfaceAlt, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 10, lineHeight: 2.2 }}>
              <div style={{ color: C.cyan }}>base = 1 − confidence_score</div>
              <div style={{ color: C.purple }}>domain_mult = 1 + (0.5 × |vocab_matches|)</div>
              <div style={{ color: C.amber }}>error_mult  = noise:1.2×  accent:1.1×  pronun:1.0×</div>
              <div style={{ color: C.green, fontWeight: 700 }}>final = base × domain_mult × error_mult</div>
            </div>
            <div style={{ fontSize: 10, color: C.textSecondary }}>
              <div style={{ marginBottom: 8 }}>NCS (nonconformity score) = 1 − confidence maps directly to conformal prediction priority (Ernez et al. 2023).</div>
              <div>Domain multiplier boosts medical/emergency vocabulary per ADAPT-Synthetix closed-loop feedback design.</div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
