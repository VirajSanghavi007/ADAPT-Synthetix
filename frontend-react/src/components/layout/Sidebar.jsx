import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Mic, BarChart2, Zap,
  ListOrdered, History, Cpu,
} from 'lucide-react'
import { C } from '@/lib/theme'

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/transcribe', label: 'Transcribe', icon: Mic             },
  { to: '/analytics',  label: 'Analytics',  icon: BarChart2       },
  { to: '/phonemes',   label: 'Phonemes',   icon: Zap             },
  { to: '/queue',      label: 'Queue',      icon: ListOrdered     },
  { to: '/history',    label: 'History',    icon: History         },
  { to: '/models',     label: 'Models',     icon: Cpu             },
]

const activeStyle = {
  display: 'flex', alignItems: 'center', gap: 9,
  padding: '7px 12px', borderRadius: 6, textDecoration: 'none',
  fontSize: 12, color: C.textPrimary, fontWeight: 500,
  background: C.surfaceAlt, border: `1px solid ${C.border}`,
}
const inactiveStyle = {
  display: 'flex', alignItems: 'center', gap: 9,
  padding: '7px 12px', borderRadius: 6, textDecoration: 'none',
  fontSize: 12, color: C.textMuted, fontWeight: 400,
  background: 'transparent', border: '1px solid transparent',
}

export function Sidebar() {
  return (
    <nav style={{
      width: 180, flexShrink: 0,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '20px 0',
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 16px 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.01em' }}>
          ADAPT
        </div>
        <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1, letterSpacing: '0.1em' }}>
          Synthetix
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => isActive ? activeStyle : inactiveStyle}
          >
            {({ isActive }) => (
              <>
                <Icon size={13} style={{ opacity: isActive ? 0.9 : 0.4, flexShrink: 0 }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px 0', borderTop: `1px solid ${C.border}`, marginTop: 8, fontSize: 9, color: C.textMuted }}>
        Wav2Vec2 · Bark
      </div>
    </nav>
  )
}
