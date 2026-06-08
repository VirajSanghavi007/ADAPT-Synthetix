import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Mic, BarChart2, Zap,
  ListOrdered, History, Cpu, LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { C } from '@/lib/theme'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',       key: 'd' },
  { to: '/transcribe',icon: Mic,             label: 'Transcribe',       key: 't' },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics',        key: 'a' },
  { to: '/phonemes',  icon: Zap,             label: 'Phoneme Explorer', key: 'p' },
  { to: '/queue',     icon: ListOrdered,     label: 'Queue',            key: 'q' },
  { to: '/history',   icon: History,         label: 'History',          key: 'h' },
  { to: '/models',    icon: Cpu,             label: 'Model Hub',        key: 'm' },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: C.blueBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>A</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, letterSpacing: '-0.01em' }}>
              ADAPT
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
              Synthetix
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: '8px 8px 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {NAV.map(({ to, icon: Icon, label, key }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 6,
              marginBottom: 2,
              color: isActive ? C.textPrimary : C.textSecondary,
              background: isActive ? C.surfaceAlt : 'transparent',
              border: isActive ? `1px solid ${C.border}` : '1px solid transparent',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              textDecoration: 'none',
              transition: 'all 0.12s',
              cursor: 'pointer',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = C.surfaceHover
                e.currentTarget.style.color = C.textPrimary
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.getAttribute('aria-current')) {
                e.currentTarget.style.background = ''
                e.currentTarget.style.color = ''
              }
            }}
          >
            <Icon size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{label}</span>
            <span style={{
              fontSize: 10, color: C.textDim, fontFamily: 'ui-monospace, monospace',
              background: C.surfaceHover, borderRadius: 3, padding: '1px 4px',
              border: `1px solid ${C.border}`,
            }}>
              {key}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      {user && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6 }}>
            {user.picture
              ? <img src={user.picture} alt="" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
              : (
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: C.blueBg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff',
                }}>
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </div>
              )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary }}>
                {user.name || 'User'}
              </div>
              <div className="truncate" style={{ fontSize: 11, color: C.textMuted }}>
                {user.email}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 10px', borderRadius: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.textMuted, fontSize: 12,
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.color = C.textPrimary }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.textMuted }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
