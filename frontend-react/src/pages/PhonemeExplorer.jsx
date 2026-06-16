import { useState, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { getDriftReport, getPhonemeErrorReport } from '@/lib/api'
import { ConfusionMatrix } from '@/components/charts/PhonemeHeatmap'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'
import { motion } from 'framer-motion'

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 14 }}>{children}</div>
}

const TREND_ICON = {
  degrading: <TrendingDown size={10} color={C.red} />,
  improving: <TrendingUp  size={10} color={C.green} />,
  stable:    <Minus       size={10} color={C.textMuted} />,
}
const TREND_COLOR = { degrading: C.red, improving: C.green, stable: C.textMuted }

const PhonemeRow = memo(function PhonemeRow({ p, i }) {
  const c = TREND_COLOR[p.trend] || C.textMuted
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: i * 0.015 }}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}
    >
      <span style={{ fontWeight: 700, fontSize: 12, color: c, minWidth: 40, textAlign: 'right', letterSpacing: '0.04em' }}>
        /{p.phoneme}/
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(p.avg_confidence * 100).toFixed(0)}%`, background: p.avg_confidence > 0.7 ? C.green : p.avg_confidence > 0.4 ? C.amber : C.red, borderRadius: 2 }} />
        </div>
        {p.cusum > 0 && <div style={{ fontSize: 8, color: C.clay, marginTop: 2 }}>CUSUM ∑{p.cusum?.toFixed(3)}</div>}
      </div>
      <span style={{ fontSize: 10, color: C.textSecondary, minWidth: 32, textAlign: 'right' }}>
        {(p.avg_confidence * 100).toFixed(0)}%
      </span>
      <span style={{ display: 'flex', alignItems: 'center', minWidth: 16 }}>
        {TREND_ICON[p.trend] || TREND_ICON.stable}
      </span>
      <span style={{ fontSize: 9, color: C.textMuted, minWidth: 24, textAlign: 'right' }}>
        {p.sample_count}
      </span>
    </motion.div>
  )
})

export default function PhonemeExplorer() {
  const [filter, setFilter] = useState('all')

  const { data: drift, isLoading } = useQuery({ queryKey: ['drift_report'],        queryFn: getDriftReport,        refetchInterval: 15_000 })
  const { data: errorReport }      = useQuery({ queryKey: ['phoneme_error_report'], queryFn: getPhonemeErrorReport, refetchInterval: 20_000 })

  if (isLoading) return <LoadingOverlay message="Loading phoneme data…" />

  const all = [...(drift?.degrading || []), ...(drift?.stable || []), ...(drift?.improving || [])]
  const filtered = filter === 'all' ? all : all.filter((p) => p.trend === filter)
  const highRisk = drift?.high_risk_phonemes || []
  const systematic = errorReport?.systematic_confusions || []

  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: 1000 }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 28 }}>
        {[
          { label: 'Tracked phonemes', value: drift?.total_phonemes_tracked ?? '—', accent: C.textPrimary },
          { label: 'Degrading',        value: drift?.degrading?.length ?? 0,         accent: C.red },
          { label: 'Improving',        value: drift?.improving?.length ?? 0,         accent: C.green },
          { label: 'High risk',        value: highRisk.length,                       accent: highRisk.length > 0 ? C.red : C.textMuted },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '0 28px 0 0', borderRight: i < 3 ? `1px solid ${C.border}` : 'none', marginRight: i < 3 ? 28 : 0 }}>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {highRisk.length >= 5 && (
        <div style={{ padding: '12px 16px', background: C.redDim, borderLeft: `3px solid ${C.red}`, borderRadius: 4, display: 'flex', gap: 10, fontSize: 11, color: C.textPrimary }}>
          <AlertTriangle size={14} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong style={{ color: C.red }}>Retraining recommended</strong> — {highRisk.length} high-risk phonemes detected ({highRisk.join(', ')})
          </span>
        </div>
      )}
      {systematic.length > 0 && (
        <div style={{ padding: '10px 16px', background: C.amberDim, borderLeft: `3px solid ${C.amber}`, borderRadius: 4, fontSize: 11, color: C.textPrimary }}>
          <strong style={{ color: C.amber }}>Systematic confusions</strong> (≥30%):&nbsp;
          {systematic.slice(0, 4).map((e) => `/${e.reference_phoneme}/→/${e.hypothesis_phoneme}/`).join(' · ')}
        </div>
      )}

      {/* Phoneme table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Label>Phoneme confidence drift</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'degrading', 'stable', 'improving'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '3px 10px', borderRadius: 4, fontFamily: 'inherit',
                border: `1px solid ${filter === f ? C.blue : C.border}`,
                background: filter === f ? C.blueDim : 'transparent',
                color: filter === f ? C.blue : C.textMuted,
                fontSize: 9, cursor: 'pointer', letterSpacing: '0.06em',
              }}>{f}</button>
            ))}
          </div>
        </div>

        {!filtered.length ? (
          <div style={{ fontSize: 11, color: C.textMuted, padding: '20px 0' }}>
            No phoneme data yet — transcribe with reference text to see drift analysis
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 14, padding: '0 0 8px', borderBottom: `1px solid ${C.border}` }}>
              {['Phoneme', 'Confidence', '', '%', 'Trend', 'n'].map((h, i) => (
                <div key={i} style={{ fontSize: 8, color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase',
                  minWidth: i === 0 ? 40 : i === 1 ? undefined : i === 4 ? 16 : i === 5 ? 24 : 32,
                  flex: i === 1 ? 1 : undefined, textAlign: i >= 2 ? 'right' : 'left',
                }}>{h}</div>
              ))}
            </div>
            {filtered.map((p, i) => <PhonemeRow key={p.phoneme} p={p} i={i} />)}
          </div>
        )}
      </div>

      {/* Confusion matrix */}
      {errorReport?.top_errors?.length > 0 && (
        <div>
          <Label>Substitution confusion matrix</Label>
          <ConfusionMatrix errors={errorReport.top_errors} />
        </div>
      )}
    </div>
  )
}
