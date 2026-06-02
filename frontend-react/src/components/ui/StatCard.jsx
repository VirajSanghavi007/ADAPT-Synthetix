import { motion } from 'framer-motion'
import { C, radius, shadow } from '@/lib/theme'

export function StatCard({ label, value, sub, accent, icon, trend }) {
  const c = accent || C.cyan
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y:  0 }}
      transition={{ duration: 0.3 }}
      style={{
        background:   C.surface,
        border:       `1px solid ${C.border}`,
        borderTop:    `2px solid ${c}`,
        borderRadius: radius.lg,
        padding:      '18px 20px',
        boxShadow:    shadow.card,
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* top glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 48,
        background: `linear-gradient(180deg, ${c}0c 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: c }}>
          {label}
        </div>
        {icon && <div style={{ color: c, opacity: 0.45 }}>{icon}</div>}
      </div>

      <div style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, lineHeight: 1, marginBottom: 6 }}>
        {value ?? '—'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sub && <div style={{ fontSize: 10, color: C.textMuted }}>{sub}</div>}
        {trend !== undefined && (
          <div style={{ fontSize: 9, color: trend >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        )}
      </div>
    </motion.div>
  )
}
