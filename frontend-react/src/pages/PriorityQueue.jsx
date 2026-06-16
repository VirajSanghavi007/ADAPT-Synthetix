import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { getPriorityQueue } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 14 }}>{children}</div>
}

function PriorityBar({ value }) {
  const pct = Math.min(100, (value / 2.5) * 100)
  const c   = pct > 60 ? C.red : pct > 30 ? C.amber : C.green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 2, maxWidth: 100, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
          style={{ height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color: C.textMuted, minWidth: 28 }}>{value.toFixed(2)}</span>
    </div>
  )
}

function DomainPills({ matches }) {
  if (!matches) return null
  const terms    = matches.split(',').map((s) => s.trim()).filter(Boolean)
  const medical  = terms.some((t) => ['patient','cardiac','dosage','medication','hospital'].includes(t))
  const emergency= terms.some((t) => ['help','fire','ambulance','danger','emergency'].includes(t))
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {emergency && <Badge label="emergency" preset="emergency" />}
      {medical   && <Badge label="medical"   preset="medical" />}
      {terms.slice(0, 2).map((t) => (
        <span key={t} style={{ fontSize: 8, color: C.textMuted, padding: '1px 5px', background: C.surfaceAlt, borderRadius: 3 }}>{t}</span>
      ))}
    </div>
  )
}

export default function PriorityQueue() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['priority_queue'], queryFn: getPriorityQueue, refetchInterval: 20_000 })

  const stats = data?.stats || {}
  const queue = data?.queue || []

  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: 1100 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 28 }}>
        {[
          { label: 'Pending',     value: stats.pending    ?? 0, accent: C.amber },
          { label: 'Processing',  value: stats.processing ?? 0, accent: C.blue  },
          { label: 'Completed',   value: stats.completed  ?? 0, accent: C.green },
          { label: 'Avg priority', value: stats.avg_priority?.toFixed(3) ?? '—', accent: C.textPrimary },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '0 28px 0 0', borderRight: i < 3 ? `1px solid ${C.border}` : 'none', marginRight: i < 3 ? 28 : 0 }}>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Label>Remediation queue</Label>
          <button onClick={refetch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 9, fontFamily: 'inherit' }}>
            ↺ refresh
          </button>
        </div>

        {isLoading ? (
          <LoadingOverlay />
        ) : !queue.length ? (
          <div style={{ fontSize: 11, color: C.textMuted, padding: '20px 0' }}>Queue is empty — transcriptions with errors appear here</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['#', 'Transcription', 'Error', 'Priority', 'Domain', 'Status', 'Age'].map((h) => (
                    <th key={h} style={{ padding: '6px 12px 6px 0', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((item, i) => (
                  <motion.tr key={item.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 12px 10px 0', color: C.textDim, fontSize: 9 }}>{item.id}</td>
                    <td style={{ padding: '10px 12px 10px 0', maxWidth: 220 }}>
                      <div className="truncate" style={{ color: C.textPrimary }}>{item.transcription}</div>
                    </td>
                    <td style={{ padding: '10px 12px 10px 0' }}><Badge preset={item.error_type} label={item.error_type || '?'} /></td>
                    <td style={{ padding: '10px 12px 10px 0', minWidth: 140 }}>
                      <PriorityBar value={item.final_priority} />
                      <div style={{ fontSize: 8, color: C.textDim, marginTop: 3 }}>
                        {item.base_confidence?.toFixed(2)} × {item.domain_multiplier?.toFixed(1)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px 10px 0' }}><DomainPills matches={item.domain_matches} /></td>
                    <td style={{ padding: '10px 12px 10px 0' }}><Badge preset={item.status} label={item.status} dot /></td>
                    <td style={{ padding: '10px 0', fontSize: 9, color: C.textMuted, whiteSpace: 'nowrap' }}>
                      {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formula */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <Label>Priority formula</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div style={{ fontFamily: 'inherit', fontSize: 11, lineHeight: 2.2, color: C.textSecondary }}>
            <div><span style={{ color: C.blue }}>base</span> = 1 − confidence_score</div>
            <div><span style={{ color: C.purple }}>domain</span> = 1 + (0.5 × |vocab_matches|)</div>
            <div><span style={{ color: C.amber }}>error</span> = noise:1.2× · accent:1.1× · pronun:1.0×</div>
            <div style={{ color: C.green, fontWeight: 600 }}>final = base × domain × error</div>
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.8 }}>
            Nonconformity score (1−conf) maps to conformal prediction priority (Ernez et al. PMLR 2023).
            Domain multiplier boosts medical/emergency terms.
          </div>
        </div>
      </div>
    </div>
  )
}
