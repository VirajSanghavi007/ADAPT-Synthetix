import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store'

async function fetchMe() {
  const res = await fetch('/auth/me')
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    if (body?.code === 'SESSION_EXPIRED') {
      // Signal callers to handle rotation
      const err = new Error('SESSION_EXPIRED')
      err.code = 'SESSION_EXPIRED'
      throw err
    }
    return null
  }
  if (!res.ok) return null
  return res.json()
}

export function useAuth() {
  const queryClient = useQueryClient()
  const toast = useUIStore((s) => s.toast)

  const { data: user, isLoading } = useQuery({
    queryKey:   ['auth_me'],
    queryFn:    fetchMe,
    staleTime:  60_000,
    retry:      false,
    refetchOnWindowFocus: false,
    onError: (err) => {
      if (err?.code === 'SESSION_EXPIRED') {
        queryClient.clear()
        toast('Your session expired — please sign in again.', 'error')
        setTimeout(() => { window.location.href = '/login' }, 1500)
      }
    },
  })

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login:  () => { window.location.href = '/auth/login' },
    logout: async () => {
      await fetch('/auth/logout', { method: 'POST' })
      window.location.reload()
    },
  }
}
