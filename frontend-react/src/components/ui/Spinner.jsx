import { C } from '@/lib/theme'

export function Spinner({ size = 20, color }) {
  const c = color || C.cyan
  return (
    <div
      aria-label="Loading"
      style={{
        width: size, height: size,
        border: `2px solid ${c}22`,
        borderTop: `2px solid ${c}`,
        borderRadius: '50%',
        animation: 'spin 0.65s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

export function LoadingOverlay({ message = 'Loading…' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: 48,
      color: C.textSecondary, fontSize: 11,
    }}>
      <Spinner />
      <span>{message}</span>
    </div>
  )
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 56,
      color: C.textSecondary, textAlign: 'center',
    }}>
      {icon && <div style={{ opacity: 0.25, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 12, color: C.textSecondary }}>{title}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted }}>{sub}</div>}
    </div>
  )
}

export function PageLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg,
      zIndex: 9000,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          ADAPT
        </div>
        <Spinner size={28} />
      </div>
    </div>
  )
}
