import { useRef, useState, useCallback } from 'react'
import { transcribeAudio } from '@/lib/api'
import { useSessionStore, useUIStore } from '@/store'

const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function bestMime() {
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

/**
 * Convert any browser audio blob to a 16 kHz mono WAV file.
 *
 * MediaRecorder produces webm/opus which libsndfile (used by librosa) cannot
 * decode without ffmpeg.  Using AudioContext.decodeAudioData() to decode
 * natively in the browser, then encoding as PCM WAV, guarantees the backend
 * always receives a format it can read with soundfile alone.
 */
async function blobToWav16k(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  // Decode to PCM (browser handles resampling)
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  // Resample to 16kHz if needed
  const targetSampleRate = 16000
  const sourceRate = audioBuffer.sampleRate
  const ratio = sourceRate / targetSampleRate
  const numSamples = Math.round(audioBuffer.length / ratio)

  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }

  // RIFF / WAVE / fmt header
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, targetSampleRate, true)
  view.setUint32(28, targetSampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  // Simple linear interpolation resampling + mix down to mono
  const ch0 = audioBuffer.getChannelData(0)
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null
  let off = 44
  for (let i = 0; i < numSamples; i++) {
    const srcIdx = Math.min(Math.floor(i * ratio), audioBuffer.length - 1)
    const nextIdx = Math.min(srcIdx + 1, audioBuffer.length - 1)
    const frac = i * ratio - srcIdx
    const sample0 = ch0[srcIdx] * (1 - frac) + ch0[nextIdx] * frac
    let sample = sample0
    if (ch1) {
      const sample1 = ch1[srcIdx] * (1 - frac) + ch1[nextIdx] * frac
      sample = (sample0 + sample1) / 2
    }
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(off, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    off += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export function useRecorder() {
  const mediaRef    = useRef(null)
  const streamRef   = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const chunksRef   = useRef([])

  const [loading, setLoading] = useState(false)

  const sessionStore = useSessionStore()
  const uiStore      = useUIStore()
  const isRecording  = uiStore.isRecording

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16_000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const ctx      = new AudioContext({ sampleRate: 16_000 })
      const src      = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize                = 2048
      analyser.smoothingTimeConstant  = 0.8
      src.connect(analyser)
      analyserRef.current = analyser
      audioCtxRef.current = ctx

      const mime = bestMime()
      const mr   = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      chunksRef.current = []
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      mr.start(250)
      mediaRef.current = mr
      uiStore.setRecording(true)
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : `Microphone error: ${err.message}`
      uiStore.toast(msg, 'error')
    }
  }, [uiStore])

  const stop = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state === 'inactive') return

    setLoading(true)

    return new Promise((resolve) => {
      const mr = mediaRef.current

      mr.onstop = async () => {
        const mime = mr.mimeType || 'audio/webm'
        const rawBlob = new Blob(chunksRef.current, { type: mime })

        streamRef.current?.getTracks().forEach((t) => t.stop())
        audioCtxRef.current?.close()
        analyserRef.current = null
        uiStore.setRecording(false)

        const ref       = sessionStore.referenceTranscript
        const sessionId = sessionStore.sessionId

        try {
          // Convert to 16 kHz mono WAV — works on all backends without ffmpeg
          const wavBlob = await blobToWav16k(rawBlob)
          const result  = await transcribeAudio(wavBlob, 'recording.wav', ref, sessionId)
          sessionStore.setLastResult(result)
          uiStore.toast('Transcription complete', 'success')
          resolve(result)
        } catch (err) {
          uiStore.toast(`Transcription failed: ${err.message}`, 'error')
          resolve(null)
        } finally {
          setLoading(false)
        }
      }

      mr.stop()
    })
  }, [uiStore, sessionStore])

  return { start, stop, isRecording, loading, analyserRef }
}
