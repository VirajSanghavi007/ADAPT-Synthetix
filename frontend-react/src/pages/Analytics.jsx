import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { format } from 'date-fns'
import {
  getSessions, getPhonemeErrorReport, getNoiseReport, getRemediationStatus,
  getCalibrationMetrics, getConfidenceHistogram, SESSIONS_LIMIT,
} from '@/lib/api'
import { ConfidenceHistogram } from '@/components/charts/ConfidenceHistogram'
import { NoiseBreakdown } from '@/components/charts/NoiseBreakdown'
import { ErrorTypePie } from '@/components/charts/ErrorTypePie'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { C } from '@/lib/theme'

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 12 }}>{children}</div>
}

function InlineStat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || C.textPrimary, lineHeight: 1, letterSpacing: '-0.02em' }}>{value ?? '—'}</div>
    </div>
  )
}

const CERTrend = memo(function CERTrend({ sessions }) {
  const data = useMemo(() =>
    (sessions || []).filter((s) => s.cer_score != null && s.timestamp).slice(-50).map((s) => ({
      t:    format(new Date(s.timestamp), 'HH:mm'),
      cer:  parseFloat((s.cer_score * 100).toFixed(2)),
      wer:  s.wer_score != null ? parseFloat((s.wer_score * 100).toFixed(2)) : null,
      conf: parseFloat(((s.confidence_score ?? 0) * 100).toFixed(1)),
    })),
    [sessions],
  )

  if (!data.length) return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', fontSize: 11, color: C.textMuted }}>
      No reference-aligned sessions yet
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="t" tick={{ fontSize: 8, fill: C.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 8, fill: C.textMuted }} axisLine={false} tickLine={false} width={24} />
        <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.borderBright}`, borderRadius: 6, fontSize: 10 }} />
        <Legend formatter={(v) => <span style={{ fontSize: 10, color: C.textSecondary }}>{v}</span>} />
        <ReferenceLine y={10} stroke={C.amber + '44'} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="cer"  name="CER %"  stroke={C.red}   strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="wer"  name="WER %"  stroke={C.amber} strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="conf" name="Conf %"  stroke={C.blue}  strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
})

const PhonemeErrorTable = memo(function PhonemeErrorTable({ errors }) {
  if (!errors?.length) return <div style={{ fontSize: 11, color: C.textMuted, padding: '12px 0' }}>No phoneme error data</div>
  const opC = { substitution: C.red, deletion: C.amber, insertion: C.purple }
  return (
    <div style={{ overflowY: 'auto', maxHeight: 260 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Operation', 'Reference', 'Hypothesis', 'Count'].map((h) => (
              <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {errors.slice(0, 25).map((e, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '7px 0', color: opC[e.operation] || C.textSecondary, fontSize: 10 }}>{e.operation}</td>
              <td style={{ padding: '7px 0', color: C.textPrimary, fontWeight: 600 }}>{e.reference_phoneme || '∅'}</td>
              <td style={{ padding: '7px 0', color: C.textSecondary }}>{e.hypothesis_phoneme || '∅'}</td>
              <td style={{ padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 2, width: Math.min(48, e.count * 2), background: opC[e.operation] || C.teal, borderRadius: 1, opacity: 0.6 }} />
                  <span style={{ color: C.textMuted, fontSize: 10 }}>{e.count}</span>
                  {e.systematic && <span style={{ fontSize: 7, color: C.clay, fontWeight: 700, letterSpacing: '0.05em' }}>SYS</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

export default function Analytics() {
  const { data: sessions }    = useQuery({ queryKey: ['sessions', SESSIONS_LIMIT], queryFn: getSessions,            refetchInterval: 15_000 })
  const { data: errorReport, isLoading: erLoading } = useQuery({ queryKey: ['phoneme_error_report'], queryFn: getPhonemeErrorReport, refetchInterval: 30_000 })
  const { data: noiseData }   = useQuery({ queryKey: ['noise_report'],             queryFn: getNoiseReport,         refetchInterval: 30_000 })
  const { data: remStat }     = useQuery({ queryKey: ['remediation_status'],       queryFn: getRemediationStatus,   refetchInterval: 15_000 })
  const { data: calibration } = useQuery({ queryKey: ['calibration_metrics'],      queryFn: getCalibrationMetrics,  refetchInterval: 60_000 })
  const { data: histogram }   = useQuery({ queryKey: ['confidence_histogram', 18], queryFn: () => getConfidenceHistogram({}, 18), refetchInterval: 30_000 })

  const { withRef, avgCer, avgConf } = useMemo(() => {
    const wr   = (sessions || []).filter((s) => s.cer_score != null)
    const conf = (sessions || []).filter((s) => s.confidence_score != null)
    return {
      withRef: wr,
      avgCer:  wr.length   ? wr.reduce((a, s) => a + s.cer_score, 0) / wr.length : null,
      avgConf: conf.length ? conf.reduce((a, s) => a + s.confidence_score, 0) / conf.length : null,
    }
  }, [sessions])

  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: 1200 }}>

      {/* Top stats — bare numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 32 }}>
        {[
          { label: 'Avg CER',         value: avgCer  != null ? `${(avgCer  * 100).toFixed(1)}%` : '—', accent: C.amber  },
          { label: 'Avg confidence',  value: avgConf != null ? `${(avgConf * 100).toFixed(1)}%` : '—', accent: C.blue   },
          { label: 'Reference sessions', value: withRef.length, accent: C.textPrimary },
          { label: 'ECE',             value: calibration?.ece != null ? calibration.ece.toFixed(3) : '—', accent: C.purple },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '0 28px 0 0', borderRight: i < 3 ? `1px solid ${C.border}` : 'none', marginRight: i < 3 ? 28 : 0 }}>
            <InlineStat {...s} />
          </div>
        ))}
      </div>

      {/* CER trend */}
      <div>
        <Label>CER · WER · Confidence trend</Label>
        <CERTrend sessions={sessions} />
      </div>

      {/* 3 charts side by side — unequal widths to break symmetry */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 40 }}>
        <div>
          <Label>Confidence distribution</Label>
          <ErrorBoundary><ConfidenceHistogram data={histogram} /></ErrorBoundary>
        </div>
        <div>
          <Label>Noise profile</Label>
          <ErrorBoundary><NoiseBreakdown data={noiseData} /></ErrorBoundary>
        </div>
        <div>
          <Label>Error split</Label>
          <ErrorBoundary><ErrorTypePie data={remStat} /></ErrorBoundary>
        </div>
      </div>

      {/* Calibration */}
      {calibration && (
        <div>
          <Label>Confidence calibration</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {[
              ['ECE', calibration.ece?.toFixed(4), 'lower = better calibrated'],
              ['Overconfidence', calibration.overconfidence_ratio != null ? `${(calibration.overconfidence_ratio * 100).toFixed(1)}%` : '—', 'frames with conf > 0.7'],
              ['Mean confidence', calibration.mean_confidence?.toFixed(4), ''],
              ['Observations', calibration.n_samples, 'phoneme-level'],
            ].map(([k, v, sub]) => (
              <div key={k} style={{ borderTop: `2px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>{v ?? '—'}</div>
                {sub && <div style={{ fontSize: 9, color: C.textDim }}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phoneme errors */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Label>Top phoneme errors</Label>
          {errorReport?.systematic_confusions?.length > 0 && (
            <span style={{ fontSize: 11, color: C.red }}>
              {errorReport.systematic_confusions.length} systematic confusions ≥30%
            </span>
          )}
        </div>
        {erLoading ? <LoadingOverlay /> : <PhonemeErrorTable errors={errorReport?.top_errors} />}
      </div>
    </div>
  )
}
