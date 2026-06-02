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

export function Sidebar({ user, onLogout }) {
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

      {/* User */}
      <div style={{ padding: '14px 12px 0', borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            {user.picture
              ? <img src={user.picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
              : <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.tealGlow, border: `1px solid ${C.teal}44`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.teal, fontWeight: 700 }}>
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </div>
            }
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="truncate" style={{ fontSize: 10, color: C.textPrimary }}>{user.name || 'User'}</div>
              <div className="truncate" style={{ fontSize: 8, color: C.textMuted }}>{user.email}</div>
            </div>
          </div>
        )}
        <button onClick={onLogout} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontSize: 9, color: C.textMuted, padding: '4px 0',
          fontFamily: 'inherit', letterSpacing: '0.05em',
        }}>
          Sign out →
        </button>
      </div>
    </nav>
  )
}
