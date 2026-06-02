import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, TrendingUp, Activity, Wind } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { format } from 'date-fns'
import {
  getSessions, getPhonemeErrorReport, getNoiseReport, getRemediationStatus,
  getCalibrationMetrics, getConfidenceHistogram, SESSIONS_LIMIT,
} from '@/lib/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { ConfidenceHistogram } from '@/components/charts/ConfidenceHistogram'
import { NoiseBreakdown } from '@/components/charts/NoiseBreakdown'
import { ErrorTypePie } from '@/components/charts/ErrorTypePie'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

// Memoised — only re-computes when sessions array changes
const CERTrend = memo(function CERTrend({ sessions }) {
  const data = useMemo(() =>
    (sessions || [])
      .filter((s) => s.cer_score != null && s.timestamp)
      .slice(-50)
      .map((s) => ({
        t:    format(new Date(s.timestamp), 'HH:mm'),
        cer:  parseFloat((s.cer_score * 100).toFixed(2)),
        wer:  s.wer_score != null ? parseFloat((s.wer_score * 100).toFixed(2)) : null,
        conf: parseFloat(((s.confidence_score ?? 0) * 100).toFixed(1)),
      })),
    [sessions],
  )

  if (!data.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.textMuted }}>
      No reference-aligned sessions yet
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data}>
        <XAxis dataKey="t" tick={{ fontSize: 8, fill: C.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 8, fill: C.textMuted }} axisLine={false} tickLine={false} width={26} />
        <Tooltip contentStyle={{ background: '#1a2232', border: `1px solid ${C.borderBright}`, borderRadius: 6, fontSize: 10 }} />
        <Legend formatter={(v) => <span style={{ fontSize: 9, color: C.textSecondary }}>{v}</span>} />
        <ReferenceLine y={10} stroke={C.amber + '55'} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="cer"  name="CER %"  stroke={C.clay}   strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="wer"  name="WER %"  stroke={C.amber}  strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="conf" name="Conf %"  stroke={C.teal}  strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
})

const PhonemeErrorTable = memo(function PhonemeErrorTable({ errors }) {
  if (!errors?.length) return <div style={{ padding: 32, textAlign: 'center', fontSize: 10, color: C.textMuted }}>No phoneme error data</div>
  const opC = { substitution: C.clay, deletion: C.amber, insertion: C.lavender }
  return (
    <div style={{ overflowY: 'auto', maxHeight: 260 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Op', 'Reference', 'Hypothesis', 'Count'].map((h) => (
              <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {errors.slice(0, 25).map((e, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '6px 12px', color: opC[e.operation] || C.textSecondary, fontWeight: 600, fontSize: 9 }}>{e.operation}</td>
              <td style={{ padding: '6px 12px', color: C.textPrimary, fontWeight: 600 }}>{e.reference_phoneme || '∅'}</td>
              <td style={{ padding: '6px 12px', color: C.textSecondary }}>{e.hypothesis_phoneme || '∅'}</td>
              <td style={{ padding: '6px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ height: 3, width: Math.min(60, e.count * 2), background: opC[e.operation] || C.teal, borderRadius: 2, opacity: 0.7 }} />
                  <span style={{ color: C.textSecondary }}>{e.count}</span>
                  {e.systematic && <span style={{ fontSize: 7, color: C.clay, fontWeight: 700 }}>SYS</span>}
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
  // All queries owned here — charts receive data as props
  const { data: sessions }    = useQuery({ queryKey: ['sessions', SESSIONS_LIMIT],  queryFn: getSessions,            refetchInterval: 15_000 })
  const { data: errorReport, isLoading: erLoading } = useQuery({ queryKey: ['phoneme_error_report'], queryFn: getPhonemeErrorReport, refetchInterval: 30_000 })
  const { data: noiseData }   = useQuery({ queryKey: ['noise_report'],              queryFn: getNoiseReport,         refetchInterval: 30_000 })
  const { data: remStat }     = useQuery({ queryKey: ['remediation_status'],        queryFn: getRemediationStatus,   refetchInterval: 15_000 })
  const { data: calibration } = useQuery({ queryKey: ['calibration_metrics'],       queryFn: getCalibrationMetrics,  refetchInterval: 60_000 })
  const { data: histogram }   = useQuery({ queryKey: ['confidence_histogram', 18],  queryFn: () => getConfidenceHistogram({}, 18), refetchInterval: 30_000 })

  const { withRef, avgCer, avgConf } = useMemo(() => {
    const wr = (sessions || []).filter((s) => s.cer_score != null)
    return {
      withRef: wr,
      avgCer:  wr.length ? wr.reduce((a, s) => a + s.cer_score, 0) / wr.length : null,
      avgConf: (sessions || []).filter((s) => s.confidence_score != null)
                 .reduce((a, s, _, arr) => a + s.confidence_score / arr.length, 0) || null,
    }
  }, [sessions])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        <StatCard label="Avg CER"      value={avgCer  != null ? `${(avgCer  * 100).toFixed(1)}%` : '—'} accent={C.amber}  icon={<BarChart2 size={14} />} />
        <StatCard label="Avg Conf"     value={avgConf != null ? `${(avgConf * 100).toFixed(1)}%` : '—'} accent={C.teal}   icon={<TrendingUp size={14} />} />
        <StatCard label="Ref Sessions" value={withRef.length} sub="CER-aligned"                          accent={C.lavender} icon={<Activity size={14} />} />
        <StatCard label="ECE"          value={calibration?.ece != null ? calibration.ece.toFixed(3) : '—'} sub="calibration error" accent={C.amber} />
        <StatCard label="Dominant Noise" value={noiseData?.most_common || '—'} sub={`${noiseData?.total_analyzed ?? 0} analyzed`} accent={C.forest} icon={<Wind size={14} />} />
      </div>

      <Card>
        <CardHeader title="Error Rate & Confidence Trend" subtitle="CER / WER / confidence — last 50 reference-aligned sessions" />
        <CardBody><CERTrend sessions={sessions} /></CardBody>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Card><CardHeader title="Confidence Distribution" /><CardBody><ConfidenceHistogram data={histogram} /></CardBody></Card>
        <Card><CardHeader title="Noise Profile" /><CardBody><NoiseBreakdown data={noiseData} /></CardBody></Card>
        <Card><CardHeader title="Error Type Split" /><CardBody><ErrorTypePie data={remStat} /></CardBody></Card>
      </div>

      {calibration && (
        <Card>
          <CardHeader title="Confidence Calibration" subtitle="ECE · Guo et al. 2017" />
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                ['ECE', calibration.ece?.toFixed(4), 'lower = better'],
                ['Overconfidence', calibration.overconfidence_ratio != null ? `${(calibration.overconfidence_ratio * 100).toFixed(1)}%` : '—', 'frames > 0.7 conf'],
                ['Mean Confidence', calibration.mean_confidence?.toFixed(4), 'phoneme-level'],
                ['Samples', calibration.n_samples, 'observations'],
              ].map(([k, v, sub]) => (
                <div key={k} style={{ padding: '10px 12px', background: C.surfaceAlt, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{v ?? '—'}</div>
                  <div style={{ fontSize: 8, color: C.textDim, marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Top Phoneme Errors" subtitle={`${errorReport?.top_errors?.length ?? 0} pairs · SYS = systematic ≥30%`} />
        {erLoading ? <LoadingOverlay /> : <PhonemeErrorTable errors={errorReport?.top_errors} />}
      </Card>
    </div>
  )
}
