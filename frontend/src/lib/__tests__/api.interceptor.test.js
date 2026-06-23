/**
 * CSRF interceptor test — verifies the apiClient request interceptor sets a
 * non-empty X-CSRF-Token header and Authorization when a token is in localStorage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock axios before importing api.js so the interceptor is captured
vi.mock('axios', () => {
  let _interceptor = null
  const mockInstance = {
    interceptors: {
      request: {
        use: vi.fn((fn) => {
          _interceptor = fn
        }),
      },
    },
    get _requestInterceptor() { return _interceptor },
  }
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  }
})

import axios from 'axios'
import { apiClient, CSRF_TOKEN } from '../api.js'

describe('apiClient CSRF interceptor', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('sets a non-empty X-CSRF-Token header on every request', () => {
    const config = { headers: {} }
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['X-CSRF-Token']).toBeTruthy()
    expect(result.headers['X-CSRF-Token']).toBe(CSRF_TOKEN)
  })

  it('CSRF_TOKEN is a non-empty string', () => {
    expect(typeof CSRF_TOKEN).toBe('string')
    expect(CSRF_TOKEN.length).toBeGreaterThan(0)
  })

  it('sets Authorization header when token is in localStorage', () => {
    localStorage.setItem('token', 'test-jwt')
    const config = { headers: {} }
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['Authorization']).toBe('Bearer test-jwt')
  })

  it('does NOT set Authorization when no token in localStorage', () => {
    localStorage.removeItem('token')
    const config = { headers: {} }
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['Authorization']).toBeUndefined()
  })

  it('creates headers object when config.headers is missing', () => {
    const config = {}
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['X-CSRF-Token']).toBeTruthy()
  })
})
