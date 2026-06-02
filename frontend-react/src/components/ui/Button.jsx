import { useState } from 'react'
import { C, radius } from '@/lib/theme'

const variants = {
  primary: { bg: C.cyan,     color: '#000',         border: 'none',                   hoverShadow: `0 0 16px ${C.cyanGlow}` },
  ghost:   { bg: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, hoverShadow: 'none' },
  danger:  { bg: C.redGlow,  color: C.red,          border: `1px solid ${C.red}33`,   hoverShadow: 'none' },
  success: { bg: C.greenGlow,color: C.green,        border: `1px solid ${C.green}33`, hoverShadow: 'none' },
}

const sizes = {
  sm: { padding: '5px 12px', fontSize: 10 },
  md: { padding: '8px 18px', fontSize: 11 },
  lg: { padding: '12px 28px', fontSize: 12 },
}

export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, loading, style, icon }) {
  const [hovered, setHovered] = useState(false)
  const v = variants[variant] ?? variants.primary
  const s = sizes[size]       ?? sizes.md

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           6,
        borderRadius:  radius.sm,
        fontWeight:    600,
        letterSpacing: '0.06em',
        fontFamily:    'inherit',
        transition:    'all 0.15s ease',
        outline:       'none',
        background:    v.bg,
        color:         v.color,
        border:        v.border,
        boxShadow:     hovered && !disabled ? v.hoverShadow : 'none',
        ...s,
        ...style,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>{icon}</span>}
      {loading ? '…' : children}
    </button>
  )
}
