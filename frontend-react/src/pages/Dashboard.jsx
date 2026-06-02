import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getSessions, getRemediationStatus, getDriftReport,
  getPriorityQueue, getConfidenceHistogram, SESSIONS_LIMIT,
} from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { ErrorTypePie } from '@/components/charts/ErrorTypePie'
import { ConfidenceHistogram } from '@/components/charts/ConfidenceHistogram'
import { C } from '@/lib/theme'
import { useUIStore } from '@/store'

// Bare number stat — no card chrome, just typography
function Stat({ label, value, accent, note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: accent || C.textPrimary, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value ?? '—'}
      </div>
      {note && <div style={{ fontSize: 10, color: C.textMuted }}>{note}</div>}
    </div>
  )
}

function Section({ title, link, linkLabel, children, style }) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>{title}</div>
        {link && (
          <Link to={link} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: C.textMuted, textDecoration: 'none' }}>
            {linkLabel || 'View all'} <ArrowRight size={9} />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const lastResult = useUIStore((s) => s.lastResult)

  const { data: sessions }  = useQuery({ queryKey: ['sessions', SESSIONS_LIMIT], queryFn: getSessions,          refetchInterval: 12_000 })
  const { data: remStat }   = useQuery({ queryKey: ['remediation_status'],        queryFn: getRemediationStatus, refetchInterval: 15_000 })
  const { data: drift }     = useQuery({ queryKey: ['drift_report'],               queryFn: getDriftReport,       refetchInterval: 20_000 })
  const { data: queue }     = useQuery({ queryKey: ['priority_queue'],             queryFn: getPriorityQueue,     refetchInterval: 20_000 })
  const { data: histogram } = useQuery({ queryKey: ['confidence_histogram', 18],   queryFn: () => getConfidenceHistogram({}, 18), refetchInterval: 30_000 })

  const recent   = useMemo(() => (sessions || []).slice(0, 8), [sessions])
  const highRisk = drift?.high_risk_phonemes?.length ?? 0
  const pending  = queue?.stats?.pending ?? 0

  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: 1200 }}>

      {/* Stats row — bare numbers, no cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 32 }}>
        {[
          { label: 'Transcriptions', value: remStat?.total_transcriptions ?? '—', accent: C.textPrimary },
          { label: 'Remediation rate', value: remStat?.remediation_rate != null ? `${remStat.remediation_rate.toFixed(1)}%` : '—', accent: C.forest, note: `${remStat?.remediated ?? 0} remediated` },
          { label: 'High-risk phonemes', value: highRisk, accent: highRisk > 0 ? C.clay : C.textMuted, note: highRisk > 0 ? 'CUSUM degrading' : 'all stable' },
          { label: 'Queue pending', value: pending, accent: pending > 0 ? C.amber : C.textMuted, note: `${queue?.stats?.completed ?? 0} completed` },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: '0 28px 0 0',
            borderRight: i < 3 ? `1px solid ${C.border}` : 'none',
            marginRight: i < 3 ? 28 : 0,
          }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Main content — asymmetric: 60/40 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 48 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* Recent sessions — no card, just a list */}
          <Section title="Recent activity" link="/history" linkLabel="All sessions">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.length === 0 && (
                <div style={{ fontSize: 11, color: C.textMuted, padding: '16px 0' }}>No sessions yet</div>
              )}
              {recent.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <Badge preset={s.error_type || 'clean'} label={s.error_type || 'clean'} dot />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 12, color: C.textPrimary }}>
                      {s.transcription || <span style={{ color: C.textMuted }}>—</span>}
                    </div>
                    <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                      {s.timestamp ? formatDistanceToNow(new Date(s.timestamp), { addSuffix: true }) : ''}
                      {s.confidence_score != null ? ` · ${(s.confidence_score * 100).toFixed(0)}% conf` : ''}
                    </div>
                  </div>
                  {s.cer_score != null && (
                    <span style={{ fontSize: 9, color: s.cer_score < 0.1 ? C.forest : C.amber, flexShrink: 0 }}>
                      {(s.cer_score * 100).toFixed(0)}% CER
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Confidence histogram */}
          <Section title="Confidence distribution">
            <ConfidenceHistogram data={histogram} />
          </Section>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* Error split donut */}
          <Section title="Error breakdown">
            <ErrorTypePie data={remStat} />
          </Section>

          {/* Drift — only if there's something degrading */}
          <Section title="Phoneme drift" link="/phonemes" linkLabel="Explorer">
            {drift?.degrading?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {drift.degrading.slice(0, 5).map((p) => (
                  <div key={p.phoneme} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.clay, minWidth: 36, textAlign: 'right', letterSpacing: '0.04em' }}>
                      /{p.phoneme}/
                    </span>
                    <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 2 }}>
                      <div style={{
                        height: '100%',
                        width: `${(p.avg_confidence * 100).toFixed(0)}%`,
                        background: p.avg_confidence > 0.5 ? C.amber : C.clay,
                        borderRadius: 2,
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: C.textMuted, minWidth: 30, textAlign: 'right' }}>
                      {(p.avg_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.forest }}>
                ✓ All phonemes stable
              </div>
            )}
          </Section>

          {/* Last transcription result */}
          {lastResult && (
            <Section title="Last result">
              <div style={{
                padding: '14px 16px',
                background: C.surfaceAlt,
                borderRadius: 8,
                borderLeft: `3px solid ${C.teal}`,
              }}>
                <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, marginBottom: 10 }}>
                  "{lastResult.transcription}"
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 9, color: C.textMuted, flexWrap: 'wrap' }}>
                  <span>{(lastResult.confidence * 100).toFixed(1)}% conf</span>
                  {lastResult.cer_score  != null && <span>CER {(lastResult.cer_score  * 100).toFixed(1)}%</span>}
                  {lastResult.snr_db     != null && <span>{lastResult.snr_db.toFixed(0)} dB</span>}
                  <Badge preset={lastResult.error_type} label={lastResult.error_type} />
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
