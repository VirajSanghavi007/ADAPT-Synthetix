import { C } from '@/lib/theme'

const variants = {
  primary: {
    background: C.blueBg,
    color: '#fff',
    border: `1px solid transparent`,
    hover: { background: '#388bfd', borderColor: 'transparent' },
  },
  secondary: {
    background: C.surfaceAlt,
    color: C.textSecondary,
    border: `1px solid ${C.border}`,
    hover: { background: C.surfaceHover, color: C.textPrimary, borderColor: C.borderBright },
  },
  ghost: {
    background: 'transparent',
    color: C.textSecondary,
    border: `1px solid transparent`,
    hover: { background: C.surfaceAlt, color: C.textPrimary, borderColor: C.border },
  },
  danger: {
    background: C.redDim,
    color: C.red,
    border: `1px solid rgba(248,81,73,0.3)`,
    hover: { background: 'rgba(248,81,73,0.2)', borderColor: C.red },
  },
  success: {
    background: C.greenDim,
    color: C.green,
    border: `1px solid rgba(63,185,80,0.3)`,
    hover: { background: 'rgba(63,185,80,0.2)', borderColor: C.green },
  },
}

const sizes = {
  sm: { padding: '4px 10px',  fontSize: 12 },
  md: { padding: '6px 14px',  fontSize: 13 },
  lg: { padding: '9px 20px',  fontSize: 14 },
}

export function Button({
  children, variant = 'primary', size = 'md',
  onClick, disabled, loading, style, icon,
}) {
  const v = variants[variant] ?? variants.primary
  const s = sizes[size] ?? sizes.md

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 6,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        outline: 'none',
        background: v.background,
        color: v.color,
        border: v.border,
        ...s,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading && v.hover) {
          Object.assign(e.currentTarget.style, {
            background: v.hover.background,
            color: v.hover.color || v.color,
            borderColor: v.hover.borderColor,
          })
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, {
            background: v.background,
            color: v.color,
            borderColor: '',
          })
        }
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>{icon}</span>}
      {loading ? '…' : children}
    </button>
  )
}
