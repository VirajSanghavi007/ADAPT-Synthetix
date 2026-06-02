import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Mic, BarChart2, Zap,
  ListOrdered, History, Cpu, Database,
} from 'lucide-react'
import { C } from '@/lib/theme'

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard, key: 'd' },
  { to: '/transcribe', label: 'Transcribe', icon: Mic,             key: 't' },
  { to: '/analytics',  label: 'Analytics',  icon: BarChart2,       key: 'a' },
  { to: '/phonemes',   label: 'Phonemes',   icon: Zap,             key: 'p' },
  { to: '/queue',      label: 'Queue',      icon: ListOrdered,     key: 'q' },
  { to: '/history',    label: 'History',    icon: History,         key: 'h' },
  { to: '/models',     label: 'Models',     icon: Cpu,             key: 'm' },
]

export function Sidebar() {
  return (
    <nav style={{
      width: 196, flexShrink: 0,
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 18px 14px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 4,
            background: C.cyanGlow,
            border: `1px solid ${C.cyan}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={12} color={C.cyan} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, letterSpacing: '0.05em' }}>ADAPT</div>
            <div style={{ fontSize: 8, color: C.textMuted, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: -1 }}>Synthetix v2</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map(({ to, label, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '7px 10px',
              borderRadius:   6,
              color:          isActive ? C.cyan : C.textSecondary,
              background:     isActive ? C.cyanGlow : 'transparent',
              border:         isActive ? `1px solid ${C.cyan}1a` : '1px solid transparent',
              textDecoration: 'none',
              fontSize:       11,
              fontWeight:     isActive ? 600 : 400,
              transition:     'all 0.12s ease',
              letterSpacing:  '0.03em',
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={13} style={{ opacity: isActive ? 1 : 0.5 }} />
                  {label}
                </span>
                <span style={{
                  fontSize: 8, color: C.textDim,
                  border: `1px solid ${C.border}`,
                  padding: '1px 4px', borderRadius: 3,
                  fontWeight: 500,
                }}>{key}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 18px',
        borderTop: `1px solid ${C.border}`,
        fontSize: 8, color: C.textMuted,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <Database size={8} />
        Wav2Vec2 · Bark-Small
      </div>
    </nav>
  )
}
