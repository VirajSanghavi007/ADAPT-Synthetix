import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/store'
import { C } from '@/lib/theme'

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── Backdoor — triple-click the tiny dot top-right ────────────
function BackdoorTrigger() {
  const [clicks, setClicks] = useState(0)
  const [open, setOpen]     = useState(false)
  const [key, setKey]       = useState('')
  const [err, setErr]       = useState('')
  const nav = useNavigate()
  const qc  = useQueryClient()
  const timer = useRef(null)

  const handleClick = () => {
    clearTimeout(timer.current)
    const next = clicks + 1
    setClicks(next)
    if (next >= 3) { setOpen(true); setClicks(0); return }
    timer.current = setTimeout(() => setClicks(0), 800)
  }

  const submit = async () => {
    setErr('')
    const res = await fetch('/auth/backdoor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (!res.ok) { setErr('Invalid key'); return }
    await qc.invalidateQueries({ queryKey: ['auth_me'] })
    nav('/')
  }

  return (
    <>
      {/* Invisible-ish dot — tiny, greyed out, top-right */}
      <button
        onClick={handleClick}
        title=""
        style={{
          position: 'fixed', top: 12, right: 16,
          background: 'none', border: 'none', cursor: 'default',
          color: C.textDim, fontSize: 16, padding: 4,
          opacity: 0.2, userSelect: 'none',
        }}
      >·</button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: 28, width: 300,
          }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>Access key</div>
            <input
              autoFocus
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              style={{
                width: '100%', background: C.surfaceAlt,
                border: `1px solid ${err ? C.clay : C.border}`,
                borderRadius: 5, padding: '8px 10px',
                color: C.textPrimary, fontSize: 12,
                outline: 'none', fontFamily: 'inherit',
                marginBottom: 12,
              }}
            />
            {err && <div style={{ fontSize: 10, color: C.clay, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} style={{
                flex: 1, padding: '7px', background: C.teal, border: 'none',
                borderRadius: 5, color: '#0c0f14', fontWeight: 600,
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>Enter</button>
              <button onClick={() => { setOpen(false); setKey(''); setErr('') }} style={{
                flex: 1, padding: '7px', background: 'none',
                border: `1px solid ${C.border}`, borderRadius: 5,
                color: C.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Email sign-in form ────────────────────────────────────────
function EmailForm({ accepted }) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]    = useState('')
  const nav = useNavigate()
  const qc  = useQueryClient()

  const submit = async (e) => {
    e.preventDefault()
    if (!accepted) { setError('Accept the terms first'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), accepted_terms: accepted }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Sign-in failed'); return }
      await qc.invalidateQueries({ queryKey: ['auth_me'] })
      nav('/')
    } catch {
      setError('Network error — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 5, padding: '9px 12px', color: C.textPrimary,
    fontSize: 12, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        required value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        style={inputStyle}
        onFocus={(e) => e.target.style.borderColor = C.teal}
        onBlur={(e)  => e.target.style.borderColor = C.border}
      />
      <input
        required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        style={inputStyle}
        onFocus={(e) => e.target.style.borderColor = C.teal}
        onBlur={(e)  => e.target.style.borderColor = C.border}
      />
      {error && <div style={{ fontSize: 10, color: C.clay }}>{error}</div>}
      <button
        type="submit"
        disabled={loading || !accepted}
        style={{
          padding: '10px', background: accepted ? C.surfaceAlt : C.border,
          border: `1px solid ${accepted ? C.borderBright : C.border}`,
          borderRadius: 5, color: accepted ? C.textPrimary : C.textMuted,
          fontSize: 12, cursor: accepted ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        {loading ? 'Signing in…' : 'Continue with email →'}
      </button>
    </form>
  )
}

// ── Main login page ───────────────────────────────────────────
export default function Login() {
  const { visitCount } = useSessionStore()
  const returning = visitCount > 0
  const [accepted, setAccepted]   = useState(false)
  const [showEmail, setShowEmail] = useState(false)

  return (
    <div style={{
      height: '100vh', display: 'flex',
      background: C.bg,
      fontFamily: "'Cascadia Code','JetBrains Mono',monospace",
    }}>
      <BackdoorTrigger />

      {/* Left — branding */}
      <div style={{
        width: '44%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 56px',
        borderRight: `1px solid ${C.border}`,
      }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Hermes
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
            Adaptive closed-loop ASR · Phoneme diagnostics · Drift detection · LoRA fine-tuning.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { accent: C.teal,     label: 'Wav2Vec2 ASR',       desc: 'CTC confidence + token uncertainty' },
            { accent: C.forest,   label: 'Phoneme Diagnostics', desc: 'CUSUM drift · confusion matrix' },
            { accent: C.lavender, label: 'LoRA Fine-tuning',    desc: 'AdaLoRA · mixture of experts' },
            { accent: C.amber,    label: 'TTS Remediation',     desc: 'Bark-small · priority queue' },
          ].map((f) => (
            <div key={f.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 2, height: 32, background: f.accent, borderRadius: 2, flexShrink: 0, marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, marginBottom: 1 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — sign in */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 56 }}>
        <div style={{ width: '100%', maxWidth: 320 }}>

          {returning && (
            <div style={{
              fontSize: 10, color: C.teal, marginBottom: 20,
              padding: '5px 10px', background: C.tealGlow,
              borderRadius: 4, border: `1px solid ${C.teal}22`,
              display: 'inline-block',
            }}>↵ Welcome back</div>
          )}

          <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
            {returning ? 'Sign back in' : 'Sign in'}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 24 }}>
            {showEmail ? 'Enter your name and email' : 'Continue with your Google or Gmail account'}
          </div>

          {/* Terms acceptance — required before any sign-in */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            marginBottom: 20, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{ marginTop: 2, accentColor: C.teal, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: C.textSecondary, lineHeight: 1.6 }}>
              I agree to the{' '}
              <Link to="/terms" style={{ color: C.teal }}>Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" style={{ color: C.teal }}>Privacy Policy</Link>
            </span>
          </label>

          {/* Demo mode notice — email sign-in is unverified */}
          {showEmail && (
            <div style={{
              fontSize: 10, color: C.amber, marginBottom: 14,
              padding: '6px 10px', background: C.amber + '15',
              borderRadius: 4, border: `1px solid ${C.amber}44`,
            }}>
              Demo mode — email login is not verified. Any email/name is accepted.
            </div>
          )}

          {!showEmail ? (
            <>
              {/* Google sign-in */}
              <a
                href={accepted ? '/auth/login' : undefined}
                onClick={!accepted ? (e) => e.preventDefault() : undefined}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  width: '100%', padding: '11px',
                  background: accepted ? C.textPrimary : C.surfaceAlt,
                  color: accepted ? '#0c0f14' : C.textMuted,
                  borderRadius: 6, fontWeight: 600, fontSize: 12,
                  textDecoration: 'none', fontFamily: 'inherit',
                  cursor: accepted ? 'pointer' : 'not-allowed',
                  border: `1px solid ${accepted ? 'transparent' : C.border}`,
                  transition: 'all 0.15s',
                  marginBottom: 10,
                }}
              >
                <GoogleIcon />
                Continue with Google
              </a>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontSize: 9, color: C.textMuted }}>or</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>

              <button
                onClick={() => setShowEmail(true)}
                disabled={!accepted}
                style={{
                  width: '100%', padding: '10px',
                  background: 'none', border: `1px solid ${accepted ? C.border : C.border}`,
                  borderRadius: 6, color: accepted ? C.textSecondary : C.textMuted,
                  fontSize: 12, cursor: accepted ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                Sign in with email →
              </button>
            </>
          ) : (
            <>
              <EmailForm accepted={accepted} />
              <button
                onClick={() => setShowEmail(false)}
                style={{
                  background: 'none', border: 'none', color: C.textMuted,
                  fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                  marginTop: 12, padding: 0,
                }}
              >← Back to Google sign-in</button>
            </>
          )}

          {/* Supported accounts note */}
          {!showEmail && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
              {['Gmail', 'Google Workspace', 'Google One'].map((t) => (
                <span key={t} style={{
                  fontSize: 8, color: C.textMuted, padding: '2px 6px',
                  border: `1px solid ${C.border}`, borderRadius: 3,
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
