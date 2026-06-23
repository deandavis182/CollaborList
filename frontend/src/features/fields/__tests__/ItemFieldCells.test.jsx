import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemFieldCells } from '../ItemFieldCells.jsx'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFS = [
  { id: 'n1', key: 'budget',  type: 'number', label: 'Budget',  config: { unit: '$' }, position: 0 },
  { id: 'd1', key: 'deadline', type: 'date',   label: 'Deadline', config: {},           position: 1 },
  { id: 's1', key: 'status',  type: 'status', label: 'Status',  config: { options: ['Open', 'Closed'] }, position: 2 },
  { id: 't1', key: 'note',    type: 'text',   label: 'Note',    config: {},            position: 3 },
  { id: 'p1', key: 'owner',   type: 'person', label: 'Owner',   config: {},            position: 4 },
]

const MEMBERS = [
  { user_id: 42, email: 'alice@example.com' },
  { user_id: 99, email: 'bob@example.com'   },
]

// ---------------------------------------------------------------------------
// Renders a cell per def with formatted value
// ---------------------------------------------------------------------------

describe('ItemFieldCells — renders cells', () => {
  it('renders the container with data-testid="item-field-cells"', () => {
    const item = { id: 1, fields: { budget: 500 } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[0]]} members={[]} />)
    expect(screen.getByTestId('item-field-cells')).toBeInTheDocument()
  })

  it('renders a cell for each def with a non-empty value', () => {
    const item = { id: 1, fields: { budget: 100, deadline: '2026-07-01', status: 'Open', note: 'hello', owner: 42 } }
    render(<ItemFieldCells item={item} fieldDefs={DEFS} members={MEMBERS} />)
    expect(screen.getByTestId('item-field-cell-budget')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-cell-deadline')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-cell-status')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-cell-note')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-cell-owner')).toBeInTheDocument()
  })

  it('formats number with unit prefix', () => {
    const item = { id: 1, fields: { budget: 750 } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[0]]} members={[]} />)
    expect(screen.getByTestId('item-field-cell-budget')).toHaveTextContent('$750')
  })

  it('formats date as YYYY-MM-DD slice (no UTC shift)', () => {
    // Stored as ISO string — must NOT pass through new Date()
    const item = { id: 1, fields: { deadline: '2026-07-15T00:00:00.000Z' } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[1]]} members={[]} />)
    // Slice gives "2026-07-15", not a potentially shifted date
    expect(screen.getByTestId('item-field-cell-deadline')).toHaveTextContent('2026-07-15')
  })

  it('formats status as the raw string value', () => {
    const item = { id: 1, fields: { status: 'Closed' } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[2]]} members={[]} />)
    expect(screen.getByTestId('item-field-cell-status')).toHaveTextContent('Closed')
  })

  it('formats text as the raw string value', () => {
    const item = { id: 1, fields: { note: 'review needed' } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[3]]} members={[]} />)
    expect(screen.getByTestId('item-field-cell-note')).toHaveTextContent('review needed')
  })

  it('resolves person to member email', () => {
    const item = { id: 1, fields: { owner: 42 } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[4]]} members={MEMBERS} />)
    expect(screen.getByTestId('item-field-cell-owner')).toHaveTextContent('alice@example.com')
  })

  it('falls back to String(value) when person id not found in members', () => {
    const item = { id: 1, fields: { owner: 999 } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[4]]} members={MEMBERS} />)
    expect(screen.getByTestId('item-field-cell-owner')).toHaveTextContent('999')
  })
})

// ---------------------------------------------------------------------------
// Skips null/undefined/empty valued defs
// ---------------------------------------------------------------------------

describe('ItemFieldCells — skips empty values', () => {
  it('does not render a cell for a null value', () => {
    const item = { id: 1, fields: { budget: null } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[0]]} members={[]} />)
    expect(screen.queryByTestId('item-field-cell-budget')).toBeNull()
  })

  it('does not render a cell for an undefined value', () => {
    const item = { id: 1, fields: {} }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[0]]} members={[]} />)
    expect(screen.queryByTestId('item-field-cell-budget')).toBeNull()
  })

  it('does not render a cell for an empty-string value', () => {
    const item = { id: 1, fields: { note: '' } }
    render(<ItemFieldCells item={item} fieldDefs={[DEFS[3]]} members={[]} />)
    expect(screen.queryByTestId('item-field-cell-note')).toBeNull()
  })

  it('returns nothing (no container) when item has no displayable values', () => {
    const item = { id: 1, fields: {} }
    const { container } = render(<ItemFieldCells item={item} fieldDefs={DEFS} members={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns nothing when fieldDefs is empty', () => {
    const item = { id: 1, fields: { budget: 100 } }
    const { container } = render(<ItemFieldCells item={item} fieldDefs={[]} members={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
