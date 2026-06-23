/**
 * auth.test.js — unit tests for lib/auth.js helpers.
 *
 * All tests clear localStorage in beforeEach so they run in isolation,
 * regardless of the order Vitest picks.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getToken, getUser, setAuth, logout, isAuthenticated } from '../auth.js'

describe('auth helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ---------------------------------------------------------------------------
  // getToken
  // ---------------------------------------------------------------------------

  describe('getToken', () => {
    it('returns null when no token is stored', () => {
      expect(getToken()).toBeNull()
    })

    it('returns the stored token string', () => {
      localStorage.setItem('token', 'abc.def.ghi')
      expect(getToken()).toBe('abc.def.ghi')
    })
  })

  // ---------------------------------------------------------------------------
  // getUser
  // ---------------------------------------------------------------------------

  describe('getUser', () => {
    it('returns null when no user is stored', () => {
      expect(getUser()).toBeNull()
    })

    it('returns the parsed user object', () => {
      const user = { id: 1, email: 'alice@example.com' }
      localStorage.setItem('user', JSON.stringify(user))
      expect(getUser()).toEqual(user)
    })

    it('returns null when the stored value is missing (empty string)', () => {
      localStorage.setItem('user', '')
      expect(getUser()).toBeNull()
    })

    it('returns null and does not throw when JSON is corrupt', () => {
      localStorage.setItem('user', '{not valid json')
      expect(() => getUser()).not.toThrow()
      expect(getUser()).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // setAuth
  // ---------------------------------------------------------------------------

  describe('setAuth', () => {
    it('stores token and serialised user', () => {
      const user = { id: 7, email: 'bob@example.com' }
      setAuth({ token: 'tok-1', user })

      expect(localStorage.getItem('token')).toBe('tok-1')
      expect(JSON.parse(localStorage.getItem('user'))).toEqual(user)
    })

    it('overwrites a previous auth entry', () => {
      setAuth({ token: 'old-tok', user: { id: 1, email: 'old@example.com' } })
      setAuth({ token: 'new-tok', user: { id: 2, email: 'new@example.com' } })

      expect(getToken()).toBe('new-tok')
      expect(getUser()).toEqual({ id: 2, email: 'new@example.com' })
    })
  })

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------

  describe('logout', () => {
    it('removes token and user from storage', () => {
      setAuth({ token: 'tok-2', user: { id: 3, email: 'carol@example.com' } })
      logout()

      expect(getToken()).toBeNull()
      expect(getUser()).toBeNull()
    })

    it('is a no-op when already logged out', () => {
      expect(() => logout()).not.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // isAuthenticated
  // ---------------------------------------------------------------------------

  describe('isAuthenticated', () => {
    it('returns false when no token is present', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('returns true when a token is present', () => {
      localStorage.setItem('token', 'some-jwt')
      expect(isAuthenticated()).toBe(true)
    })

    it('returns false after logout', () => {
      setAuth({ token: 'tok-3', user: { id: 4, email: 'dave@example.com' } })
      logout()
      expect(isAuthenticated()).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Round-trip: setAuth → getToken + getUser + isAuthenticated
  // ---------------------------------------------------------------------------

  describe('round-trip', () => {
    it('setAuth → getToken / getUser / isAuthenticated all agree', () => {
      const user = { id: 99, email: 'eve@example.com' }
      setAuth({ token: 'round-trip-tok', user })

      expect(getToken()).toBe('round-trip-tok')
      expect(getUser()).toEqual(user)
      expect(isAuthenticated()).toBe(true)
    })

    it('setAuth → logout → all clear', () => {
      setAuth({ token: 'round-trip-tok-2', user: { id: 100, email: 'frank@example.com' } })
      logout()

      expect(getToken()).toBeNull()
      expect(getUser()).toBeNull()
      expect(isAuthenticated()).toBe(false)
    })
  })
})
