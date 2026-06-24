import { describe, it, expect } from 'vitest'
import { listColor, listTint, STATUS_COLOR, statusChipColor } from '../listColor.js'

describe('listColor', () => {
  it('is deterministic for the same id', () => {
    expect(listColor(7)).toBe(listColor(7))
  })
  it('returns an hsl string', () => {
    expect(listColor(7)).toMatch(/^hsl\(\d+, 52%, 52%\)$/)
  })
  it('listTint returns an hsla string', () => {
    expect(listTint(7)).toMatch(/^hsla\(\d+, 52%, 52%, 0\.13\)$/)
  })
})

describe('status color', () => {
  it('maps the four canonical statuses', () => {
    expect(STATUS_COLOR).toEqual({ 'To do': 'neutral', Doing: 'primary', Done: 'success', Blocked: 'danger' })
  })
  it('falls back to neutral', () => {
    expect(statusChipColor('Nope')).toBe('neutral')
    expect(statusChipColor('Doing')).toBe('primary')
  })
})
