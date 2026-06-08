import { memo } from 'react'
import { C } from '@/lib/theme'

export const Card = memo(function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   C.surface,
        border:       `1px solid ${C.border}`,
        borderRadius: 8,
        transition:   'border-color 0.15s',
        cursor:       onClick ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = C.borderBright } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = C.border } : undefined}
    >
      {children}
    </div>
  )
})

export const CardHeader = memo(function CardHeader({ title, subtitle, right }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
})

export const CardBody = memo(function CardBody({ children, style }) {
  return (
    <div style={{ padding: '14px 16px', ...style }}>
      {children}
    </div>
  )
})
