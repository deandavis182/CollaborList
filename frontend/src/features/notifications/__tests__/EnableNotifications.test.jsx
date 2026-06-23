import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock lib/push — drive browser API states deterministically
// ---------------------------------------------------------------------------
vi.mock('../../../lib/push.js', () => ({
  pushSupported:      vi.fn(),
  getPermission:      vi.fn(),
  subscribeToPush:    vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock lib/api — no real network
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useVapidKey: vi.fn(),
}))

import {
  pushSupported,
  getPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../../lib/push.js'

import { useVapidKey } from '../../../lib/api.js'
import { EnableNotifications } from '../EnableNotifications.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function Wrapper({ children }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default safe setup — supported, default permission, no vapid key yet
  pushSupported.mockReturnValue(true)
  getPermission.mockReturnValue('default')
  useVapidKey.mockReturnValue({ data: null })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EnableNotifications — unsupported', () => {
  it('shows push-unsupported when pushSupported returns false', () => {
    pushSupported.mockReturnValue(false)
    render(<EnableNotifications />, { wrapper: Wrapper })
    expect(screen.getByTestId('push-unsupported')).toBeInTheDocument()
    expect(screen.queryByTestId('enable-push-btn')).toBeNull()
  })
})

describe('EnableNotifications — denied', () => {
  it('shows push-denied when permission is denied', () => {
    pushSupported.mockReturnValue(true)
    getPermission.mockReturnValue('denied')
    render(<EnableNotifications />, { wrapper: Wrapper })
    expect(screen.getByTestId('push-denied')).toBeInTheDocument()
    expect(screen.queryByTestId('enable-push-btn')).toBeNull()
  })
})

describe('EnableNotifications — granted', () => {
  it('shows push-on when permission is already granted', () => {
    pushSupported.mockReturnValue(true)
    getPermission.mockReturnValue('granted')
    render(<EnableNotifications />, { wrapper: Wrapper })
    expect(screen.getByTestId('push-on')).toBeInTheDocument()
    expect(screen.queryByTestId('enable-push-btn')).toBeNull()
  })

  it('clicking "Turn off" calls unsubscribeFromPush', async () => {
    pushSupported.mockReturnValue(true)
    getPermission.mockReturnValue('granted')
    unsubscribeFromPush.mockResolvedValue(true)
    render(<EnableNotifications />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText('Turn off'))
    expect(unsubscribeFromPush).toHaveBeenCalledTimes(1)
  })
})

describe('EnableNotifications — default / enable flow', () => {
  it('shows enable-push-btn when permission is default', () => {
    pushSupported.mockReturnValue(true)
    getPermission.mockReturnValue('default')
    render(<EnableNotifications />, { wrapper: Wrapper })
    expect(screen.getByTestId('enable-push-btn')).toBeInTheDocument()
  })

  it('clicking enable-push-btn calls subscribeToPush with the fetched vapid key', async () => {
    const vapidKey = 'test-vapid-key-abc'
    pushSupported.mockReturnValue(true)
    getPermission.mockReturnValue('default')
    subscribeToPush.mockResolvedValue({ endpoint: 'https://example.com/push', keys: {} })
    useVapidKey.mockReturnValue({ data: vapidKey })

    render(<EnableNotifications />, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId('enable-push-btn'))

    // subscribeToPush should be called with the vapid key
    expect(subscribeToPush).toHaveBeenCalledWith(vapidKey)
  })

  it('flips to granted state after successful subscription', async () => {
    pushSupported.mockReturnValue(true)
    // Start as default; after subscribe, getPermission should return granted
    getPermission
      .mockReturnValueOnce('default')    // initial render
      .mockReturnValue('granted')        // after subscribe
    subscribeToPush.mockResolvedValue({ endpoint: 'https://example.com/push', keys: {} })
    useVapidKey.mockReturnValue({ data: 'test-key' })

    render(<EnableNotifications />, { wrapper: Wrapper })
    expect(screen.getByTestId('enable-push-btn')).toBeInTheDocument()

    // Click and wait for the async subscribe to resolve
    fireEvent.click(screen.getByTestId('enable-push-btn'))
    // The component calls subscribeToPush; on resolve it sets state → granted
    expect(subscribeToPush).toHaveBeenCalledTimes(1)
    // After subscribe resolves the component should flip to the granted UI
    await waitFor(() => {
      expect(screen.getByTestId('push-on')).toBeInTheDocument()
    })
  })
})
