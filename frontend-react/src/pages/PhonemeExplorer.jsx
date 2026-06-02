import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap } from 'lucide-react'
import { getDriftReport, getPhonemeErrorReport } from '@/lib/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { ConfusionMatrix } from '@/components/charts/PhonemeHeatmap'
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

const TREND_ICON = {
  degrading: <TrendingDown size={11} style={{ color: C.red }} />,
  improving: <TrendingUp  size={11} style={{ color: C.green }} />,
  stable:    <Minus       size={11} style={{ color: C.textMuted }} />,
}

function PhonemeRow({ p, i }) {
  const c = p.trend === 'degrading' ? C.red : p.trend === 'improving' ? C.green : C.textMuted
  return (
    <motion.tr initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.018 }}
      style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '8px 16px', fontWeight: 700, color: c, fontSize: 12, letterSpacing: '0.05em' }}>/{p.phoneme}/</td>
      <td style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ height: 4, width: 100, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p.avg_confidence * 100}%`, background: p.avg_confidence > 0.7 ? C.green : p.avg_confidence > 0.4 ? C.amber : C.red, borderRadius: 2, transition: 'width 0.6s' }} />
          </div>
          <span style={{ fontSize: 10, color: C.textSecondary, minWidth: 34 }}>{(p.avg_confidence * 100).toFixed(1)}%</span>
        </div>
        {p.cusum > 0 && <div style={{ fontSize: 8, color: C.red, marginTop: 2 }}>CUSUM ∑{p.cusum?.toFixed(3)}</div>}
      </td>
      <td style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {TREND_ICON[p.trend] || TREND_ICON.stable}
          <Badge preset={p.trend} label={p.trend} />
        </div>
      </td>
      <td style={{ padding: '8px 16px', fontSize: 10, color: C.textMuted }}>{p.sample_count}</td>
    </motion.tr>
  )
}

export default function PhonemeExplorer() {
  const [filter, setFilter] = useState('all')

  const { data: drift, isLoading }  = useQuery({ queryKey: ['drift_report'],        queryFn: getDriftReport,        refetchInterval: 15_000 })
  const { data: errorReport }       = useQuery({ queryKey: ['phoneme_error_report'], queryFn: getPhonemeErrorReport, refetchInterval: 20_000 })

  if (isLoading) return <LoadingOverlay message="Loading phoneme data…" />

  const all = [...(drift?.degrading||[]), ...(drift?.stable||[]), ...(drift?.improving||[])]
  const filtered = filter === 'all' ? all : all.filter((p) => p.trend === filter)
  const highRisk = drift?.high_risk_phonemes || []
  const systematic = errorReport?.systematic_confusions || []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard label="Tracked" value={drift?.total_phonemes_tracked ?? '—'} accent={C.cyan} icon={<Zap size={14} />} />
        <StatCard label="Degrading" value={drift?.degrading?.length ?? 0} accent={C.red} icon={<TrendingDown size={14} />} />
        <StatCard label="Improving" value={drift?.improving?.length ?? 0} accent={C.green} icon={<TrendingUp size={14} />} />
        <StatCard label="High Risk" value={highRisk.length} sub={highRisk.length >= 5 ? '⚠ retraining triggered' : 'below threshold'} accent={highRisk.length > 0 ? C.red : C.textMuted} icon={<AlertTriangle size={14} />} />
      </div>

      {/* Drift alert */}
      {highRisk.length >= 5 && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div style={{
            padding: '10px 18px', background: C.redGlow,
            border: `1px solid ${C.red}33`, borderLeft: `3px solid ${C.red}`,
            borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.textPrimary,
          }}>
            <AlertTriangle size={14} color={C.red} />
            <span>
              <strong style={{ color: C.red }}>Drift threshold exceeded</strong> — {highRisk.length} high-risk phonemes ({highRisk.join(', ')}).
              CUSUM signal: LoRA fine-tuning recommended.
            </span>
          </div>
        </motion.div>
      )}

      {/* Systematic confusions alert */}
      {systematic.length > 0 && (
        <div style={{
          padding: '10px 18px', background: C.amberGlow,
          border: `1px solid ${C.amber}33`, borderLeft: `3px solid ${C.amber}`,
          borderRadius: 7, fontSize: 11, color: C.textPrimary,
        }}>
          <strong style={{ color: C.amber }}>Systematic confusions detected</strong> (≥30% rate, DyPCL/POWER rule):&nbsp;
          {systematic.slice(0, 5).map((e) => `/${e.reference_phoneme}/→/${e.hypothesis_phoneme}/ (${(e.confusion_rate * 100).toFixed(0)}%)`).join(', ')}
        </div>
      )}

      {/* Drift table */}
      <Card>
        <CardHeader title="Phoneme Confidence Drift" subtitle="CUSUM + slope · 5-window · basis: utterance_confidence"
          right={
            <div style={{ display: 'flex', gap: 5 }}>
              {['all','degrading','stable','improving'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '2px 8px', borderRadius: 3,
                  border: `1px solid ${filter === f ? C.cyan : C.border}`,
                  background: filter === f ? C.cyanGlow : 'transparent',
                  color: filter === f ? C.cyan : C.textMuted,
                  fontSize: 8, cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>{f}</button>
              ))}
            </div>
          }
        />
        {!filtered.length ? (
          <EmptyState icon={<Zap size={28} />} title="No phoneme data yet" sub="Transcribe with reference transcripts to see drift" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderBright}` }}>
                {['Phoneme','Avg Confidence','Trend','Samples'].map((h) => (
                  <th key={h} style={{ padding: '7px 16px', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => <PhonemeRow key={p.phoneme} p={p} i={i} />)}
            </tbody>
          </table>
        )}
      </Card>

      {/* Confusion matrix */}
      {errorReport?.top_errors?.length > 0 && (
        <Card>
          <CardHeader title="Substitution Confusion Matrix" subtitle="DyPCL research basis — systematic pairs highlighted in red" />
          <CardBody><ConfusionMatrix errors={errorReport.top_errors} /></CardBody>
        </Card>
      )}
    </div>
  )
}
