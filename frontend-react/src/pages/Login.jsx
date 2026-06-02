import { C } from '@/lib/theme'

// Google "G" SVG inline — no external icon dep
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function Login() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: C.bg,
      fontFamily: "'Cascadia Code','JetBrains Mono',monospace",
    }}>
      {/* Left panel — brand */}
      <div style={{
        width: '45%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 64px',
        borderRight: `1px solid ${C.border}`,
      }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.02em', marginBottom: 8 }}>
            ADAPT-Synthetix
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
            Adaptive closed-loop ASR with phoneme diagnostics, drift detection, and LoRA fine-tuning.
          </div>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { accent: C.teal,     label: 'Wav2Vec2 ASR',     desc: 'CTC confidence + token uncertainty' },
            { accent: C.forest,   label: 'Phoneme Diagnostics', desc: 'CUSUM drift · confusion matrix' },
            { accent: C.lavender, label: 'LoRA Fine-tuning', desc: 'AdaLoRA · mixture of experts' },
            { accent: C.amber,    label: 'TTS Remediation',  desc: 'Bark-small · priority queue' },
          ].map((f) => (
            <div key={f.label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 3, height: 36, background: f.accent, borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — sign in */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: 60,
      }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
            Sign in
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 36 }}>
            Use your Google account to access the dashboard
          </div>

          <a
            href="/auth/login"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '12px 20px',
              background: C.textPrimary,
              color: '#0c0f14',
              borderRadius: 8, fontWeight: 600, fontSize: 13,
              textDecoration: 'none',
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <GoogleIcon />
            Continue with Google
          </a>

          <div style={{ marginTop: 24, fontSize: 10, color: C.textDim, lineHeight: 1.6, textAlign: 'center' }}>
            By signing in you agree to our terms of service.
            <br />Your data is not shared with third parties.
          </div>
        </div>
      </div>
    </div>
  )
}
