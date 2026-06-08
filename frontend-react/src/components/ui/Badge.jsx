import { C } from '@/lib/theme'

const presets = {
  clean:         { color: C.green,         bg: C.greenDim },
  noise:         { color: C.amber,         bg: C.amberDim },
  accent:        { color: C.purple,        bg: C.purpleDim },
  pronunciation: { color: C.red,           bg: C.redDim },
  pending:       { color: C.amber,         bg: C.amberDim },
  processing:    { color: C.blue,          bg: C.blueDim },
  completed:     { color: C.green,         bg: C.greenDim },
  degrading:     { color: C.red,           bg: C.redDim },
  improving:     { color: C.green,         bg: C.greenDim },
  stable:        { color: C.textSecondary, bg: 'rgba(139,148,158,0.1)' },
  medical:       { color: C.blue,          bg: C.blueDim },
  emergency:     { color: C.red,           bg: C.redDim },
}

export function Badge({ label, preset, color, bg, dot, style }) {
  const p = presets[preset] ?? {}
  const c = color || p.color || C.textSecondary
  const b = bg    || p.bg    || 'rgba(139,148,158,0.1)'

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           5,
      padding:       '2px 8px',
      borderRadius:  20,
      background:    b,
      color:         c,
      fontSize:      11,
      fontWeight:    500,
      whiteSpace:    'nowrap',
      lineHeight:    1.6,
      ...style,
    }}>
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
      )}
      {label}
    </span>
  )
}
