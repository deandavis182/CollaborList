/**
 * RequireAuth.test.jsx — unit tests for the route guard.
 *
 * Uses a MemoryRouter with a /login sentinel to verify the redirect,
 * and a guarded route to verify authenticated pass-through.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock lib/auth — we control isAuthenticated per test
// ---------------------------------------------------------------------------
vi.mock('../../../lib/auth.js', () => ({
  isAuthenticated: vi.fn(),
  getToken: vi.fn(() => null),
  getUser: vi.fn(() => null),
  logout: vi.fn(),
  setAuth: vi.fn(),
}))

import { isAuthenticated } from '../../../lib/auth.js'
import { RequireAuth } from '../RequireAuth.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a route tree:
 *   /login  → <div data-testid="login-sentinel">Login</div>
 *   /       → guarded by <RequireAuth>, renders <div data-testid="guarded-content">Secret</div>
 */
function renderAtPath(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-sentinel">Login</div>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <div data-testid="guarded-content">Secret</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RequireAuth — unauthenticated', () => {
  beforeEach(() => {
    isAuthenticated.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /login when not authenticated', () => {
    renderAtPath('/')
    expect(screen.getByTestId('login-sentinel')).toBeInTheDocument()
  })

  it('does not render the guarded content when not authenticated', () => {
    renderAtPath('/')
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument()
  })
})

describe('RequireAuth — authenticated', () => {
  beforeEach(() => {
    isAuthenticated.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when authenticated', () => {
    renderAtPath('/')
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument()
  })

  it('does not redirect to /login when authenticated', () => {
    renderAtPath('/')
    expect(screen.queryByTestId('login-sentinel')).not.toBeInTheDocument()
  })
})

describe('RequireAuth — as layout route (Outlet)', () => {
  beforeEach(() => {
    isAuthenticated.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders <Outlet /> children when used as a layout route without explicit children', () => {
    render(
      <MemoryRouter initialEntries={['/child']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/child" element={<div data-testid="outlet-child">Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByTestId('outlet-child')).toBeInTheDocument()
  })
})
