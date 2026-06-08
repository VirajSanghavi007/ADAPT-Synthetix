import { C } from '@/lib/theme'

/** Color a phoneme token by confidence + trend */
function tokenColor(conf, trend) {
  if (trend === 'degrading') return C.red
  if (conf > 0.75)           return C.green
  if (conf > 0.50)           return C.cyan
  if (conf > 0.30)           return C.amber
  return C.red
}

/**
 * PhonemeTokenStrip — inline strip of color-coded phoneme tokens.
 * Novelty: each chip color encodes confidence + drift trend simultaneously.
 */
export function PhonemeTokenStrip({ phonemes = [], style }) {
  if (!phonemes.length) return null
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4,
      padding: 10, background: C.surfaceAlt,
      borderRadius: 7, border: `1px solid ${C.border}`, ...style,
    }}>
      {phonemes.map((p, i) => {
        const c = tokenColor(p.confidence, p.trend)
        return (
          <span
            key={i}
            title={`/${p.token}/ — ${((p.confidence ?? 0) * 100).toFixed(0)}% conf`}
            style={{
              padding: '2px 5px', borderRadius: 3,
              background: c + '16', border: `1px solid ${c}33`,
              color: c, fontSize: 10, fontWeight: 600,
              cursor: 'default', letterSpacing: '0.04em',
            }}
          >{p.token}</span>
        )
      })}
    </div>
  )
}

/**
 * ConfusionMatrix — substitution frequency heatmap.
 * Research basis: DyPCL confusion matrix + POWER alignment.
 */
export function ConfusionMatrix({ errors = [] }) {
  const subs = errors.filter((e) => e.operation === 'substitution').slice(0, 16)
  if (!subs.length) return null

  const refs = [...new Set(subs.map((e) => e.reference_phoneme))].slice(0, 8)
  const hyps = [...new Set(subs.map((e) => e.hypothesis_phoneme))].slice(0, 8)
  const max  = Math.max(...subs.map((e) => e.count), 1)
  const lkp  = Object.fromEntries(subs.map((e) => [`${e.reference_phoneme}|${e.hypothesis_phoneme}`, e.count]))

  if (!refs.length || !hyps.length) return null
  const C_SZ = 34

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: 'max-content' }}>
        {/* Column labels */}
        <div style={{ display: 'flex', marginLeft: 44 }}>
          {hyps.map((h) => (
            <div key={h} style={{ width: C_SZ, textAlign: 'center', fontSize: 8, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        {refs.map((r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 40, fontSize: 8, color: C.textMuted, textAlign: 'right', paddingRight: 6, whiteSpace: 'nowrap' }}>{r}</div>
            {hyps.map((h) => {
              const n   = lkp[`${r}|${h}`] || 0
              const pct = n / max
              return (
                <div
                  key={h}
                  title={`${r} → ${h}: ${n}×`}
                  style={{
                    width: C_SZ, height: C_SZ,
                    background: n > 0 ? `rgba(255,68,68,${0.08 + pct * 0.82})` : C.surfaceAlt,
                    border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: pct > 0.4 ? '#fff' : C.textMuted,
                    cursor: 'default',
                  }}
                >{n > 0 ? n : ''}</div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: C.textMuted, marginTop: 6 }}>
        Substitution matrix — rows: reference, cols: hypothesis · 30% threshold flags systematic confusion (DyPCL/POWER)
      </div>
    </div>
  )
}
