import { describe, it, expect } from 'vitest'
import { getApiError } from '../apiError.js'

describe('getApiError', () => {
  it('returns response.data.error when present (backend payload)', () => {
    const err = { response: { data: { error: 'Workspace not found' } }, message: 'Request failed with status code 404' }
    expect(getApiError(err)).toBe('Workspace not found')
  })

  it('falls back to err.message when there is no response.data.error', () => {
    const err = { message: 'Network Error' }
    expect(getApiError(err)).toBe('Network Error')
  })

  it('falls back to the provided fallback string when neither is present', () => {
    expect(getApiError(null, 'Something went wrong')).toBe('Something went wrong')
  })

  it('uses the default fallback when called with no arguments', () => {
    expect(getApiError(undefined)).toBe('Something went wrong')
  })

  it('prefers response.data.error over err.message when both are present', () => {
    const err = {
      response: { data: { error: 'Name already taken' } },
      message: 'Request failed with status code 422',
    }
    expect(getApiError(err, 'Fallback')).toBe('Name already taken')
  })

  it('falls back to custom fallback when err.message is also missing', () => {
    const err = { response: { data: {} } }
    expect(getApiError(err, 'Custom fallback')).toBe('Custom fallback')
  })
})
