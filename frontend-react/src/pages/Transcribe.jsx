import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, Square, Upload, Volume2, X, AlertCircle } from 'lucide-react'
import { transcribeAudio, synthesizeSpeech } from '@/lib/api'
import { useRecorder } from '@/hooks/useRecorder'
import { useSessionStore, useUIStore } from '@/store'
import { Waveform } from '@/components/ui/Waveform'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PhonemeTokenStrip } from '@/components/charts/PhonemeHeatmap'
import { C } from '@/lib/theme'

function ConfidenceRing({ value }) {
  const R    = 42
  const circ = 2 * Math.PI * R
  const fill = (value ?? 0) * circ
  const c    = value > 0.7 ? C.green : value > 0.4 ? C.amber : C.red

  return (
    <svg width={100} height={100} style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={50} cy={50} r={R} fill="none" stroke={C.border} strokeWidth={5} />
      <circle cx={50} cy={50} r={R} fill="none" stroke={c} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ - fill} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s', filter: `drop-shadow(0 0 5px ${c}88)` }}
      />
      <text x={50} y={54} textAnchor="middle" fill={c} fontSize={13} fontWeight={700} fontFamily="JetBrains Mono,monospace"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>
        {value != null ? `${(value * 100).toFixed(0)}%` : '—'}
      </text>
    </svg>
  )
}

function MetricPill({ label, value, color }) {
  if (value == null) return null
  return (
    <div style={{
      display: 'flex', gap: 4, fontSize: 9,
      padding: '2px 7px', borderRadius: 3,
      background: (color || C.cyan) + '12',
      border: `1px solid ${(color || C.cyan)}22`,
    }}>
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ color: color || C.cyan, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function ResultCard({ result }) {
  const [audioUrl, setAudioUrl]         = useState(null)
  const [synthLoading, setSynthLoading] = useState(false)
  const audioRef = useRef(null)
  const toast    = useUIStore((s) => s.toast)

  const handleSynth = async () => {
    setSynthLoading(true)
    try {
      const url = await synthesizeSpeech(result.transcription)
      setAudioUrl(url)
      setTimeout(() => audioRef.current?.play(), 80)
    } catch { toast('TTS synthesis failed', 'error') }
    finally   { setSynthLoading(false) }
  }

  const opConfidence = { substitution: 0.25, deletion: 0.10, insertion: 0.40 }
  const tokens = (result.phoneme_errors || []).slice(0, 40).map((pe) => ({
    token:      pe.hypothesis || pe.reference || '?',
    confidence: pe.operation in opConfidence
      ? opConfidence[pe.operation]
      : Math.min(result.confidence ?? 0.5, 0.95),
    trend:      pe.operation !== 'equal' ? 'degrading' : 'stable',
  }))

  const uncertainPct = result.total_frames > 0
    ? ((result.uncertain_frames / result.total_frames) * 100).toFixed(0)
    : null

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card glow={C.cyan}>
        <CardHeader title="Result" accent={C.cyan}
          right={<Badge preset={result.error_type} label={result.error_type || 'clean'} />}
        />
        <CardBody>
          {/* Top: ring + transcript */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 16 }}>
            <ConfidenceRing value={result.confidence} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, color: C.textPrimary, lineHeight: 1.7,
                padding: '10px 14px', background: C.surfaceAlt,
                borderRadius: 7, border: `1px solid ${C.border}`, marginBottom: 10,
              }}>
                {result.transcription || '(empty)'}
              </div>

              {/* Metrics row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.cer_score != null && <MetricPill label="CER" value={`${(result.cer_score * 100).toFixed(1)}%`} color={result.cer_score < 0.1 ? C.green : C.amber} />}
                {result.wer_score != null && <MetricPill label="WER" value={`${(result.wer_score * 100).toFixed(1)}%`} color={result.wer_score < 0.2 ? C.green : C.amber} />}
                {result.per_score != null && <MetricPill label="PER" value={`${(result.per_score * 100).toFixed(1)}%`} color={C.purple} />}
                {result.snr_db    != null && <MetricPill label="SNR" value={`${result.snr_db.toFixed(1)} dB`} color={result.snr_db > 10 ? C.green : C.red} />}
                {uncertainPct     != null && <MetricPill label="Unc.frames" value={`${uncertainPct}%`} color={C.amber} />}
                <MetricPill label="Basis" value={result.diagnostic_basis} color={C.textSecondary} />
              </div>
            </div>
          </div>

          {/* Phoneme strip */}
          {tokens.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Phoneme Confidence Strip</div>
              <PhonemeTokenStrip phonemes={tokens} />
            </div>
          )}

          {/* Edit ops */}
          {result.phoneme_errors?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Edit Operations ({result.phoneme_errors.length})
              </div>
              <div style={{ maxHeight: 110, overflowY: 'auto' }}>
                {result.phoneme_errors.slice(0, 24).map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', borderBottom: `1px solid ${C.border}`, fontSize: 10 }}>
                    <Badge label={e.operation} preset={e.operation === 'substitution' ? 'pronunciation' : e.operation === 'deletion' ? 'noise' : 'processing'} style={{ minWidth: 76 }} />
                    <span style={{ color: C.textSecondary }}>{e.reference || '∅'} → {e.hypothesis || '∅'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TTS */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="ghost" size="sm" onClick={handleSynth} loading={synthLoading} icon={<Volume2 size={11} />}>
              Synthesize TTS
            </Button>
            {audioUrl && (
              <audio ref={audioRef} controls src={audioUrl} style={{ height: 26, flex: 1 }} />
            )}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default function Transcribe() {
  const { start, stop, isRecording, loading, analyserRef } = useRecorder()
  const { referenceTranscript, setReferenceTranscript, recentRefs, lastResult: persistedResult } = useSessionStore()
  const lastResult = useUIStore((s) => s.lastResult)
  const toast      = useUIStore((s) => s.toast)

  const [uploadResult,  setUploadResult]  = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setUploadLoading(true)
    setUploadResult(null)
    try {
      const result = await transcribeAudio(file, file.name, referenceTranscript)
      setUploadResult(result)
      // Persist to localStorage so it survives page refresh
      useSessionStore.getState().setLastResult(result)
      toast('File transcribed', 'success')
    } catch (err) { toast(`Upload failed: ${err.message}`, 'error') }
    finally       { setUploadLoading(false) }
  }, [referenceTranscript, toast])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  // Show: new upload → new recording → persisted from last session
  const result = uploadResult || persistedResult

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, height: 'calc(100vh - 104px)' }}>
      {/* Left: inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        {/* Reference */}
        <Card>
          <CardHeader title="Reference Transcript" subtitle="optional — enables CER / WER / PER + phoneme alignment" />
          <CardBody>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={referenceTranscript}
                onChange={(e) => setReferenceTranscript(e.target.value)}
                list="recent-refs"
                placeholder="Enter ground-truth text…"
                style={{
                  flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  borderRadius: 5, padding: '7px 10px', color: C.textPrimary,
                  fontSize: 11, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <datalist id="recent-refs">
                {(recentRefs || []).map((r, i) => <option key={i} value={r} />)}
              </datalist>
              {referenceTranscript && (
                <button onClick={() => setReferenceTranscript('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Microphone */}
        <Card>
          <CardHeader title="Live Recording" subtitle="wav2vec2-base-960h · 16 kHz mono" />
          <CardBody>
            <Waveform analyserRef={analyserRef} isRecording={isRecording} height={90} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 18, gap: 10 }}>
              <button
                onClick={isRecording ? stop : start}
                disabled={loading}
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: isRecording ? C.redGlow   : C.cyanGlow,
                  border:     isRecording ? `2px solid ${C.red}` : `2px solid ${C.cyan}`,
                  color:      isRecording ? C.red        : C.cyan,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: isRecording ? `0 0 24px ${C.red}44` : `0 0 20px ${C.cyan}22`,
                  animation: isRecording ? 'pulse-glow 1.2s ease-in-out infinite' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? <Spinner size={20} /> : isRecording ? <Square size={20} fill={C.red} /> : <Mic size={22} />}
              </button>
              <div style={{ fontSize: 10, color: C.textMuted }}>
                {loading ? 'Processing…' : isRecording ? 'Recording — click to stop' : 'Click to record'}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* File upload */}
        <Card>
          <CardHeader title="File Upload" subtitle=".wav .mp3 .m4a .flac .webm .ogg" />
          <CardBody>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${C.border}`, borderRadius: 8,
                padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', color: C.textMuted, transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = C.cyan + '55'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
            >
              {uploadLoading
                ? <div style={{ display: 'flex', justifyContent: 'center' }}><Spinner /></div>
                : <><Upload size={22} style={{ opacity: 0.35, marginBottom: 8 }} /><div style={{ fontSize: 11 }}>Drop audio or click to browse</div></>
              }
            </div>
            <input ref={fileRef} type="file" accept=".wav,.mp3,.m4a,.flac,.webm,.ogg" style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </CardBody>
        </Card>
      </div>

      {/* Right: result */}
      <div style={{ overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          {result ? (
            <ResultCard key={result.transcription + result.confidence} result={result} />
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textMuted, gap: 12 }}>
              <Mic size={40} style={{ opacity: 0.12 }} />
              <div style={{ fontSize: 12 }}>Results appear here</div>
              <div style={{ fontSize: 10, color: C.textDim }}>Record audio or upload a file</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
