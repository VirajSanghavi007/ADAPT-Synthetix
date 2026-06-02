import { useState, useMemo, Fragment, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Search, ChevronDown, ChevronUp, Volume2, X } from 'lucide-react'
import { getSessions, synthesizeSpeech, SESSIONS_LIMIT } from '@/lib/api'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner'
import { useUIStore } from '@/store'
import { C } from '@/lib/theme'

function parseNoise(raw) {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

function ExpandedRow({ session }) {
  const [audioUrl, setAudioUrl]         = useState(null)
  const [synthLoading, setSynthLoading] = useState(false)
  const toast = useUIStore((s) => s.toast)
  const np    = useMemo(() => parseNoise(session.noise_profile), [session.noise_profile])

  // Revoke blob URL when row unmounts or URL changes — prevents memory leak
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }
  }, [audioUrl])

  const synthesize = useCallback(async () => {
    setSynthLoading(true)
    try {
      const url = await synthesizeSpeech(session.transcription)
      setAudioUrl(url)
    } catch { toast('TTS synthesis failed', 'error') }
    finally   { setSynthLoading(false) }
  }, [session.transcription, toast])

  return (
    <tr>
      <td colSpan={7} style={{ padding: 0, background: C.surfaceAlt }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Transcription</div>
              <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.7, padding: '8px 10px', background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
                {session.transcription}
              </div>
              {session.reference_transcript && (
                <>
                  <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, marginTop: 10 }}>Reference</div>
                  <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7, padding: '8px 10px', background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    {session.reference_transcript}
                  </div>
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Metrics</div>
              {[
                ['Confidence', session.confidence_score != null ? `${(session.confidence_score * 100).toFixed(1)}%` : '—', C.teal],
                ['CER',        session.cer_score != null ? `${(session.cer_score * 100).toFixed(1)}%` : '—', C.amber],
                ['WER',        session.wer_score != null ? `${(session.wer_score * 100).toFixed(1)}%` : '—', C.amber],
                ['PER',        session.per_score != null ? `${(session.per_score * 100).toFixed(1)}%` : '—', C.lavender],
                ['SNR',        session.snr_db    != null ? `${session.snr_db.toFixed(1)} dB` : '—', C.textSecondary],
                ['Duration',   session.duration_seconds ? `${session.duration_seconds.toFixed(2)}s` : '—', C.textSecondary],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                  <span style={{ color: C.textMuted }}>{k}</span>
                  <span style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Noise Profile</div>
              {Object.entries(np).filter(([k]) => k !== 'noise_type').slice(0, 4).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
                  <span style={{ color: C.textMuted }}>{k}</span>
                  <span style={{ color: C.textSecondary }}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                </div>
              ))}
              <button onClick={synthesize} disabled={synthLoading} style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', background: C.tealGlow,
                border: `1px solid ${C.teal}33`, borderRadius: 4,
                color: C.teal, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Volume2 size={11} />
                {synthLoading ? 'Generating…' : 'Synthesize'}
              </button>
              {audioUrl && <audio controls src={audioUrl} style={{ width: '100%', marginTop: 8, height: 28 }} />}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

const ERROR_TYPES = ['all', 'clean', 'noise', 'accent', 'pronunciation']

export default function History() {
  const [search, setSearch]     = useState('')
  const [typeFilter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  // Canonical queryKey matches Dashboard and Analytics — single cache entry
  const { data: sessions, isLoading } = useQuery({
    queryKey:        ['sessions', SESSIONS_LIMIT],
    queryFn:         getSessions,
    refetchInterval: 12_000,
  })

  const filtered = useMemo(() => {
    let s = sessions || []
    if (typeFilter !== 'all') s = s.filter((x) => x.error_type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      s = s.filter((x) =>
        x.transcription?.toLowerCase().includes(q) ||
        x.reference_transcript?.toLowerCase().includes(q) ||
        x.session_id?.toLowerCase().includes(q)
      )
    }
    return s
  }, [sessions, typeFilter, search])

  return (
    <div>
      <Card>
        <CardHeader
          title="Session History"
          subtitle={`${filtered.length} / ${sessions?.length ?? 0} records`}
          right={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  style={{
                    paddingLeft: 24, paddingRight: search ? 24 : 8,
                    paddingTop: 4, paddingBottom: 4,
                    background: C.surfaceAlt, border: `1px solid ${C.border}`,
                    borderRadius: 4, color: C.textPrimary,
                    fontSize: 10, outline: 'none', fontFamily: 'inherit', width: 180,
                  }}
                />
                {search && <X size={9} onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, cursor: 'pointer' }} />}
              </div>
              {ERROR_TYPES.map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '2px 7px', borderRadius: 3,
                  border: `1px solid ${typeFilter === f ? C.teal : C.border}`,
                  background: typeFilter === f ? C.tealGlow : 'transparent',
                  color: typeFilter === f ? C.teal : C.textMuted,
                  fontSize: 8, cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>{f}</button>
              ))}
            </div>
          }
        />
        {isLoading ? (
          <LoadingOverlay />
        ) : !filtered.length ? (
          <EmptyState icon={<Search size={28} />} title="No sessions found" sub="Try a different filter" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderBright}` }}>
                  {['Time', 'Transcription', 'Type', 'Conf', 'CER', 'WER', ''].map((h) => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <Fragment key={s.id}>
                    <motion.tr
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.2) }}
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: expanded === s.id ? C.surfaceAlt : 'transparent' }}
                    >
                      <td style={{ padding: '9px 12px', color: C.textMuted, fontSize: 9, whiteSpace: 'nowrap' }}>
                        {s.timestamp ? format(new Date(s.timestamp), 'MM/dd HH:mm') : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', maxWidth: 260 }}>
                        <div className="truncate" style={{ color: C.textPrimary }}>{s.transcription || '—'}</div>
                      </td>
                      <td style={{ padding: '9px 12px' }}><Badge preset={s.error_type || 'clean'} label={s.error_type || 'clean'} dot /></td>
                      <td style={{ padding: '9px 12px', color: s.confidence_score > 0.7 ? C.forest : s.confidence_score > 0.4 ? C.amber : C.clay }}>
                        {s.confidence_score != null ? `${(s.confidence_score * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', color: s.cer_score != null ? (s.cer_score < 0.1 ? C.forest : C.amber) : C.textMuted }}>
                        {s.cer_score != null ? `${(s.cer_score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', color: s.wer_score != null ? (s.wer_score < 0.2 ? C.forest : C.amber) : C.textMuted }}>
                        {s.wer_score != null ? `${(s.wer_score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', color: C.textMuted }}>
                        {expanded === s.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {expanded === s.id && <ExpandedRow key={`exp-${s.id}`} session={s} />}
                    </AnimatePresence>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
