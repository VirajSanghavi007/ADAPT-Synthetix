import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getHealth } from '@/lib/api'
import { useUIStore } from '@/store'
import { C } from '@/lib/theme'
import { Command } from 'lucide-react'

const TITLES = {
  '/':           'Dashboard',
  '/transcribe': 'Transcribe',
  '/analytics':  'Analytics',
  '/phonemes':   'Phoneme Explorer',
  '/queue':      'Queue',
  '/history':    'History',
  '/models':     'Models',
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

  return (
    <div style={{
      height: 44,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: '0.06em' }}>
        {TITLES[pathname] ?? ''}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Cmd+K */}
        <button
          onClick={() => setPalette(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 4, padding: '3px 8px',
            fontSize: 9, color: C.textMuted, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Command size={9} /> K
        </button>

        {/* Session ID */}
        <span style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.08em' }}>
          {health?.session_id?.slice(0, 8)}
        </span>

        {/* Status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: online ? C.forest : C.clay }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: online ? C.forest : C.clay,
            boxShadow: online ? `0 0 6px ${C.forest}` : 'none',
            animation: online ? 'pulse-glow 2.5s infinite' : 'none',
            display: 'inline-block',
          }} />
          {online ? 'online' : 'offline'}
        </div>
      </div>
    </div>
  )
}
