import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { Mic, AlertTriangle, TrendingDown, CheckCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getSessions, getRemediationStatus, getDriftReport,
  getPriorityQueue, getConfidenceHistogram, SESSIONS_LIMIT,
} from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ErrorTypePie } from '@/components/charts/ErrorTypePie'
import { ConfidenceHistogram } from '@/components/charts/ConfidenceHistogram'
import { C } from '@/lib/theme'
import { useUIStore } from '@/store'

export default function Dashboard() {
  const lastResult = useUIStore((s) => s.lastResult)

  // One query per endpoint — all with canonical keys
  const { data: sessions }  = useQuery({ queryKey: ['sessions', SESSIONS_LIMIT], queryFn: getSessions,          refetchInterval: 12_000 })
  const { data: remStat }   = useQuery({ queryKey: ['remediation_status'],        queryFn: getRemediationStatus, refetchInterval: 15_000 })
  const { data: drift }     = useQuery({ queryKey: ['drift_report'],               queryFn: getDriftReport,       refetchInterval: 20_000 })
  const { data: queue }     = useQuery({ queryKey: ['priority_queue'],             queryFn: getPriorityQueue,     refetchInterval: 20_000 })
  const { data: histogram } = useQuery({ queryKey: ['confidence_histogram', 18],   queryFn: () => getConfidenceHistogram({}, 18), refetchInterval: 30_000 })

  // Slice client-side — no extra network request
  const recentSessions = useMemo(() => (sessions || []).slice(0, 7), [sessions])
  const highRisk = drift?.high_risk_phonemes?.length ?? 0
  const pending  = queue?.stats?.pending ?? 0

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard label="Total Transcriptions" value={remStat?.total_transcriptions ?? '—'} sub="all sessions" accent={C.teal} icon={<Mic size={15} />} />
        <StatCard label="Remediation Rate" value={remStat?.remediation_rate != null ? `${remStat.remediation_rate.toFixed(1)}%` : '—'} sub={`${remStat?.remediated ?? 0} remediated`} accent={C.forest} icon={<CheckCircle size={15} />} />
        <StatCard label="High-Risk Phonemes" value={highRisk} sub="CUSUM degrading" accent={highRisk > 0 ? C.clay : C.textMuted} icon={<TrendingDown size={15} />} />
        <StatCard label="Queue Pending" value={pending} sub={`${queue?.stats?.completed ?? 0} completed`} accent={pending > 0 ? C.amber : C.textMuted} icon={<AlertTriangle size={15} />} />
      </div>

      {/* Charts — data passed as props, no duplicate query */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>
        <Card><CardHeader title="Error Distribution" /><CardBody><ErrorTypePie data={remStat} /></CardBody></Card>
        <Card><CardHeader title="Confidence Histogram" subtitle="phoneme-level · 0.5 threshold" /><CardBody><ConfidenceHistogram data={histogram} /></CardBody></Card>
      </div>

      {/* Bottom */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Recent sessions */}
        <Card>
          <CardHeader title="Recent Sessions" right={
            <Link to="/history" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>
              All <ArrowRight size={9} />
            </Link>
          } />
          <CardBody style={{ padding: 0 }}>
            {recentSessions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: i < recentSessions.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <Badge preset={s.error_type || 'clean'} label={s.error_type || 'clean'} dot />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="truncate" style={{ fontSize: 11, color: C.textPrimary }}>{s.transcription || '—'}</div>
                  <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>
                    {s.timestamp ? formatDistanceToNow(new Date(s.timestamp), { addSuffix: true }) : ''}
                    {s.confidence_score != null ? ` · ${(s.confidence_score * 100).toFixed(0)}% conf` : ''}
                    {s.snr_db != null ? ` · ${s.snr_db.toFixed(0)} dB` : ''}
                  </div>
                </div>
                {s.cer_score != null && (
                  <span style={{ fontSize: 8, color: s.cer_score < 0.1 ? C.forest : C.amber }}>
                    CER {(s.cer_score * 100).toFixed(0)}%
                  </span>
                )}
              </motion.div>
            ))}
            {!sessions?.length && <div style={{ padding: 32, textAlign: 'center', fontSize: 11, color: C.textMuted }}>No sessions yet</div>}
          </CardBody>
        </Card>

        {/* Drift monitor */}
        <Card>
          <CardHeader title="Drift Monitor" subtitle={`${drift?.total_phonemes_tracked ?? 0} phonemes · CUSUM`}
            right={<Link to="/phonemes" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>Explorer <ArrowRight size={9} /></Link>}
          />
          <CardBody style={{ padding: 0 }}>
            {(drift?.degrading || []).slice(0, 6).map((p, i) => (
              <div key={p.phoneme} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: i < 5 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: C.clay, minWidth: 32, textAlign: 'right' }}>{p.phoneme}</span>
                <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${(p.avg_confidence * 100).toFixed(0)}%`, background: p.avg_confidence > 0.5 ? C.amber : C.clay, borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 9, color: C.textSecondary, minWidth: 34, textAlign: 'right' }}>{(p.avg_confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
            {!drift?.degrading?.length && <div style={{ padding: 32, textAlign: 'center', fontSize: 11, color: C.forest }}>✓ No degrading phonemes</div>}
          </CardBody>
        </Card>
      </div>

      {/* Last result */}
      {lastResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card glow={C.teal}>
            <CardHeader title="Last Transcription" subtitle="this session" accent={C.teal} />
            <CardBody>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: C.textPrimary, marginBottom: 8, lineHeight: 1.6 }}>"{lastResult.transcription}"</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 9, color: C.textMuted, flexWrap: 'wrap' }}>
                    <span>Conf: <span style={{ color: C.teal }}>{(lastResult.confidence * 100).toFixed(1)}%</span></span>
                    {lastResult.cer_score  != null && <span>CER: <span style={{ color: C.amber }}>{(lastResult.cer_score  * 100).toFixed(1)}%</span></span>}
                    {lastResult.wer_score  != null && <span>WER: <span style={{ color: C.amber }}>{(lastResult.wer_score  * 100).toFixed(1)}%</span></span>}
                    {lastResult.snr_db     != null && <span>SNR: <span style={{ color: C.textSecondary }}>{lastResult.snr_db.toFixed(1)} dB</span></span>}
                    <span>Uncertain: <span style={{ color: C.textSecondary }}>{lastResult.uncertain_frames}/{lastResult.total_frames} frames</span></span>
                  </div>
                </div>
                <Badge preset={lastResult.error_type} label={lastResult.error_type} />
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
