/**
 * LoginView.test.jsx — unit tests for features/auth/LoginView.
 *
 * Strategy:
 *   - Mock lib/api.js (apiClient) so no network requests are made.
 *   - Mock lib/auth.js (setAuth) so we can assert it was called.
 *   - window.location.assign is replaced with a vi.fn() spy via
 *     Object.defineProperty so navigation assertions work in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock apiClient before importing the component
// ---------------------------------------------------------------------------

vi.mock('../../../lib/api.js', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

vi.mock('../../../lib/auth.js', () => ({
  setAuth: vi.fn(),
}))

import { apiClient } from '../../../lib/api.js'
import { setAuth } from '../../../lib/auth.js'
import { LoginView } from '../LoginView.jsx'

// ---------------------------------------------------------------------------
// navigation seam — replace window.location.assign with a spy
// ---------------------------------------------------------------------------

let assignSpy

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()

  assignSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: assignSpy },
    writable: true,
    configurable: true,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderView() {
  return render(<LoginView />)
}

function fillForm({ email = 'alice@example.com', password = 'Password1' } = {}) {
  fireEvent.change(screen.getByTestId('auth-email'), { target: { value: email } })
  fireEvent.change(screen.getByTestId('auth-password'), { target: { value: password } })
}

// ---------------------------------------------------------------------------
// Tests — rendering
// ---------------------------------------------------------------------------

describe('LoginView — rendering', () => {
  it('renders the login-view container', () => {
    renderView()
    expect(screen.getByTestId('login-view')).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderView()
    expect(screen.getByTestId('auth-email')).toBeInTheDocument()
    expect(screen.getByTestId('auth-password')).toBeInTheDocument()
  })

  it('renders a submit button', () => {
    renderView()
    expect(screen.getByTestId('auth-submit')).toBeInTheDocument()
  })

  it('renders a mode toggle button', () => {
    renderView()
    expect(screen.getByTestId('auth-toggle-mode')).toBeInTheDocument()
  })

  it('starts in "Log in" mode by default', () => {
    renderView()
    expect(screen.getByTestId('auth-submit')).toHaveTextContent(/log in/i)
  })

  it('does NOT show auth-error on initial render', () => {
    renderView()
    expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — mode toggle
// ---------------------------------------------------------------------------

describe('LoginView — mode toggle', () => {
  it('switches to Sign up mode when toggle is clicked', () => {
    renderView()
    fireEvent.click(screen.getByTestId('auth-toggle-mode'))
    expect(screen.getByTestId('auth-submit')).toHaveTextContent(/sign up/i)
  })

  it('switches back to Log in when toggled again', () => {
    renderView()
    fireEvent.click(screen.getByTestId('auth-toggle-mode'))
    fireEvent.click(screen.getByTestId('auth-toggle-mode'))
    expect(screen.getByTestId('auth-submit')).toHaveTextContent(/log in/i)
  })

  it('shows a password hint in Sign up mode', () => {
    renderView()
    fireEvent.click(screen.getByTestId('auth-toggle-mode'))
    // A hint about password requirements should appear
    expect(screen.getByTestId('login-view')).toHaveTextContent(/8.+character/i)
  })
})

// ---------------------------------------------------------------------------
// Tests — successful login
// ---------------------------------------------------------------------------

describe('LoginView — successful login', () => {
  it('POSTs to /auth/login with email and password', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { token: 'tok-1', user: { id: 1, email: 'alice@example.com' } },
    })
    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'alice@example.com',
        password: 'Password1',
      })
    })
  })

  it('calls setAuth with the response data on success', async () => {
    const responseData = { token: 'tok-1', user: { id: 1, email: 'alice@example.com' } }
    apiClient.post.mockResolvedValueOnce({ data: responseData })
    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(setAuth).toHaveBeenCalledWith(responseData)
    })
  })

  it('calls window.location.assign("/") on success (full reload)', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { token: 'tok-1', user: { id: 1, email: 'alice@example.com' } },
    })
    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('/')
    })
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolve
    apiClient.post.mockReturnValueOnce(new Promise((res) => { resolve = res }))
    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    // Button should be disabled while pending
    expect(screen.getByTestId('auth-submit')).toBeDisabled()

    resolve({ data: { token: 'tok', user: { id: 1, email: 'alice@example.com' } } })
  })
})

// ---------------------------------------------------------------------------
// Tests — successful register
// ---------------------------------------------------------------------------

describe('LoginView — successful register', () => {
  it('POSTs to /auth/register when in Sign up mode', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { token: 'tok-2', user: { id: 2, email: 'bob@example.com' } },
    })
    renderView()
    fireEvent.click(screen.getByTestId('auth-toggle-mode'))
    fillForm({ email: 'bob@example.com', password: 'Password2' })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'bob@example.com',
        password: 'Password2',
      })
    })
  })

  it('calls setAuth and navigates on successful register', async () => {
    const responseData = { token: 'tok-2', user: { id: 2, email: 'bob@example.com' } }
    apiClient.post.mockResolvedValueOnce({ data: responseData })
    renderView()
    fireEvent.click(screen.getByTestId('auth-toggle-mode'))
    fillForm({ email: 'bob@example.com', password: 'Password2' })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(setAuth).toHaveBeenCalledWith(responseData)
      expect(assignSpy).toHaveBeenCalledWith('/')
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — error handling
// ---------------------------------------------------------------------------

describe('LoginView — error handling', () => {
  it('shows auth-error with the server message on failed login', async () => {
    const axiosError = {
      response: { data: { error: 'Invalid credentials' } },
      message: 'Request failed with status code 401',
    }
    apiClient.post.mockRejectedValueOnce(axiosError)

    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toBeInTheDocument()
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid credentials')
    })
  })

  it('shows auth-error with a generic message when no server payload', async () => {
    apiClient.post.mockRejectedValueOnce({ message: 'Network Error' })

    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toBeInTheDocument()
    })
  })

  it('clears auth-error when the user retries', async () => {
    // First call fails
    const axiosError = {
      response: { data: { error: 'Invalid credentials' } },
      message: 'Request failed with status code 401',
    }
    apiClient.post.mockRejectedValueOnce(axiosError)

    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toBeInTheDocument()
    })

    // Second call succeeds
    apiClient.post.mockResolvedValueOnce({
      data: { token: 'tok-ok', user: { id: 1, email: 'alice@example.com' } },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument()
    })
  })

  it('re-enables the submit button after a failed request', async () => {
    apiClient.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    })

    renderView()
    fillForm()
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toBeInTheDocument()
    })

    expect(screen.getByTestId('auth-submit')).not.toBeDisabled()
  })
})
