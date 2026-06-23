import { describe, it, expect } from 'vitest'
import { EVENTS } from '../events.js'

describe('EVENTS catalog', () => {
  it('EVENTS.FIELD_UPDATED equals "field-updated"', () => {
    expect(EVENTS.FIELD_UPDATED).toBe('field-updated')
  })

  it('EVENTS is frozen (no accidental mutation)', () => {
    expect(Object.isFrozen(EVENTS)).toBe(true)
  })
})
