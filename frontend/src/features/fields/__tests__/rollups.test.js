import { describe, it, expect } from 'vitest'
import { computeRollups } from '../rollups.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NUMBER_DEF = { id: 'n1', key: 'price', type: 'number', label: 'Price', config: { unit: '$' }, position: 0 }
const TEXT_DEF   = { id: 't1', key: 'note',  type: 'text',   label: 'Note',  config: {},            position: 1 }

// Budget preset keys
const COST_DEF    = { id: 'c1', key: 'cost',    type: 'number', label: 'Cost',    config: { unit: '$' }, position: 0 }
const PAYMENT_DEF = { id: 'p1', key: 'payment', type: 'status', label: 'Payment', config: { options: ['Unpaid', 'Paid'] }, position: 1 }

// Guest preset keys
const PARTY_DEF = { id: 'g1', key: 'party_size', type: 'number', label: 'Party Size', config: { unit: '' }, position: 0 }
const RSVP_DEF  = { id: 'r1', key: 'rsvp',       type: 'status', label: 'RSVP',       config: { options: ['Yes', 'No', 'Maybe'] }, position: 1 }

// ---------------------------------------------------------------------------
// computeRollups — generic numbers
// ---------------------------------------------------------------------------

describe('computeRollups — generic numbers', () => {
  it('sums a single number def across all items', () => {
    const items = [
      { id: 1, fields: { price: 10 } },
      { id: 2, fields: { price: 25 } },
      { id: 3, fields: { price: 5  } },
    ]
    const result = computeRollups([NUMBER_DEF], items)
    expect(result.numbers).toHaveLength(1)
    expect(result.numbers[0]).toMatchObject({ key: 'price', label: 'Price', sum: 40, unit: '$' })
  })

  it('treats null/undefined/empty values as 0', () => {
    const items = [
      { id: 1, fields: { price: null } },
      { id: 2, fields: { price: undefined } },
      { id: 3, fields: {} },
      { id: 4, fields: { price: '' } },
      { id: 5, fields: { price: 10 } },
    ]
    const result = computeRollups([NUMBER_DEF], items)
    expect(result.numbers[0].sum).toBe(10)
  })

  it('treats non-finite values as 0', () => {
    const items = [
      { id: 1, fields: { price: Infinity } },
      { id: 2, fields: { price: NaN } },
      { id: 3, fields: { price: 5 } },
    ]
    const result = computeRollups([NUMBER_DEF], items)
    expect(result.numbers[0].sum).toBe(5)
  })

  it('treats items with no fields object as 0 contribution', () => {
    const items = [
      { id: 1 },
      { id: 2, fields: { price: 7 } },
    ]
    const result = computeRollups([NUMBER_DEF], items)
    expect(result.numbers[0].sum).toBe(7)
  })

  it('uses def.key as label when def.label is absent', () => {
    const defNoLabel = { id: 'x', key: 'qty', type: 'number', config: {}, position: 0 }
    const items = [{ id: 1, fields: { qty: 3 } }]
    const result = computeRollups([defNoLabel], items)
    expect(result.numbers[0].label).toBe('qty')
  })

  it('uses empty string for unit when config.unit is absent', () => {
    const defNoUnit = { id: 'x', key: 'qty', type: 'number', label: 'Qty', config: {}, position: 0 }
    const items = [{ id: 1, fields: { qty: 3 } }]
    const result = computeRollups([defNoUnit], items)
    expect(result.numbers[0].unit).toBe('')
  })

  it('returns null budget and null guests when no preset defs', () => {
    const items = [{ id: 1, fields: { price: 5 } }]
    const result = computeRollups([NUMBER_DEF], items)
    expect(result.budget).toBeNull()
    expect(result.guests).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeRollups — budget preset
// ---------------------------------------------------------------------------

describe('computeRollups — budget preset', () => {
  const DEFS = [COST_DEF, PAYMENT_DEF]

  it('detects budget preset when cost + payment defs present', () => {
    const result = computeRollups(DEFS, [{ id: 1, fields: { cost: 100, payment: 'Paid' } }])
    expect(result.budget).not.toBeNull()
  })

  it('computes total as sum of all cost values', () => {
    const items = [
      { id: 1, fields: { cost: 100, payment: 'Unpaid' } },
      { id: 2, fields: { cost: 200, payment: 'Paid'   } },
      { id: 3, fields: { cost: 50,  payment: 'Unpaid' } },
    ]
    const { budget } = computeRollups(DEFS, items)
    expect(budget.total).toBe(350)
  })

  it('computes paid as sum of cost where payment === "Paid"', () => {
    const items = [
      { id: 1, fields: { cost: 100, payment: 'Unpaid' } },
      { id: 2, fields: { cost: 200, payment: 'Paid'   } },
      { id: 3, fields: { cost: 50,  payment: 'Paid'   } },
    ]
    const { budget } = computeRollups(DEFS, items)
    expect(budget.paid).toBe(250)
  })

  it('computes remaining as total - paid', () => {
    const items = [
      { id: 1, fields: { cost: 100, payment: 'Unpaid' } },
      { id: 2, fields: { cost: 200, payment: 'Paid'   } },
    ]
    const { budget } = computeRollups(DEFS, items)
    expect(budget.remaining).toBe(budget.total - budget.paid)
    expect(budget.remaining).toBe(100)
  })

  it('treats missing cost field as 0 in budget sums', () => {
    const items = [
      { id: 1, fields: { payment: 'Paid' } },
      { id: 2, fields: { cost: 50, payment: 'Paid' } },
    ]
    const { budget } = computeRollups(DEFS, items)
    expect(budget.total).toBe(50)
    expect(budget.paid).toBe(50)
  })

  it('excludes "cost" key from generic numbers when budget detected', () => {
    const result = computeRollups(DEFS, [{ id: 1, fields: { cost: 100 } }])
    expect(result.numbers.find((n) => n.key === 'cost')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeRollups — guests preset
// ---------------------------------------------------------------------------

describe('computeRollups — guests preset', () => {
  const DEFS = [PARTY_DEF, RSVP_DEF]

  it('detects guests preset when party_size + rsvp defs present', () => {
    const result = computeRollups(DEFS, [{ id: 1, fields: { party_size: 2, rsvp: 'Yes' } }])
    expect(result.guests).not.toBeNull()
  })

  it('computes invited as sum of all party_size', () => {
    const items = [
      { id: 1, fields: { party_size: 2, rsvp: 'No'  } },
      { id: 2, fields: { party_size: 4, rsvp: 'Yes' } },
      { id: 3, fields: { party_size: 1, rsvp: 'Yes' } },
    ]
    const { guests } = computeRollups(DEFS, items)
    expect(guests.invited).toBe(7)
  })

  it('computes confirmed as sum of party_size where rsvp === "Yes"', () => {
    const items = [
      { id: 1, fields: { party_size: 2, rsvp: 'No'  } },
      { id: 2, fields: { party_size: 4, rsvp: 'Yes' } },
      { id: 3, fields: { party_size: 1, rsvp: 'Yes' } },
    ]
    const { guests } = computeRollups(DEFS, items)
    expect(guests.confirmed).toBe(5)
  })

  it('excludes "party_size" key from generic numbers when guests detected', () => {
    const result = computeRollups(DEFS, [{ id: 1, fields: { party_size: 4, rsvp: 'Yes' } }])
    expect(result.numbers.find((n) => n.key === 'party_size')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeRollups — consumed keys not double-counted
// ---------------------------------------------------------------------------

describe('computeRollups — consumed key exclusion', () => {
  it('neither cost nor party_size appear in numbers when both presets active', () => {
    const defs = [COST_DEF, PAYMENT_DEF, PARTY_DEF, RSVP_DEF, NUMBER_DEF]
    const items = [{ id: 1, fields: { cost: 10, payment: 'Paid', party_size: 3, rsvp: 'Yes', price: 5 } }]
    const { numbers } = computeRollups(defs, items)
    expect(numbers.find((n) => n.key === 'cost')).toBeUndefined()
    expect(numbers.find((n) => n.key === 'party_size')).toBeUndefined()
    // 'price' should still appear
    expect(numbers.find((n) => n.key === 'price')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// computeRollups — empty / defensive
// ---------------------------------------------------------------------------

describe('computeRollups — edge cases', () => {
  it('returns empty structure when fieldDefs is undefined', () => {
    const result = computeRollups(undefined, [{ id: 1, fields: { price: 10 } }])
    expect(result).toEqual({ numbers: [], budget: null, guests: null })
  })

  it('returns empty structure when items is undefined', () => {
    const result = computeRollups([NUMBER_DEF], undefined)
    expect(result.numbers[0].sum).toBe(0)
  })

  it('returns all-empty structure when both are undefined', () => {
    const result = computeRollups(undefined, undefined)
    expect(result).toEqual({ numbers: [], budget: null, guests: null })
  })

  it('returns all-empty when defs is empty array', () => {
    const result = computeRollups([], [{ id: 1, fields: { price: 10 } }])
    expect(result).toEqual({ numbers: [], budget: null, guests: null })
  })
})
