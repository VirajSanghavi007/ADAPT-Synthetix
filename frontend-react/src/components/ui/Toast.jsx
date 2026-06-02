import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useUIStore } from '@/store'
import { C, radius } from '@/lib/theme'

const ICON = {
  success: <CheckCircle size={13} color={C.green} />,
  error:   <AlertCircle size={13} color={C.red} />,
  info:    <Info size={13} color={C.cyan} />,
}

const ACCENT = {
  success: C.green,
  error:   C.red,
  info:    C.cyan,
}

export function ToastContainer() {
  const { toasts, dismissToast } = useUIStore()

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 48, scale: 0.94 }}
            animate={{ opacity: 1, x:  0, scale: 1 }}
            exit={{    opacity: 0, x: 48, scale: 0.94 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              padding:     '9px 13px',
              background:  C.surfaceAlt,
              border:      `1px solid ${ACCENT[t.type] || C.border}`,
              borderLeft:  `3px solid ${ACCENT[t.type] || C.cyan}`,
              borderRadius: radius.md,
              boxShadow:   '0 4px 24px rgba(0,0,0,0.7)',
              minWidth:    210,
              maxWidth:    340,
              fontSize:    11,
              color:       C.textPrimary,
              pointerEvents: 'auto',
            }}
          >
            {ICON[t.type]}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}
            >
              <X size={11} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
