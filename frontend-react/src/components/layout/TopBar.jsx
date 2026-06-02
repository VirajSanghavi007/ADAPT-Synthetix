import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, Circle, Command } from 'lucide-react'
import { getHealth } from '@/lib/api'
import { useUIStore } from '@/store'
import { C } from '@/lib/theme'

const TITLES = {
  '/':           'Dashboard',
  '/transcribe': 'Transcribe',
  '/analytics':  'Analytics',
  '/phonemes':   'Phoneme Explorer',
  '/queue':      'Remediation Queue',
  '/history':    'Session History',
  '/models':     'Model Hub',
}

export function TopBar() {
  const { pathname } = useLocation()
  const setPalette   = useUIStore((s) => s.setPalette)

  const { data: health } = useQuery({
    queryKey:       ['health'],
    queryFn:        getHealth,
    refetchInterval: 30_000,
  })

  const online = health?.status === 'healthy'

  return (
    <div style={{
      height: 44,
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
    }}>
      {/* Title */}
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {TITLES[pathname] ?? 'ADAPT-Synthetix'}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Cmd+K hint */}
        <button
          onClick={() => setPalette(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 4, padding: '3px 8px',
            fontSize: 9, color: C.textMuted, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.1em',
          }}
        >
          <Command size={9} /> K
        </button>

        {/* Session ID */}
        <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>
          {health?.session_id ? `SID:${health.session_id.slice(0, 8)}` : '—'}
        </div>

        {/* Health dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: online ? C.green : C.red }}>
          <Circle
            size={6}
            fill={online ? C.green : C.red}
            strokeWidth={0}
            style={{
              filter:    online ? `drop-shadow(0 0 3px ${C.green})` : 'none',
              animation: online ? 'pulse-glow 2s infinite' : 'none',
            }}
          />
          <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {online ? 'online' : 'offline'}
          </span>
        </div>
      </div>
    </div>
  )
}
