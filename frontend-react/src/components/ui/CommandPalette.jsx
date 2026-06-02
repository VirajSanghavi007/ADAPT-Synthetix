import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Mic, BarChart2, Zap,
  ListOrdered, History, Cpu, Search, X,
} from 'lucide-react'
import { useUIStore } from '@/store'
import { C, radius } from '@/lib/theme'

const COMMANDS = [
  { label: 'Dashboard',       route: '/',           icon: LayoutDashboard, key: 'd' },
  { label: 'Transcribe',      route: '/transcribe',  icon: Mic,             key: 't' },
  { label: 'Analytics',       route: '/analytics',   icon: BarChart2,       key: 'a' },
  { label: 'Phoneme Explorer',route: '/phonemes',    icon: Zap,             key: 'p' },
  { label: 'Priority Queue',  route: '/queue',       icon: ListOrdered,     key: 'q' },
  { label: 'History',         route: '/history',     icon: History,         key: 'h' },
  { label: 'Model Hub',       route: '/models',      icon: Cpu,             key: 'm' },
]

export function CommandPalette() {
  const open      = useUIStore((s) => s.paletteOpen)
  const setPalette = useUIStore((s) => s.setPalette)
  const navigate  = useNavigate()
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef  = useRef(null)

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.key === query.toLowerCase()
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const select = (route) => {
    setPalette(false)
    navigate(route)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); filtered[active] && select(filtered[active].route) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, active, filtered])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPalette(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 8000 }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y:   0, scale: 1 }}
            exit={{   opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: '22%', left: '50%', transform: 'translateX(-50%)',
              width: 480,
              background: C.surfaceAlt,
              border: `1px solid ${C.borderBright}`,
              borderRadius: radius.lg,
              boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px ${C.cyan}11`,
              zIndex: 8001,
              overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <Search size={14} color={C.textMuted} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                placeholder="Go to page…"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: C.textPrimary, fontSize: 13, fontFamily: 'inherit',
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Results */}
            <div style={{ padding: 6, maxHeight: 320, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: C.textMuted }}>No results</div>
              )}
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.route}
                    onClick={() => select(cmd.route)}
                    onMouseEnter={() => setActive(i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 10, padding: '10px 12px', borderRadius: 6,
                      background: i === active ? C.cyanGlow : 'transparent',
                      border: `1px solid ${i === active ? C.cyan + '22' : 'transparent'}`,
                      color: i === active ? C.cyan : C.textSecondary,
                      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={13} style={{ opacity: 0.7 }} />
                      {cmd.label}
                    </span>
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3,
                      border: `1px solid ${C.border}`, color: C.textMuted,
                    }}>
                      {cmd.key}
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{
              borderTop: `1px solid ${C.border}`,
              padding: '6px 16px',
              display: 'flex', gap: 16, fontSize: 9, color: C.textMuted,
            }}>
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>Esc close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
