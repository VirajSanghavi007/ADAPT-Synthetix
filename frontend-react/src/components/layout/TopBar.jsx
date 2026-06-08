import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getHealth } from '@/lib/api'
import { useUIStore } from '@/store'
import { C } from '@/lib/theme'
import { Command, Search } from 'lucide-react'

const TITLES = {
  '/':           'Dashboard',
  '/transcribe': 'Transcribe',
  '/analytics':  'Analytics',
  '/phonemes':   'Phoneme Explorer',
  '/queue':      'Priority Queue',
  '/history':    'History',
  '/models':     'Model Hub',
}

export function TopBar() {
  const { pathname } = useLocation()
  const setPalette   = useUIStore((s) => s.setPalette)

  const { data: health } = useQuery({
    queryKey:        ['health'],
    queryFn:         getHealth,
    refetchInterval: 30_000,
  })

  const online = health?.status === 'healthy'
  const title  = TITLES[pathname] ?? ''

  return (
    <div style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      borderBottom: `1px solid ${C.border}`,
      background: C.bg,
      flexShrink: 0,
      gap: 16,
    }}>
      {/* Page title */}
      <h1 style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search / command palette trigger */}
        <button
          onClick={() => setPalette(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            color: C.textMuted,
            cursor: 'pointer',
            minWidth: 180,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = C.borderBright}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
        >
          <Search size={12} />
          <span style={{ flex: 1, textAlign: 'left' }}>Jump to…</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 2,
            fontSize: 10, color: C.textDim,
            border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 4px',
            fontFamily: 'ui-monospace, monospace',
          }}>
            <Command size={9} /> K
          </span>
        </button>

        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: online ? C.green : C.red,
            display: 'inline-block',
            animation: online ? 'pulse-dot 2.5s infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: online ? C.textSecondary : C.red }}>
            {online ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  )
}
