import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useUIStore } from '@/store'
import { C } from '@/lib/theme'

const VARIANTS = {
  success: { icon: CheckCircle2, color: C.green  },
  error:   { icon: AlertCircle,  color: C.red    },
  info:    { icon: Info,         color: C.blue   },
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
        {toasts.map((t) => {
          const v = VARIANTS[t.type] ?? VARIANTS.info
          const Icon = v.icon
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1     }}
              exit={{    opacity: 0, y: 4, scale: 0.96  }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          10,
                padding:      '10px 14px',
                background:   C.surface,
                border:       `1px solid ${C.border}`,
                borderLeft:   `3px solid ${v.color}`,
                borderRadius: 8,
                boxShadow:    '0 8px 24px rgba(0,0,0,0.5)',
                minWidth:     240,
                maxWidth:     360,
                fontSize:     13,
                color:        C.textPrimary,
                pointerEvents:'auto',
              }}
            >
              <Icon size={15} color={v.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ flex: 1, lineHeight: 1.5 }}>{t.message}</span>
              <button
                onClick={() => dismissToast(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.textMuted, padding: 0, display: 'flex', flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
