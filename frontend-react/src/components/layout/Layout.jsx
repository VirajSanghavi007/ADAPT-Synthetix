import { Sidebar }        from './Sidebar'
import { TopBar }         from './TopBar'
import { ToastContainer } from '@/components/ui/Toast'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { C }              from '@/lib/theme'

export function Layout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </main>
      </div>
      <ToastContainer />
      <CommandPalette />
    </div>
  )
}
