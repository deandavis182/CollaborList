import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldRollups } from '../FieldRollups.jsx'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COST_DEF    = { id: 'c1', key: 'cost',    type: 'number', label: 'Cost',    config: { unit: '$' }, position: 0 }
const PAYMENT_DEF = { id: 'p1', key: 'payment', type: 'status', label: 'Payment', config: { options: ['Unpaid', 'Paid'] }, position: 1 }
const PARTY_DEF   = { id: 'g1', key: 'party_size', type: 'number', label: 'Party Size', config: { unit: '' }, position: 2 }
const RSVP_DEF    = { id: 'r1', key: 'rsvp',       type: 'status', label: 'RSVP',       config: { options: ['Yes', 'No'] }, position: 3 }
const PRICE_DEF   = { id: 'n1', key: 'price', type: 'number', label: 'Price', config: { unit: '€' }, position: 4 }

// ---------------------------------------------------------------------------
// Budget block
// ---------------------------------------------------------------------------

describe('FieldRollups — budget block', () => {
  const DEFS  = [COST_DEF, PAYMENT_DEF]
  const ITEMS = [
    { id: 1, fields: { cost: 100, payment: 'Unpaid' } },
    { id: 2, fields: { cost: 200, payment: 'Paid'   } },
    { id: 3, fields: { cost: 50,  payment: 'Paid'   } },
  ]

  it('renders field-rollups container', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    expect(screen.getByTestId('field-rollups')).toBeInTheDocument()
  })

  it('renders rollup-budget block', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    expect(screen.getByTestId('rollup-budget')).toBeInTheDocument()
  })

  it('shows correct total', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    // total = 100 + 200 + 50 = 350
    const totalEl = screen.getByTestId('rollup-budget-total')
    expect(totalEl).toHaveTextContent('350')
  })

  it('shows correct paid', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    // paid = 200 + 50 = 250
    const paidEl = screen.getByTestId('rollup-budget-paid')
    expect(paidEl).toHaveTextContent('250')
  })

  it('shows correct remaining', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    // remaining = 350 - 250 = 100
    const remainingEl = screen.getByTestId('rollup-budget-remaining')
    expect(remainingEl).toHaveTextContent('100')
  })

  it('prefixes total/paid/remaining with the unit from the cost def', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    expect(screen.getByTestId('rollup-budget-total')).toHaveTextContent('$')
    expect(screen.getByTestId('rollup-budget-paid')).toHaveTextContent('$')
    expect(screen.getByTestId('rollup-budget-remaining')).toHaveTextContent('$')
  })
})

// ---------------------------------------------------------------------------
// Guest block
// ---------------------------------------------------------------------------

describe('FieldRollups — guests block', () => {
  const DEFS  = [PARTY_DEF, RSVP_DEF]
  const ITEMS = [
    { id: 1, fields: { party_size: 2, rsvp: 'No'  } },
    { id: 2, fields: { party_size: 4, rsvp: 'Yes' } },
    { id: 3, fields: { party_size: 1, rsvp: 'Yes' } },
  ]

  it('renders field-rollups container', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    expect(screen.getByTestId('field-rollups')).toBeInTheDocument()
  })

  it('renders rollup-guests block', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    expect(screen.getByTestId('rollup-guests')).toBeInTheDocument()
  })

  it('shows correct invited count', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    // invited = 2 + 4 + 1 = 7
    expect(screen.getByTestId('rollup-guests-invited')).toHaveTextContent('7')
  })

  it('shows correct confirmed count', () => {
    render(<FieldRollups fieldDefs={DEFS} items={ITEMS} />)
    // confirmed = 4 + 1 = 5
    expect(screen.getByTestId('rollup-guests-confirmed')).toHaveTextContent('5')
  })
})

// ---------------------------------------------------------------------------
// Generic number block
// ---------------------------------------------------------------------------

describe('FieldRollups — generic number', () => {
  it('renders rollup-number-{key} for each non-preset number def', () => {
    render(<FieldRollups fieldDefs={[PRICE_DEF]} items={[{ id: 1, fields: { price: 42 } }]} />)
    expect(screen.getByTestId('rollup-number-price')).toBeInTheDocument()
    expect(screen.getByTestId('rollup-number-price')).toHaveTextContent('Price')
    expect(screen.getByTestId('rollup-number-price')).toHaveTextContent('42')
    expect(screen.getByTestId('rollup-number-price')).toHaveTextContent('€')
  })
})

// ---------------------------------------------------------------------------
// Renders nothing when no number fields or presets
// ---------------------------------------------------------------------------

describe('FieldRollups — renders nothing', () => {
  it('returns null when there are no number defs', () => {
    const TEXT_DEF = { id: 't1', key: 'note', type: 'text', label: 'Note', config: {}, position: 0 }
    const { container } = render(<FieldRollups fieldDefs={[TEXT_DEF]} items={[{ id: 1, fields: { note: 'hi' } }]} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when fieldDefs is empty', () => {
    const { container } = render(<FieldRollups fieldDefs={[]} items={[{ id: 1, fields: {} }]} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when there are no items', () => {
    const TEXT_DEF = { id: 't1', key: 'note', type: 'text', label: 'Note', config: {}, position: 0 }
    const { container } = render(<FieldRollups fieldDefs={[TEXT_DEF]} items={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
