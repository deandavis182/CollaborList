import { describe, it, expect } from 'vitest'
import { hexToChipColor, PRESET_COLORS } from '../tagColor.js'

describe('hexToChipColor', () => {
  it('maps #ef4444 to danger', () => {
    expect(hexToChipColor('#ef4444')).toBe('danger')
  })

  it('maps #22c55e to success', () => {
    expect(hexToChipColor('#22c55e')).toBe('success')
  })

  it('maps #eab308 to warning', () => {
    expect(hexToChipColor('#eab308')).toBe('warning')
  })

  it('maps #3b82f6 to primary', () => {
    expect(hexToChipColor('#3b82f6')).toBe('primary')
  })

  it('maps #8b5cf6 to accent', () => {
    expect(hexToChipColor('#8b5cf6')).toBe('accent')
  })

  it('falls back to neutral for an unmapped hex', () => {
    expect(hexToChipColor('#f97316')).toBe('neutral')
  })

  it('returns neutral for null', () => {
    expect(hexToChipColor(null)).toBe('neutral')
  })

  it('returns neutral for undefined', () => {
    expect(hexToChipColor(undefined)).toBe('neutral')
  })

  it('returns neutral for empty string', () => {
    expect(hexToChipColor('')).toBe('neutral')
  })
})

describe('PRESET_COLORS', () => {
  it('is an array of 8 hex strings', () => {
    expect(Array.isArray(PRESET_COLORS)).toBe(true)
    expect(PRESET_COLORS).toHaveLength(8)
    PRESET_COLORS.forEach((c) => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })
})
