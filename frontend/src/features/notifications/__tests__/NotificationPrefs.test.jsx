import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock lib/api
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useNotificationPrefs:       vi.fn(),
  useUpdateNotificationPrefs: vi.fn(),
  useVapidKey:                vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock lib/push — prevent real browser API access in jsdom
// ---------------------------------------------------------------------------
vi.mock('../../../lib/push.js', () => ({
  pushSupported:       vi.fn(() => false),
  getPermission:       vi.fn(() => 'default'),
  subscribeToPush:     vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  useVapidKey,
} from '../../../lib/api.js'

import { NotificationPrefs } from '../NotificationPrefs.jsx'

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

const mutateSpy = vi.fn()

const DEFAULT_PREFS = {
  assignments: true,
  mentions:    true,
  comments:    false,
  reminders:   true,
  quietHours:  null,
  muteProjects: [],
}

function setupMocks(prefs = DEFAULT_PREFS) {
  useNotificationPrefs.mockReturnValue({ data: prefs })
  useUpdateNotificationPrefs.mockReturnValue({ mutate: mutateSpy, isPending: false })
  useVapidKey.mockReturnValue({ data: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  mutateSpy.mockReset()
  setupMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationPrefs — rendering', () => {
  it('renders data-testid="notification-prefs" when open', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('notification-prefs')).toBeInTheDocument()
  })

  it('renders nothing when open=false', () => {
    render(
      <NotificationPrefs open={false} onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByTestId('notification-prefs')).toBeNull()
  })

  it('renders all four category toggle checkboxes', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('pref-assignments')).toBeInTheDocument()
    expect(screen.getByTestId('pref-mentions')).toBeInTheDocument()
    expect(screen.getByTestId('pref-comments')).toBeInTheDocument()
    expect(screen.getByTestId('pref-reminders')).toBeInTheDocument()
  })

  it('renders the quiet-hours section', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('pref-quiet-hours')).toBeInTheDocument()
  })
})

describe('NotificationPrefs — prefs reflected in checkboxes', () => {
  it('pref-assignments is checked when assignments=true', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('pref-assignments')).toBeChecked()
  })

  it('pref-comments is unchecked when comments=false', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('pref-comments')).not.toBeChecked()
  })

  it('reflects custom pref values', () => {
    setupMocks({
      ...DEFAULT_PREFS,
      assignments: false,
      mentions: false,
    })
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('pref-assignments')).not.toBeChecked()
    expect(screen.getByTestId('pref-mentions')).not.toBeChecked()
    expect(screen.getByTestId('pref-reminders')).toBeChecked()
  })
})

describe('NotificationPrefs — toggling categories', () => {
  it('toggling assignments calls mutate({ assignments: false }) when it was true', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('pref-assignments'))
    expect(mutateSpy).toHaveBeenCalledWith({ assignments: false })
  })

  it('toggling comments calls mutate({ comments: true }) when it was false', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('pref-comments'))
    expect(mutateSpy).toHaveBeenCalledWith({ comments: true })
  })

  it('toggling mentions calls mutate({ mentions: false }) when it was true', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('pref-mentions'))
    expect(mutateSpy).toHaveBeenCalledWith({ mentions: false })
  })

  it('toggling reminders calls mutate({ reminders: false }) when it was true', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('pref-reminders'))
    expect(mutateSpy).toHaveBeenCalledWith({ reminders: false })
  })
})

describe('NotificationPrefs — quiet hours', () => {
  it('calls mutate({ quietHours: null }) when Clear is clicked', () => {
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByText('Clear'))
    expect(mutateSpy).toHaveBeenCalledWith({ quietHours: null })
  })

  it('populates quiet hours inputs from prefs', () => {
    setupMocks({ ...DEFAULT_PREFS, quietHours: { start: 22, end: 7 } })
    render(
      <NotificationPrefs open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    // The start input should reflect 22 and end 7
    expect(screen.getByLabelText('Start (0–23)')).toHaveValue(22)
    expect(screen.getByLabelText('End (0–23)')).toHaveValue(7)
  })
})
