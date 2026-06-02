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

export function useRecorder() {
  const mediaRef    = useRef(null)
  const streamRef   = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const chunksRef   = useRef([])

  const [loading, setLoading] = useState(false)

  // Read values from store — stable refs so no dep-array issues
  const sessionStore = useSessionStore()
  const uiStore      = useUIStore()

  const isRecording = uiStore.isRecording

  // start has NO dependency on referenceTranscript/sessionId
  // Those are read from refs at stop-time when the recording actually finishes
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      })
      streamRef.current = stream

      const ctx      = new AudioContext({ sampleRate: 16000 })
      const src      = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
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
  }, [uiStore]) // uiStore is stable (zustand store object)

  const stop = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state === 'inactive') return

    setLoading(true)

    return new Promise((resolve) => {
      const mr = mediaRef.current

      mr.onstop = async () => {
        const mime = mr.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        const ext  = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'

        streamRef.current?.getTracks().forEach((t) => t.stop())
        audioCtxRef.current?.close()
        analyserRef.current = null
        uiStore.setRecording(false)

        // Read current values at stop-time (not at start-time)
        const ref       = sessionStore.referenceTranscript
        const sessionId = sessionStore.sessionId

        try {
          const result = await transcribeAudio(blob, `recording.${ext}`, ref, sessionId)
          // Persist to localStorage — survives page refresh
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
  }, [uiStore, sessionStore]) // both are stable store objects

  return { start, stop, isRecording, loading, analyserRef }
}
