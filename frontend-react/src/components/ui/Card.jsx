import { memo } from 'react'
import { C, radius, shadow } from '@/lib/theme'

export const Card = memo(function Card({ children, style, glow, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   C.surface,
        border:       `1px solid ${glow ? glow + '55' : C.border}`,
        borderRadius: radius.lg,
        boxShadow:    glow ? shadow.glow(glow + '22') : shadow.card,
        transition:   'border-color 0.2s, box-shadow 0.2s',
        cursor:       onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
})

export const CardHeader = memo(function CardHeader({ title, subtitle, right, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <div style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: accent || C.cyan, marginBottom: 2,
        }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: C.textMuted }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
})

export const CardBody = memo(function CardBody({ children, style }) {
  return <div style={{ padding: '16px 20px', ...style }}>{children}</div>
})
