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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStore } from '../lib/store.js'

/** Shared QueryClient instance (one per app lifecycle). */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

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
 * Usage:
 *   <Providers>
 *     <BrowserRouter>
 *       <App />
 *     </BrowserRouter>
 *   </Providers>
 */
export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeWrapper>{children}</ThemeWrapper>
    </QueryClientProvider>
  )
}
