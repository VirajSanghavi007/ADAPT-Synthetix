import { useState, useMemo, Fragment, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Search, ChevronDown, ChevronUp, Volume2, X, Download, ExternalLink } from 'lucide-react'
import { getSessions, getSessionDetail, synthesizeSpeech, SESSIONS_LIMIT } from '@/lib/api'
import { useSessionStore } from '@/store'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner'
import { useUIStore } from '@/store'
import { C } from '@/lib/theme'

const PAGE_SIZE = 25

function exportCSV(rows) {
  const cols = ['id', 'timestamp', 'transcription', 'error_type', 'confidence_score', 'cer_score', 'wer_score', 'snr_db']
  const header = cols.join(',')
  const escape = (v) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sessions_export_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

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

function DetailPanel({ sessionId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true); setError(null)
    getSessionDetail(sessionId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  const opColor = { substitution: C.clay, deletion: C.amber, insertion: C.lavender }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 420, height: '100vh',
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      zIndex: 200, overflowY: 'auto', boxShadow: '-8px 0 32px #00000044',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary }}>Session #{sessionId}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4 }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: 18, flex: 1 }}>
        {loading && <div style={{ fontSize: 11, color: C.textMuted }}>Loading…</div>}
        {error && <div style={{ fontSize: 11, color: C.clay }}>Error: {error}</div>}
        {detail && (
          <>
            <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Transcription</div>
            <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.7, padding: '8px 10px', background: C.surfaceAlt, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              {detail.transcription}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                ['Confidence', detail.confidence_score != null ? `${(detail.confidence_score * 100).toFixed(1)}%` : '—', C.teal],
                ['CER',  detail.cer_score  != null ? `${(detail.cer_score * 100).toFixed(1)}%` : '—', C.amber],
                ['WER',  detail.wer_score  != null ? `${(detail.wer_score * 100).toFixed(1)}%` : '—', C.amber],
                ['PER',  detail.per_score  != null ? `${(detail.per_score * 100).toFixed(1)}%` : '—', C.lavender],
                ['SNR',  detail.snr_db     != null ? `${detail.snr_db.toFixed(1)} dB` : '—', C.textSecondary],
                ['Type', detail.error_type || '—', C.textSecondary],
              ].map(([k, v, c]) => (
                <div key={k} style={{ padding: '6px 10px', background: C.surfaceAlt, borderRadius: 4, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, color: C.textMuted, marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            {detail.noise_profile?.noise_type && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Noise</div>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 3, background: C.tealGlow, color: C.teal, border: `1px solid ${C.teal}33` }}>
                  {detail.noise_profile.noise_type}
                </span>
              </div>
            )}
            <div>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Phoneme errors</div>
              {!detail.phoneme_errors?.length
                ? <div style={{ fontSize: 10, color: C.textMuted }}>No phoneme data</div>
                : detail.phoneme_errors.slice(0, 20).map((pe, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 2, background: (opColor[pe.operation] || C.teal) + '22', color: opColor[pe.operation] || C.teal }}>{pe.operation}</span>
                    <span style={{ fontSize: 10, color: C.textSecondary }}>{pe.reference_phoneme || '∅'} → {pe.hypothesis_phoneme || '∅'}</span>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const ERROR_TYPES = ['all', 'clean', 'noise', 'accent', 'pronunciation']

export default function History() {
  // Restore search + filter from last session
  const { historySearch, historyFilter, setHistorySearch, setHistoryFilter } = useSessionStore()
  const [search, setSearchLocal]     = useState(historySearch)
  const [typeFilter, setFilterLocal] = useState(historyFilter)

  // Wrap setters to also persist
  const setSearch = (v) => { setSearchLocal(v); setHistorySearch(v); setPage(1) }
  const setFilter = (v) => { setFilterLocal(v); setHistoryFilter(v); setPage(1) }
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState(null)

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageStart = (safePage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <div style={{ position: 'relative' }}>
      {detailId != null && <DetailPanel sessionId={detailId} onClose={() => setDetailId(null)} />}
      <Card>
        <CardHeader
          title="Session History"
          subtitle={`${filtered.length} / ${sessions?.length ?? 0} records`}
          right={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
              <button
                onClick={() => exportCSV(filtered)}
                disabled={!filtered.length}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 3,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.textMuted, fontSize: 9,
                  cursor: filtered.length ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', opacity: filtered.length ? 1 : 0.4,
                }}
              >
                <Download size={9} /> Export CSV
              </button>
            </div>
          }
        />
        {isLoading ? (
          <LoadingOverlay />
        ) : !filtered.length ? (
          <EmptyState icon={<Search size={28} />} title="No sessions found" sub="Try a different filter" />
        ) : (
          <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }} aria-label="Session history">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderBright}` }}>
                  {['Time', 'Transcription', 'Type', 'Conf', 'CER', 'WER', ''].map((h) => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 8, color: C.textMuted, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((s, i) => (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {expanded === s.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailId(s.id) }}
                            title="View detail"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}
                          >
                            <ExternalLink size={10} />
                          </button>
                        </div>
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
          {totalPages > 1 && (

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 9, color: C.textMuted }}>
                Showing {pageStart}–{pageEnd} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{ padding: '2px 8px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'transparent', color: safePage === 1 ? C.textDim : C.textMuted, fontSize: 9, cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >Previous</button>
                <span style={{ fontSize: 9, color: C.textMuted, lineHeight: '22px' }}>{safePage} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{ padding: '2px 8px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'transparent', color: safePage === totalPages ? C.textDim : C.textMuted, fontSize: 9, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >Next</button>
              </div>
            </div>
          )}
          </>
        )}
      </Card>
    </div>
  )
}
