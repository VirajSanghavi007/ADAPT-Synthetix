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
  // Decode to PCM at 16 kHz (browsers resample automatically)
  const ctx         = new AudioContext({ sampleRate: 16_000 })
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const numSamples = audioBuffer.length
  const buffer     = new ArrayBuffer(44 + numSamples * 2)
  const view       = new DataView(buffer)

  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }

  // RIFF / WAVE / fmt  header
  writeStr(0, 'RIFF')
  view.setUint32(4,  36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16,          true)  // chunk size
  view.setUint16(20, 1,           true)  // PCM
  view.setUint16(22, 1,           true)  // mono
  view.setUint32(24, 16_000,      true)  // sample rate
  view.setUint32(28, 16_000 * 2,  true)  // byte rate
  view.setUint16(32, 2,           true)  // block align
  view.setUint16(34, 16,          true)  // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  // Mix down to mono if needed, then write int16 PCM
  const ch0 = audioBuffer.getChannelData(0)
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null
  let off = 44
  for (let i = 0; i < numSamples; i++) {
    const sample = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i]
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
