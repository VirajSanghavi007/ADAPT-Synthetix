import { AnimatePresence, motion } from 'framer-motion'
import { useSessionStore } from '@/store'
import { C } from '@/lib/theme'

export function CookieBanner() {
  const { cookieConsentDismissed, dismissCookieConsent } = useSessionStore()

  return (
    <AnimatePresence>
      {!cookieConsentDismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
          exit={{   opacity: 0, y: 20 }}
          transition={{ duration: 0.25, delay: 1.5 }}
          style={{
            position: 'fixed', bottom: 20, left: 20,
            maxWidth: 360,
            background: C.surfaceAlt,
            border: `1px solid ${C.borderBright}`,
            borderRadius: 10,
            padding: '14px 18px',
            zIndex: 8000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.6, marginBottom: 12 }}>
            We use cookies and localStorage to remember your session, last visited page, reference transcripts, and preferences.
            No tracking or advertising. Your audio data stays local.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={dismissCookieConsent}
              style={{
                padding: '6px 14px', borderRadius: 5,
                background: C.teal, border: 'none',
                color: '#0c0f14', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Got it
            </button>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); dismissCookieConsent() }}
              style={{ fontSize: 10, color: C.textMuted, alignSelf: 'center', textDecoration: 'underline' }}
            >
              Decline optional
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
