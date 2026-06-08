/**
 * Design tokens — GitHub-inspired professional dark palette.
 *
 * Inspired by: GitHub dark mode, Linear, Vercel, Railway.
 * Looks like real software built by a team, not AI-generated.
 *
 * Key rules:
 *  - System sans-serif for body text (not monospace)
 *  - Monospace only for code / transcription text / data
 *  - Single blue accent (trustworthy, professional)
 *  - No glow effects — flat cards with subtle borders
 *  - Colors from GitHub's actual design system
 */

export const C = {
  // ── Backgrounds ────────────────────────────────────────────
  bg:           '#0d1117',   // GitHub dark bg
  surface:      '#161b22',   // card background
  surfaceAlt:   '#21262d',   // input / secondary surface
  surfaceHover: '#30363d',   // hover state
  border:       '#30363d',   // standard border
  borderBright: '#484f58',   // active / hover border

  // ── Primary — Blue (professional, trustworthy) ─────────────
  blue:         '#58a6ff',   // GitHub blue — link/accent
  blueHover:    '#79c0ff',
  blueDim:      'rgba(31,111,235,0.15)',
  blueBg:       '#1f6feb',   // solid button bg

  // ── Semantic ───────────────────────────────────────────────
  green:        '#3fb950',   // GitHub green — success
  greenDim:     'rgba(35,134,54,0.15)',
  greenSolid:   '#238636',

  red:          '#f85149',   // GitHub red — error/danger
  redDim:       'rgba(248,81,73,0.15)',

  amber:        '#d29922',   // GitHub yellow — warning
  amberDim:     'rgba(187,128,9,0.15)',

  purple:       '#bc8cff',   // GitHub purple — accent
  purpleDim:    'rgba(188,140,255,0.15)',

  // ── Text ───────────────────────────────────────────────────
  textPrimary:  '#e6edf3',   // GitHub primary text
  textSecondary:'#8b949e',   // secondary / muted
  textMuted:    '#6e7681',   // very muted
  textDim:      '#484f58',   // near-invisible

  // ── Semantic aliases — keeps existing pages working ────────
  // Old neon names now map to the clean palette
  teal:         '#58a6ff',
  tealDim:      '#1f6feb',
  tealGlow:     'rgba(31,111,235,0.12)',
  tealGlowLg:   'rgba(31,111,235,0.20)',

  forest:       '#3fb950',
  forestDim:    '#238636',
  forestGlow:   'rgba(35,134,54,0.12)',

  clay:         '#f85149',
  clayDim:      '#da3633',
  clayGlow:     'rgba(248,81,73,0.12)',

  lavender:     '#bc8cff',
  lavenderGlow: 'rgba(188,140,255,0.12)',

  cyan:         '#58a6ff',
  cyanDim:      '#1f6feb',
  cyanGlow:     'rgba(31,111,235,0.12)',
  cyanGlowLg:   'rgba(31,111,235,0.20)',

  greenDimOld:  '#238636',
  greenGlow:    'rgba(35,134,54,0.12)',
  redDimOld:    '#da3633',
  redGlow:      'rgba(248,81,73,0.12)',
  purpleGlow:   'rgba(188,140,255,0.12)',

  // Glow values used in the old pages — now neutral/flat
  amberGlow:    'rgba(210,153,34,0.12)',
}

// ── Semantic colour maps ────────────────────────────────────
export const errorColor = {
  clean:         C.green,
  noise:         C.amber,
  accent:        C.purple,
  pronunciation: C.red,
  unknown:       C.textSecondary,
}

export const errorGlow = {
  clean:         C.greenDim,
  noise:         C.amberDim,
  accent:        C.purpleDim,
  pronunciation: C.redDim,
  unknown:       'rgba(139,148,158,0.08)',
}

export const statusColor = {
  pending:    C.amber,
  processing: C.blue,
  completed:  C.green,
}

export const trendColor = {
  degrading: C.red,
  improving: C.green,
  stable:    C.textSecondary,
}

// ── Typography ────────────────────────────────────────────────
// Body text uses system sans-serif — NOT monospace
// Monospace is reserved for code, transcription output, and data values
export const font = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
export const fontMono = `ui-monospace, "Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`

export const shadow = {
  card:   '0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)',
  sm:     '0 1px 2px rgba(0,0,0,0.3)',
  glow:   () => 'none',   // no glows in new design
  glowSm: () => 'none',
}

export const radius = { sm: '6px', md: '6px', lg: '8px' }
