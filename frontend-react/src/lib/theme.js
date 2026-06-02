/**
 * Design tokens — Natural dark palette.
 *
 * Guidelines applied:
 *  • UX Planet "Natural Palettes": varied saturation, dark+light contrast pairs,
 *    no all-neon colours — inspired by night sky, deep ocean, forest, earth.
 *  • Wix colour schemes: one strong primary, muted neutrals, intentional accents.
 *  • Not pure black/white — backgrounds carry a faint hue (more natural, easier on eyes).
 *
 * Palette inspiration:
 *   bg/surface  → midnight ocean depth   (near-black with cool undertone)
 *   teal        → deep bioluminescent sea (primary — replaces electric cyan)
 *   forest      → old-growth forest green (replaces neon lime)
 *   clay        → terracotta / sunset     (replaces pure red)
 *   amber       → autumn honey            (replaces saturated yellow-orange)
 *   lavender    → twilight sky            (replaces electric purple)
 *   text        → moonlit blue-grey       (replaces pure white)
 */

export const C = {
  // ── Backgrounds ────────────────────────────────────────────
  bg:           '#0c0f14',   // deep midnight — not pure black, cool undertone
  surface:      '#121820',   // dark navy surface
  surfaceAlt:   '#18212e',   // slightly raised surface
  surfaceHover: '#1e2a3a',   // hover state
  border:       '#1e2d3d',   // subtle blue-grey border
  borderBright: '#2a3d52',   // visible border

  // ── Primary — Teal (deep ocean / bioluminescence) ──────────
  teal:         '#3ecfbd',   // muted teal, not electric — natural deep-water hue
  tealDim:      '#2eaa9b',
  tealGlow:     'rgba(62,207,189,0.13)',
  tealGlowLg:   'rgba(62,207,189,0.25)',

  // ── Success — Forest green (old-growth, sage) ──────────────
  forest:       '#52c98a',   // natural forest green, not neon
  forestDim:    '#3daa70',
  forestGlow:   'rgba(82,201,138,0.13)',

  // ── Danger — Terracotta / Clay (earth, sunset) ─────────────
  clay:         '#d97b5e',   // warm terracotta — earthy, not screaming red
  clayDim:      '#be6348',
  clayGlow:     'rgba(217,123,94,0.13)',

  // ── Warning — Amber (autumn honey, golden hour) ────────────
  amber:        '#c9943a',   // warm earthy amber, not saturated yellow
  amberDim:     '#a87a2a',
  amberGlow:    'rgba(201,148,58,0.13)',

  // ── Accent 2 — Lavender (twilight, soft violet) ────────────
  lavender:     '#8f82c7',   // muted lavender — twilight sky, not electric purple
  lavenderGlow: 'rgba(143,130,199,0.13)',

  // ── Text — Moonlit blue-grey (not pure white) ──────────────
  textPrimary:  '#cdd6e0',   // pale blue-grey — natural moonlight tone
  textSecondary:'#6d849a',   // muted mid-tone
  textMuted:    '#354656',   // subtle, barely-there
  textDim:      '#1c2d3c',   // near-invisible tint

  // ── Semantic aliases (keep existing code working) ──────────
  // Maps old cyan/green/red/purple/amber → new natural equivalents
  cyan:         '#3ecfbd',
  cyanDim:      '#2eaa9b',
  cyanGlow:     'rgba(62,207,189,0.13)',
  cyanGlowLg:   'rgba(62,207,189,0.25)',

  green:        '#52c98a',
  greenDim:     '#3daa70',
  greenGlow:    'rgba(82,201,138,0.13)',

  red:          '#d97b5e',
  redDim:       '#be6348',
  redGlow:      'rgba(217,123,94,0.13)',

  purple:       '#8f82c7',
  purpleGlow:   'rgba(143,130,199,0.13)',
}

// ── Semantic colour maps ────────────────────────────────────
export const errorColor = {
  clean:        C.forest,
  noise:        C.amber,
  accent:       C.lavender,
  pronunciation:C.clay,
  unknown:      C.textSecondary,
}

export const errorGlow = {
  clean:        C.forestGlow,
  noise:        C.amberGlow,
  accent:       C.lavenderGlow,
  pronunciation:C.clayGlow,
  unknown:      'rgba(109,132,154,0.08)',
}

export const statusColor = {
  pending:    C.amber,
  processing: C.teal,
  completed:  C.forest,
}

export const trendColor = {
  degrading: C.clay,
  improving: C.forest,
  stable:    C.textSecondary,
}

// ── Font — system-first monospace (no external download) ────
export const font = `'Cascadia Code', 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, Consolas, 'Courier New', monospace`

export const shadow = {
  card:   '0 4px 24px rgba(0,0,0,0.5)',
  glow:   (c) => `0 0 20px ${c}`,
  glowSm: (c) => `0 0 8px ${c}`,
}

export const radius = { sm: '4px', md: '8px', lg: '10px' }
