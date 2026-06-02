/**
 * Typed API client — all backend calls live here.
 * Proxy configuration in vite.config.js forwards these to :5000.
 */

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request(path, init = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : res
}

// ── Health & status ───────────────────────────────────────────
export const getHealth          = () => request('/health')
export const getTtsStatus       = () => request('/tts_status')

// ── Transcription ─────────────────────────────────────────────
export const transcribeAudio = (audioBlob, filename, referenceTranscript, sessionId) => {
  const form = new FormData()
  form.append('audio', audioBlob, filename)
  if (referenceTranscript) form.append('reference_transcript', referenceTranscript)
  if (sessionId)           form.append('session_id', sessionId)
  return request('/transcribe', { method: 'POST', body: form })
}

export const synthesizeSpeech = async (text) => {
  const res = await request('/synthesize', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text }),
  })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// ── Session history ───────────────────────────────────────────
export const getSessions        = (limit = 100) => request(`/sessions?limit=${limit}`)

// ── Analytics ─────────────────────────────────────────────────
export const getRemediationStatus   = () => request('/remediation_status')
export const getDriftReport         = () => request('/drift_report')
export const getConfidenceHistogram = (bins = 20) => request(`/confidence_histogram?bins=${bins}`)
export const getPhonemeErrorReport  = () => request('/phoneme_error_report')
export const getNoiseReport         = () => request('/noise_report')
export const getCalibrationMetrics  = () => request('/calibration_metrics')

// ── Queue ─────────────────────────────────────────────────────
export const getPriorityQueue   = () => request('/priority_queue')
export const checkVocabulary    = (text) => request(`/vocabulary_check?text=${encodeURIComponent(text)}`)

// ── Models ────────────────────────────────────────────────────
export const getDatasetStats    = () => request('/dataset_stats')
export const getLoraStatus      = () => request('/lora_status')
export const getLoraExpertsStatus = () => request('/lora_experts_status')

// ── Drive fetch ───────────────────────────────────────────────
export const fetchDriveAudio    = (url) =>
  request('/fetch_drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
