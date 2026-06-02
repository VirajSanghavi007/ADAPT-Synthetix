import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { C } from '@/lib/theme'

const STEPS = [
  { id: 1, label: 'Connecting to backend',        detail: 'Pinging /health endpoint…' },
  { id: 2, label: 'Loading ASR pipeline',          detail: 'Wav2Vec2 · 960h LibriSpeech' },
  { id: 3, label: 'Loading TTS engine',            detail: 'Bark-small · suno/bark-small' },
  { id: 4, label: 'Initializing phoneme engine',   detail: 'G2P · CUSUM drift detector' },
  { id: 5, label: 'Building session context',      detail: 'Priority queue · replay buffer' },
]

// How long each step takes (ms) — step 1 waits for real /health response
const STEP_DURATIONS = [0, 700, 600, 500, 400]

export function LoadingScreen({ onDone }) {
  const [currentStep, setCurrentStep] = useState(0)   // 0 = not started
  const [progress, setProgress]       = useState(0)
  const [done, setDone]               = useState(false)
  const [backendOk, setBackendOk]     = useState(null) // null | true | false
  const progressRef = useRef(0)
  const rafRef      = useRef(null)

  // Smooth progress bar animation
  const animateTo = (target, duration, onComplete) => {
    const start     = progressRef.current
    const startTime = performance.now()
    const tick = (now) => {
      const elapsed = now - startTime
      const t       = Math.min(elapsed / duration, 1)
      const eased   = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      const value   = start + (target - start) * eased
      progressRef.current = value
      setProgress(Math.round(value))
      if (t < 1) { rafRef.current = requestAnimationFrame(tick) }
      else        { onComplete?.() }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // Step 1: ping backend
      setCurrentStep(1)
      animateTo(10, 300, null)
      try {
        const r = await fetch('/health', { signal: AbortSignal.timeout(6000) })
        if (!cancelled) setBackendOk(r.ok)
      } catch {
        if (!cancelled) setBackendOk(false)
      }
      if (cancelled) return

      animateTo(20, 300, null)
      await delay(200)

      // Steps 2-5
      for (let i = 1; i < STEPS.length; i++) {
        if (cancelled) return
        setCurrentStep(i + 1)
        const targetPct = 20 + ((i) / (STEPS.length - 1)) * 78
        animateTo(targetPct, STEP_DURATIONS[i] + 100, null)
        await delay(STEP_DURATIONS[i])
      }

      if (cancelled) return
      animateTo(100, 300, null)
      await delay(320)
      setDone(true)
      await delay(500)
      if (!cancelled) onDone?.()
    }

    run()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.45, ease: 'easeIn' }}
          style={{
            position: 'fixed', inset: 0,
            background: C.bg,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {/* Scan line animation */}
          <div style={{
            position: 'absolute', inset: 0, overflow: 'hidden',
            pointerEvents: 'none', opacity: 0.03,
          }}>
            <motion.div
              animate={{ y: ['-100%', '100vh'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', left: 0, right: 0, height: 120,
                background: `linear-gradient(180deg, transparent 0%, ${C.cyan} 50%, transparent 100%)` }}
            />
          </div>

          <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Logo */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ fontSize: 22, fontWeight: 700, color: C.cyan,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  textShadow: `0 0 30px ${C.cyan}88`, marginBottom: 4 }}
              >
                ADAPT-Synthetix
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.22em', textTransform: 'uppercase' }}
              >
                Adaptive ASR · Phoneme Diagnostics · LoRA
              </motion.div>
            </div>

            {/* Steps list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STEPS.map((step, i) => {
                const state = i + 1 < currentStep ? 'done'
                            : i + 1 === currentStep ? 'active'
                            : 'pending'
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: state === 'pending' ? 0.3 : 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    {/* Step number / tick */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      background: state === 'done'   ? C.cyan
                                : state === 'active' ? 'transparent'
                                : 'transparent',
                      border: state === 'done'   ? `1px solid ${C.cyan}`
                            : state === 'active' ? `1px solid ${C.cyan}`
                            : `1px solid ${C.border}`,
                      color: state === 'done'   ? C.bg
                           : state === 'active' ? C.cyan
                           : C.textMuted,
                      boxShadow: state === 'active' ? `0 0 10px ${C.cyan}55` : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {state === 'done' ? '✓' : step.id}
                    </div>

                    {/* Label + detail */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 11, fontWeight: state === 'active' ? 600 : 400,
                        color: state === 'done'   ? C.textSecondary
                             : state === 'active' ? C.textPrimary
                             : C.textMuted,
                        transition: 'color 0.3s',
                      }}>
                        {step.label}
                        {state === 'active' && step.id === 1 && backendOk === false && (
                          <span style={{ color: C.amber, marginLeft: 8, fontSize: 9 }}>⚠ backend unreachable</span>
                        )}
                      </div>
                      <div style={{ fontSize: 8, color: C.textDim, marginTop: 1, letterSpacing: '0.05em' }}>
                        {step.detail}
                      </div>
                    </div>

                    {/* Active spinner */}
                    {state === 'active' && (
                      <div style={{
                        width: 10, height: 10,
                        border: `1.5px solid ${C.cyan}33`,
                        borderTop: `1.5px solid ${C.cyan}`,
                        borderRadius: '50%',
                        animation: 'spin 0.65s linear infinite',
                        flexShrink: 0,
                      }} />
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 8, color: C.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Initializing
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: progress === 100 ? C.green : C.cyan,
                  transition: 'color 0.3s',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {progress}%
                </span>
              </div>

              {/* Track */}
              <div style={{
                height: 3, background: C.border,
                borderRadius: 2, overflow: 'hidden',
              }}>
                <motion.div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: progress === 100
                      ? `linear-gradient(90deg, ${C.cyan}, ${C.green})`
                      : `linear-gradient(90deg, ${C.cyanDim}, ${C.cyan})`,
                    borderRadius: 2,
                    boxShadow: `0 0 8px ${C.cyan}88`,
                    transition: 'width 0.1s linear, background 0.4s',
                  }}
                />
              </div>

              {/* Tick marks */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {STEPS.map((s) => (
                  <div key={s.id} style={{
                    width: 1, height: 4,
                    background: (s.id / STEPS.length) * 100 <= progress ? C.cyan : C.border,
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
