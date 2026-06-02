import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/store'

const SKIP = ['/login']

/**
 * Saves the current page to localStorage on every route change.
 * On first mount, redirects to the last saved page if the user
 * landed on '/' (i.e. they just signed in and want to go back
 * to where they left off).
 */
export function useRouteTracker({ shouldRestore = false } = {}) {
  const location = useLocation()
  const navigate  = useNavigate()
  const { lastPage, setLastPage, recordVisit } = useSessionStore()

  // On app boot: record visit + optionally restore last page
  useEffect(() => {
    recordVisit()
    if (shouldRestore && location.pathname === '/' && lastPage && lastPage !== '/' && !SKIP.includes(lastPage)) {
      navigate(lastPage, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save page on every navigation
  useEffect(() => {
    if (!SKIP.includes(location.pathname)) {
      setLastPage(location.pathname)
    }
  }, [location.pathname, setLastPage])
}
