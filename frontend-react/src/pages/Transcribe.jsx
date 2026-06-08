import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, Square, Upload, Volume2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { transcribeAudio, synthesizeSpeech } from '@/lib/api'
import { useRecorder } from '@/hooks/useRecorder'
import { useSessionStore, useUIStore } from '@/store'
import { Waveform } from '@/components/ui/Waveform'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

// ── Confidence arc ────────────────────────────────────────────
function ConfidenceArc({ value }) {
  const pct = value ?? 0
  const color = pct > 0.7 ? C.green : pct > 0.4 ? C.amber : C.red
  const R = 36
  const circ = 2 * Math.PI * R
  const dash = pct * circ

  return (
    <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
      <svg width={84} height={84} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={42} cy={42} r={R} fill="none" stroke={C.surfaceAlt} strokeWidth={5} />
        <circle
          cx={42} cy={42} r={R} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={circ - dash}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'ui-monospace, monospace', lineHeight: 1 }}>
          {value != null ? `${(value * 100).toFixed(0)}%` : '—'}
        </span>
        <span style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>conf</span>
      </div>
    </div>
  )
}

// ── Metric pill ───────────────────────────────────────────────
function Metric({ label, value, good }) {
  if (value == null) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '6px 10px', borderRadius: 6,
      background: C.surfaceAlt, border: `1px solid ${C.border}`,
      minWidth: 64, textAlign: 'center',
    }}>
      <span style={{ fontSize: 10, color: C.textMuted }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600,
        color: good == null ? C.textPrimary : good ? C.green : C.amber,
        fontFamily: 'ui-monospace, monospace',
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Result card ───────────────────────────────────────────────
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

  const uncertainPct = result.total_frames > 0
    ? Math.round((result.uncertain_frames / result.total_frames) * 100)
    : null

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card>
        <CardHeader
          title="Transcription result"
          right={<Badge preset={result.error_type || 'clean'} label={result.error_type || 'clean'} dot />}
        />
        <CardBody>
          {/* Confidence + transcript */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <ConfidenceArc value={result.confidence} />
            <div style={{ flex: 1 }}>
              <div className="mono" style={{
                fontSize: 14, color: C.textPrimary, lineHeight: 1.7,
                padding: '10px 12px',
                background: C.surfaceAlt,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                marginBottom: 10,
                userSelect: 'text',
              }}>
                {result.transcription || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>(empty)</span>}
              </div>

              {/* Metrics */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {result.cer_score != null && (
                  <Metric label="CER" value={`${(result.cer_score * 100).toFixed(1)}%`} good={result.cer_score < 0.1} />
                )}
                {result.wer_score != null && (
                  <Metric label="WER" value={`${(result.wer_score * 100).toFixed(1)}%`} good={result.wer_score < 0.2} />
                )}
                {result.per_score != null && (
                  <Metric label="PER" value={`${(result.per_score * 100).toFixed(1)}%`} />
                )}
                {result.snr_db != null && (
                  <Metric label="SNR" value={`${result.snr_db.toFixed(1)} dB`} good={result.snr_db > 10} />
                )}
                {uncertainPct != null && (
                  <Metric label="Uncertainty" value={`${uncertainPct}%`} good={uncertainPct < 20} />
                )}
                {result.noise_type && result.noise_type !== 'clean' && (
                  <Metric label="Noise" value={result.noise_type} />
                )}
              </div>
            </div>
          </div>

          {/* Phoneme errors */}
          {result.phoneme_errors?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.textSecondary, marginBottom: 8 }}>
                Phoneme errors ({result.phoneme_errors.length})
              </div>
              <div style={{
                maxHeight: 140, overflowY: 'auto',
                border: `1px solid ${C.border}`, borderRadius: 6,
                background: C.surfaceAlt,
              }}>
                {result.phoneme_errors.slice(0, 24).map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px',
                    borderBottom: i < Math.min(result.phoneme_errors.length, 24) - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <Badge
                      label={e.operation}
                      preset={e.operation === 'substitution' ? 'pronunciation' : e.operation === 'deletion' ? 'noise' : 'processing'}
                      style={{ minWidth: 80 }}
                    />
                    <span className="mono" style={{ fontSize: 12, color: C.textSecondary }}>
                      {e.reference || '∅'} → {e.hypothesis || '∅'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TTS */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSynth}
              loading={synthLoading}
              icon={<Volume2 size={12} />}
            >
              Synthesize with TTS
            </Button>
            {audioUrl && (
              <audio ref={audioRef} controls src={audioUrl} style={{ height: 28, flex: 1 }} />
            )}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Transcribe() {
  const { start, stop, isRecording, loading: recLoading, analyserRef } = useRecorder()
  const { referenceTranscript, setReferenceTranscript, recentRefs, lastResult: persistedResult } = useSessionStore()
  const toast = useUIStore((s) => s.toast)

  const [uploadResult,  setUploadResult]  = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [dragOver,      setDragOver]      = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setUploadLoading(true)
    setUploadResult(null)
    try {
      const result = await transcribeAudio(file, file.name, referenceTranscript)
      setUploadResult(result)
      useSessionStore.getState().setLastResult(result)
      toast('File transcribed successfully', 'success')
    } catch (err) {
      toast(`Upload failed: ${err.message}`, 'error')
    } finally {
      setUploadLoading(false)
    }
  }, [referenceTranscript, toast])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const result = uploadResult || persistedResult

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20, alignItems: 'start', maxWidth: 1100 }}>

      {/* Left column — inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Reference transcript */}
        <Card>
          <CardHeader
            title="Reference transcript"
            subtitle="Optional — enables CER / WER / PER and phoneme alignment"
          />
          <CardBody>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={referenceTranscript}
                onChange={(e) => setReferenceTranscript(e.target.value)}
                list="recent-refs"
                placeholder="Enter ground-truth text…"
                style={{ flex: 1, padding: '8px 10px', fontSize: 13 }}
              />
              <datalist id="recent-refs">
                {(recentRefs || []).map((r, i) => <option key={i} value={r} />)}
              </datalist>
              {referenceTranscript && (
                <button
                  onClick={() => setReferenceTranscript('')}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 8px', cursor: 'pointer', color: C.textMuted }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Live recording */}
        <Card>
          <CardHeader
            title="Record audio"
            subtitle="Whisper · 16 kHz · converted to WAV automatically"
          />
          <CardBody>
            <Waveform analyserRef={analyserRef} isRecording={isRecording} height={80} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button
                onClick={isRecording ? stop : start}
                disabled={recLoading}
                style={{
                  width: 56, height: 56,
                  borderRadius: '50%',
                  background: isRecording ? C.redDim : C.blueDim,
                  border: `1.5px solid ${isRecording ? C.red : C.blue}`,
                  color: isRecording ? C.red : C.blue,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: recLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  animation: isRecording ? 'pulse-glow 1.4s ease-in-out infinite' : 'none',
                }}
              >
                {recLoading
                  ? <Spinner size={18} />
                  : isRecording
                    ? <Square size={18} fill={C.red} />
                    : <Mic size={20} />}
              </button>

              <span style={{ fontSize: 12, color: C.textMuted }}>
                {recLoading
                  ? 'Processing…'
                  : isRecording
                    ? 'Recording — click to stop and transcribe'
                    : 'Click to start recording'}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* File upload */}
        <Card>
          <CardHeader title="Upload file" subtitle=".wav  .mp3  .m4a  .flac  .webm  .ogg" />
          <CardBody>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? C.blue : C.border}`,
                borderRadius: 8,
                padding: '28px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                color: C.textMuted,
                background: dragOver ? C.blueDim : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {uploadLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Spinner size={20} />
                </div>
              ) : (
                <>
                  <Upload size={20} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>Drop audio file or click to browse</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: C.textDim }}>Max 50 MB</div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".wav,.mp3,.m4a,.flac,.webm,.ogg"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </CardBody>
        </Card>
      </div>

      {/* Right column — results */}
      <div style={{ minHeight: 400 }}>
        <AnimatePresence mode="wait">
          {result ? (
            <ResultCard key={`${result.transcription}-${result.confidence}`} result={result} />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 12, color: C.textMuted,
                padding: '80px 20px', textAlign: 'center',
              }}
            >
              <Mic size={36} style={{ opacity: 0.15 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>No result yet</p>
              <p style={{ fontSize: 12, color: C.textDim }}>Record audio or upload a file to see the transcription</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
