import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store'

const ROUTES = {
  'd': '/',
  't': '/transcribe',
  'a': '/analytics',
  'p': '/phonemes',
  'q': '/queue',
  'h': '/history',
  'm': '/models',
}

export function useKeyboardShortcuts() {
  const navigate   = useNavigate()
  const setPalette = useUIStore((s) => s.setPalette)

  useEffect(() => {
    const handler = (e) => {
      // Ignore when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

      // Cmd/Ctrl + K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPalette(true)
        return
      }

      // Escape → close palette
      if (e.key === 'Escape') {
        setPalette(false)
        return
      }

      // Single-key navigation (no modifiers)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && ROUTES[e.key]) {
        navigate(ROUTES[e.key])
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, setPalette])
}
