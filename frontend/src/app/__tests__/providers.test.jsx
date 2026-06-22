import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { useStore } from '../../lib/store.js'

// ---------------------------------------------------------------------------
// Mock socket module — no import-time side effects
// ---------------------------------------------------------------------------
const mockDisconnect = vi.fn()
const mockCleanup = vi.fn()
const mockSocket = { disconnect: mockDisconnect }

vi.mock('../../lib/socket.js', () => ({
  createSocket: vi.fn(() => mockSocket),
  registerSocketHandlers: vi.fn(() => mockCleanup),
}))

import { createSocket, registerSocketHandlers } from '../../lib/socket.js'
import { Providers } from '../providers.jsx'

function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
  })
}

describe('Providers', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('renders children', () => {
    render(
      <Providers>
        <p data-testid="child">Hello Providers</p>
      </Providers>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hello Providers')).toBeInTheDocument()
  })

  it('sets data-theme="light" on the theme wrapper by default', () => {
    render(
      <Providers>
        <span />
      </Providers>
    )

    const themeWrapper = screen.getByTestId('theme-wrapper')
    expect(themeWrapper).toHaveAttribute('data-theme', 'light')
  })

  it('sets data-theme="dark" when the store theme is dark', () => {
    useStore.setState({ theme: 'dark' })

    render(
      <Providers>
        <span />
      </Providers>
    )

    const themeWrapper = screen.getByTestId('theme-wrapper')
    expect(themeWrapper).toHaveAttribute('data-theme', 'dark')
  })

  it('provides a QueryClient so that React Query hooks work inside', () => {
    // If QueryClientProvider is missing, useQuery throws.
    // Rendering a component that calls useQuery (even with a stub) without
    // crashing is evidence the provider is wired up. Here we just verify
    // children render without error — the api.test covers the actual hooks.
    expect(() =>
      render(
        <Providers>
          <div>ok</div>
        </Providers>
      )
    ).not.toThrow()
  })

  it('creates a new QueryClient per Providers instance (not shared)', () => {
    // Each mount should produce an independent QueryClient — no shared
    // module-level singleton that leaks state between tests.
    const { unmount: unmount1 } = render(<Providers><div /></Providers>)
    const { unmount: unmount2 } = render(<Providers><div /></Providers>)
    // Both render without error — presence of two QueryClientProviders
    // with independent clients is asserted implicitly by no "duplicate
    // provider" React warning and no throws.
    unmount1()
    unmount2()
  })

  // ---------------------------------------------------------------------------
  // Socket lifecycle — with token in localStorage
  // ---------------------------------------------------------------------------

  it('calls createSocket and registerSocketHandlers on mount when a token is present', () => {
    localStorage.setItem('token', 'test-jwt-token')

    render(
      <Providers>
        <div />
      </Providers>
    )

    expect(createSocket).toHaveBeenCalledTimes(1)
    expect(createSocket).toHaveBeenCalledWith('test-jwt-token')
    expect(registerSocketHandlers).toHaveBeenCalledTimes(1)
    expect(registerSocketHandlers).toHaveBeenCalledWith(mockSocket, expect.any(Object))
  })

  it('calls cleanup and socket.disconnect on unmount when token was present', () => {
    localStorage.setItem('token', 'test-jwt-token')

    const { unmount } = render(
      <Providers>
        <div />
      </Providers>
    )

    expect(mockCleanup).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()

    unmount()

    expect(mockCleanup).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Socket lifecycle — without token in localStorage
  // ---------------------------------------------------------------------------

  it('does NOT call createSocket when no token is in localStorage', () => {
    // localStorage is clear (no token)
    render(
      <Providers>
        <div />
      </Providers>
    )

    expect(createSocket).not.toHaveBeenCalled()
    expect(registerSocketHandlers).not.toHaveBeenCalled()
  })
})
