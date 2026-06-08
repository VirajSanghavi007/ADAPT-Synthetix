import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getSessions, getRemediationStatus, getDriftReport,
  getPriorityQueue, getConfidenceHistogram, SESSIONS_LIMIT,
} from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { ErrorTypePie } from '@/components/charts/ErrorTypePie'
import { ConfidenceHistogram } from '@/components/charts/ConfidenceHistogram'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Spinner } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'
import { useSessionStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <Card>
      <CardBody style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.textSecondary }}>{label}</div>
          {Icon && (
            <div style={{ width: 30, height: 30, borderRadius: 6, background: (accent || C.blue) + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={14} color={accent || C.blue} />
            </div>
          )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 6 }}>
          {value ?? '—'}
        </div>
        {sub && <div style={{ fontSize: 12, color: C.textMuted }}>{sub}</div>}
      </CardBody>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { lastResult, visitCount, lastSeen } = useSessionStore()

  const { data: sessions, isLoading: sessL }  = useQuery({ queryKey: ['sessions', SESSIONS_LIMIT], queryFn: getSessions,          refetchInterval: 12_000 })
  const { data: remStat, isLoading: remL }    = useQuery({ queryKey: ['remediation_status'],        queryFn: getRemediationStatus, refetchInterval: 15_000 })
  const { data: drift }                        = useQuery({ queryKey: ['drift_report'],               queryFn: getDriftReport,       refetchInterval: 20_000 })
  const { data: queue }                        = useQuery({ queryKey: ['priority_queue'],             queryFn: getPriorityQueue,     refetchInterval: 20_000 })
  const { data: histogram }                    = useQuery({ queryKey: ['confidence_histogram', 18],   queryFn: () => getConfidenceHistogram({}, 18), refetchInterval: 30_000 })

  const recent   = useMemo(() => (sessions || []).slice(0, 10), [sessions])
  const highRisk = drift?.high_risk_phonemes?.length ?? 0
  const pending  = queue?.stats?.pending ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1100 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, letterSpacing: '-0.01em' }}>
            {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            {visitCount > 1
              ? `Session ${visitCount} · Last seen ${lastSeen ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true }) : 'recently'}`
              : 'Your speech diagnostics workspace.'}
          </p>
        </div>
        {user?.picture && (
          <img src={user.picture} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard
          label="Total transcriptions"
          value={remL ? '…' : (remStat?.total_transcriptions ?? 0)}
          sub={`${remStat?.clean ?? 0} clean`}
          icon={Activity}
          accent={C.blue}
        />
        <StatCard
          label="Remediation rate"
          value={remL ? '…' : remStat?.remediation_rate != null ? `${remStat.remediation_rate.toFixed(1)}%` : '—'}
          sub={`${remStat?.remediated ?? 0} remediated`}
          icon={CheckCircle2}
          accent={C.green}
        />
        <StatCard
          label="High-risk phonemes"
          value={highRisk}
          sub={highRisk > 0 ? 'CUSUM degrading' : 'All stable'}
          icon={AlertTriangle}
          accent={highRisk > 0 ? C.amber : C.textMuted}
        />
        <StatCard
          label="Queue pending"
          value={pending}
          sub={`${queue?.stats?.completed ?? 0} completed`}
          icon={Clock}
          accent={pending > 0 ? C.amber : C.textMuted}
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Recent sessions */}
          <Card>
            <CardHeader
              title="Recent sessions"
              right={
                <Link to="/history" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.blue, textDecoration: 'none' }}>
                  View all <ArrowRight size={12} />
                </Link>
              }
            />
            <div>
              {sessL ? (
                <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
                  <Spinner size={18} />
                </div>
              ) : recent.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: 13, color: C.textMuted }}>
                  No sessions yet. <Link to="/transcribe">Record audio to get started.</Link>
                </div>
              ) : (
                recent.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <Badge preset={s.error_type || 'clean'} label={s.error_type || 'clean'} dot />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate mono" style={{ fontSize: 13, color: C.textPrimary }}>
                        {s.transcription || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>empty</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {s.timestamp ? formatDistanceToNow(new Date(s.timestamp), { addSuffix: true }) : ''}
                        {s.duration_seconds != null ? ` · ${s.duration_seconds.toFixed(1)}s` : ''}
                      </div>
                    </div>
                    {s.confidence_score != null && (
                      <span style={{
                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                        color: s.confidence_score > 0.7 ? C.green : s.confidence_score > 0.4 ? C.amber : C.red,
                        fontFamily: 'ui-monospace, monospace',
                      }}>
                        {(s.confidence_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Confidence histogram */}
          <Card>
            <CardHeader title="Confidence distribution" />
            <CardBody>
              <ErrorBoundary>
                <ConfidenceHistogram data={histogram} />
              </ErrorBoundary>
            </CardBody>
          </Card>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Error breakdown */}
          <Card>
            <CardHeader title="Error types" />
            <CardBody>
              <ErrorBoundary>
                <ErrorTypePie data={remStat} />
              </ErrorBoundary>
            </CardBody>
          </Card>

          {/* Phoneme drift */}
          <Card>
            <CardHeader
              title="Phoneme drift"
              right={
                <Link to="/phonemes" style={{ fontSize: 12, color: C.blue, textDecoration: 'none' }}>
                  Explorer →
                </Link>
              }
            />
            <CardBody>
              {drift?.degrading?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {drift.degrading.slice(0, 6).map((p) => (
                    <div key={p.phoneme} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: C.red,
                        minWidth: 34, textAlign: 'right',
                        fontFamily: 'ui-monospace, monospace',
                      }}>
                        /{p.phoneme}/
                      </span>
                      <div style={{ flex: 1, height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${(p.avg_confidence * 100).toFixed(0)}%`,
                          background: p.avg_confidence > 0.5 ? C.amber : C.red,
                          borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: C.textMuted, minWidth: 32, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                        {(p.avg_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, fontSize: 13 }}>
                  <CheckCircle2 size={14} />
                  All phonemes stable
                </div>
              )}
            </CardBody>
          </Card>

          {/* Last result */}
          {lastResult && (
            <Card>
              <CardHeader title="Last result" right={<Badge preset={lastResult.error_type || 'clean'} label={lastResult.error_type || 'clean'} dot />} />
              <CardBody>
                <p className="mono" style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, marginBottom: 10 }}>
                  "{lastResult.transcription}"
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: C.textMuted }}>
                  <span>{(lastResult.confidence * 100).toFixed(1)}% confidence</span>
                  {lastResult.snr_db != null && <span>{lastResult.snr_db.toFixed(0)} dB SNR</span>}
                  {lastResult.duration != null && <span>{lastResult.duration.toFixed(1)}s</span>}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
