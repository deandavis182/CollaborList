/**
 * providers.jsx — application-level providers.
 *
 * Wraps children with:
 *   - QueryClientProvider (React Query)
 *   - Theme wrapper that applies data-theme={theme} from the Zustand store
 *
 * NOTE: Router is NOT included here — added in Task 8 so that tests can
 * wrap with <MemoryRouter> independently.
 */

import { useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStore } from '../lib/store.js'
import { createSocket, registerSocketHandlers } from '../lib/socket.js'

/**
 * ThemeWrapper — reads theme from the store and sets data-theme on its div.
 */
function ThemeWrapper({ children }) {
  const theme = useStore((s) => s.theme)
  return (
    <div
      data-testid="theme-wrapper"
      data-theme={theme}
      className="contents"
    >
      {children}
    </div>
  )
}

/**
 * Providers — top-level provider composition.
 *
 * Creates a QueryClient scoped to this component instance (not shared across
 * mounts/tests), and wires the socket lifecycle on mount.
 *
 * Usage:
 *   <Providers>
 *     <BrowserRouter>
 *       <App />
 *     </BrowserRouter>
 *   </Providers>
 */
export function Providers({ children }) {
  const queryClientRef = useRef(null)
  if (queryClientRef.current === null) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          retry: 1,
        },
      },
    })
  }
  const queryClient = queryClientRef.current

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = createSocket(token)
    const cleanup = registerSocketHandlers(socket, queryClient)

    return () => {
      cleanup()
      socket.disconnect?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeWrapper>{children}</ThemeWrapper>
    </QueryClientProvider>
  )
}
