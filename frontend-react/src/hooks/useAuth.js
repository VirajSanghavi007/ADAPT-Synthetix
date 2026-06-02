import { useQuery } from '@tanstack/react-query'

async function fetchMe() {
  const res = await fetch('/auth/me')
  if (res.status === 401) return null
  if (!res.ok) return null
  return res.json()
}

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey:   ['auth_me'],
    queryFn:    fetchMe,
    staleTime:  60_000,
    retry:      false,
    refetchOnWindowFocus: false,
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
