import { C, errorColor, errorGlow, statusColor, trendColor, radius } from '@/lib/theme'

const presets = {
  clean:        { color: C.green,         bg: C.greenGlow },
  noise:        { color: C.amber,         bg: C.amberGlow },
  accent:       { color: C.purple,        bg: C.purpleGlow },
  pronunciation:{ color: C.red,           bg: C.redGlow },
  pending:      { color: C.amber,         bg: C.amberGlow },
  processing:   { color: C.cyan,          bg: C.cyanGlow },
  completed:    { color: C.green,         bg: C.greenGlow },
  degrading:    { color: C.red,           bg: C.redGlow },
  improving:    { color: C.green,         bg: C.greenGlow },
  stable:       { color: C.textSecondary, bg: 'rgba(136,136,136,0.08)' },
  medical:      { color: C.cyan,          bg: C.cyanGlow },
  emergency:    { color: C.red,           bg: C.redGlow },
}

export function Badge({ label, preset, color, bg, dot, style }) {
  const p = presets[preset] ?? {}
  const c = color || p.color || C.textSecondary
  const b = bg    || p.bg    || 'rgba(136,136,136,0.08)'

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      padding:       '2px 7px',
      borderRadius:  radius.sm,
      background:    b,
      border:        `1px solid ${c}33`,
      color:         c,
      fontSize:      9,
      fontWeight:    600,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      whiteSpace:    'nowrap',
      ...style,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />}
      {label}
    </span>
  )
}
