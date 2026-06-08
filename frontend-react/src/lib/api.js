/**
 * Typed API client.
 * • All GET requests accept an AbortSignal — React Query v5 passes one automatically.
 * • Blob URLs for TTS are created here; callers must revoke them via URL.revokeObjectURL.
 */

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.name   = 'ApiError'
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

// ── Canonical query key ──────────────────────────────────────
// SESSIONS_LIMIT is the single source of truth used everywhere.
// Pages that need fewer rows just .slice() the cached array client-side.
export const SESSIONS_LIMIT = 200

// ── Health ───────────────────────────────────────────────────
export const getHealth    = ({ signal } = {}) => request('/health',     { signal })
export const getTtsStatus = ({ signal } = {}) => request('/tts_status', { signal })

// ── Transcription ─────────────────────────────────────────────
export const transcribeAudio = (audioBlob, filename, referenceTranscript, sessionId) => {
  const form = new FormData()
  form.append('audio', audioBlob, filename)
  if (referenceTranscript) form.append('reference_transcript', referenceTranscript)
  if (sessionId)           form.append('session_id', sessionId)
  return request('/transcribe', { method: 'POST', body: form })
}

export const synthesizeSpeech = async (text, signal) => {
  const res  = await request('/synthesize', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text }),
    signal,
  })
  const blob = await res.blob()
  return URL.createObjectURL(blob)  // caller must revokeObjectURL when done
}

// ── Sessions ──────────────────────────────────────────────────
export const getSessions = ({ signal } = {}, limit = SESSIONS_LIMIT) =>
  request(`/sessions?limit=${limit}`, { signal })

export const getSessionDetail = (id, { signal } = {}) => request(`/sessions/${id}`, { signal })

// ── Analytics ─────────────────────────────────────────────────
export const getRemediationStatus   = ({ signal } = {}) => request('/remediation_status',    { signal })
export const getDriftReport         = ({ signal } = {}) => request('/drift_report',           { signal })
export const getConfidenceHistogram = ({ signal } = {}, bins = 20) => request(`/confidence_histogram?bins=${bins}`, { signal })
export const getPhonemeErrorReport  = ({ signal } = {}) => request('/phoneme_error_report',  { signal })
export const getNoiseReport         = ({ signal } = {}) => request('/noise_report',           { signal })
export const getCalibrationMetrics  = ({ signal } = {}) => request('/calibration_metrics',   { signal })

// ── Queue ──────────────────────────────────────────────────────
export const getPriorityQueue  = ({ signal } = {}) => request('/priority_queue',      { signal })
export const checkVocabulary   = (text, { signal } = {}) =>
  request(`/vocabulary_check?text=${encodeURIComponent(text)}`, { signal })

// ── Models ─────────────────────────────────────────────────────
export const getDatasetStats      = ({ signal } = {}) => request('/dataset_stats',       { signal })
export const getLoraStatus        = ({ signal } = {}) => request('/lora_status',         { signal })
export const getLoraExpertsStatus = ({ signal } = {}) => request('/lora_experts_status', { signal })
export const getModelInfo         = ({ signal } = {}) => request('/model_info',          { signal })
export const getTrainingStatus    = ({ signal } = {}) => request('/training_status',     { signal })

export const triggerTraining = (errorType = null, epochs = 3) =>
  request('/train', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ error_type: errorType || null, epochs }),
  })

// ── Drive ──────────────────────────────────────────────────────
export const fetchDriveAudio = (url, { signal } = {}) =>
  request('/fetch_drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal })
