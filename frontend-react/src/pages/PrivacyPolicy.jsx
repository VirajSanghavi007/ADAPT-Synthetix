import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { C } from '@/lib/theme'

const S = {
  h2: { fontSize: 14, fontWeight: 700, color: C.textPrimary, margin: '28px 0 10px', letterSpacing: '-0.01em' },
  p:  { fontSize: 12, color: C.textSecondary, lineHeight: 1.8, marginBottom: 12 },
  li: { fontSize: 12, color: C.textSecondary, lineHeight: 1.8, marginBottom: 6, marginLeft: 16 },
}

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: "'Cascadia Code','JetBrains Mono',monospace" }}>
      <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted, marginBottom: 32, textDecoration: 'none' }}>
        <ArrowLeft size={12} /> Back to sign in
      </Link>

      <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.02em', marginBottom: 6 }}>
        Privacy Policy
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 36 }}>
        Effective date: 1 June 2025 · Last updated: 1 June 2025
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>

        <h2 style={S.h2}>1. Who we are</h2>
        <p style={S.p}>Mercury ("we", "our", "the service") is a research-grade speech processing platform developed as an independent research project. We are not a commercial entity.</p>

        <h2 style={S.h2}>2. What data we collect</h2>
        <p style={S.p}>When you sign in with Google we receive from Google:</p>
        <ul>
          <li style={S.li}>Your name</li>
          <li style={S.li}>Your email address</li>
          <li style={S.li}>Your Google profile picture URL</li>
        </ul>
        <p style={S.p}>When you sign in with email we collect:</p>
        <ul>
          <li style={S.li}>The name and email address you provide (unverified)</li>
        </ul>
        <p style={S.p}>When you use the service we store locally on your device:</p>
        <ul>
          <li style={S.li}>Your transcription results (in browser localStorage)</li>
          <li style={S.li}>Reference transcripts you enter</li>
          <li style={S.li}>Your navigation history within the app</li>
          <li style={S.li}>Phoneme diagnostic data generated from your audio</li>
          <li style={S.li}>Visit count and timestamps</li>
        </ul>

        <h2 style={S.h2}>3. Audio data</h2>
        <p style={S.p}>Audio files you upload or record are processed locally on the server running Mercury. Audio files are stored temporarily during processing and then moved to a local data directory on the host machine. <strong style={{ color: C.textPrimary }}>Audio data is never transmitted to third parties.</strong></p>

        <h2 style={S.h2}>4. How we use your data</h2>
        <p style={S.p}>Your name and email are used solely to:</p>
        <ul>
          <li style={S.li}>Identify your session</li>
          <li style={S.li}>Display your name in the application</li>
          <li style={S.li}>Associate transcription sessions with your account</li>
        </ul>
        <p style={S.p}>We do not use your data for advertising, analytics platforms, or any commercial purpose.</p>

        <h2 style={S.h2}>5. Data storage and retention</h2>
        <p style={S.p}>Authentication sessions are stored as signed cookies that expire after 7 days. Transcription data is stored in a SQLite database on the host machine. You may request deletion of your data at any time by contacting the administrator.</p>

        <h2 style={S.h2}>6. Third-party services</h2>
        <p style={S.p}>If you choose Google Sign-In, your browser communicates with Google's OAuth servers. This is governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: C.teal }}>Google's Privacy Policy</a>. We have no control over data processed by Google during the OAuth flow.</p>
        <p style={S.p}>We use no advertising networks, analytics SDKs, or data brokers.</p>

        <h2 style={S.h2}>7. Cookies</h2>
        <p style={S.p}>We set one httpOnly session cookie (<code style={{ color: C.teal }}>mercury_session</code>) used exclusively for authentication. We also use browser localStorage to persist your preferences and session state locally. No third-party cookies are set.</p>

        <h2 style={S.h2}>8. Your rights</h2>
        <p style={S.p}>You may at any time: sign out to invalidate your session, clear localStorage to remove local preferences, or contact the administrator to delete your account data from the server.</p>

        <h2 style={S.h2}>9. Changes to this policy</h2>
        <p style={S.p}>We may update this policy. Continued use of the service after changes constitutes acceptance of the revised policy. The effective date at the top will reflect any updates.</p>

        <h2 style={S.h2}>10. Contact</h2>
        <p style={S.p}>Questions about this policy can be directed to the repository owner via the project's GitHub page.</p>

      </div>
    </div>
  )
}
