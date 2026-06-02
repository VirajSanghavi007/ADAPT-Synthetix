/** Centralised design tokens — mirrors CSS custom properties in globals.css */

export const C = {
  bg:           '#080808',
  surface:      '#0f0f0f',
  surfaceAlt:   '#141414',
  surfaceHover: '#1a1a1a',
  border:       '#1e1e1e',
  borderBright: '#2a2a2a',

  cyan:         '#00e5ff',
  cyanDim:      '#00b8cc',
  cyanGlow:     'rgba(0,229,255,0.12)',
  cyanGlowLg:   'rgba(0,229,255,0.25)',

  green:        '#39ff14',
  greenDim:     '#2acc10',
  greenGlow:    'rgba(57,255,20,0.12)',

  red:          '#ff4444',
  redDim:       '#cc3333',
  redGlow:      'rgba(255,68,68,0.12)',

  amber:        '#ffb300',
  amberDim:     '#cc8f00',
  amberGlow:    'rgba(255,179,0,0.12)',

  purple:       '#bf5fff',
  purpleGlow:   'rgba(191,95,255,0.12)',

  textPrimary:  '#e8e8e8',
  textSecondary:'#888888',
  textMuted:    '#444444',
  textDim:      '#2a2a2a',
}

export const errorColor = {
  clean:        C.green,
  noise:        C.amber,
  accent:       C.purple,
  pronunciation:C.red,
  unknown:      C.textSecondary,
}

export const errorGlow = {
  clean:        C.greenGlow,
  noise:        C.amberGlow,
  accent:       C.purpleGlow,
  pronunciation:C.redGlow,
  unknown:      'rgba(136,136,136,0.08)',
}

export const statusColor = {
  pending:    C.amber,
  processing: C.cyan,
  completed:  C.green,
}

export const trendColor = {
  degrading: C.red,
  improving: C.green,
  stable:    C.textSecondary,
}

export const font = `'JetBrains Mono', 'Fira Code', monospace`

export const shadow = {
  card:  '0 4px 32px rgba(0,0,0,0.7)',
  glow:  (c) => `0 0 24px ${c}`,
  glowSm:(c) => `0 0 10px ${c}`,
}

export const radius = { sm: '4px', md: '8px', lg: '12px' }
