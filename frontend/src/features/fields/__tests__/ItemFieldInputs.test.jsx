import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock lib/api.js — we test wiring, not HTTP
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useFieldDefs:          vi.fn(),
  useSetItemField:       vi.fn(),
  useWorkspaceMembers:   vi.fn(),
}))

import {
  useFieldDefs,
  useSetItemField,
  useWorkspaceMembers,
} from '../../../lib/api.js'

import { ItemFieldInputs } from '../ItemFieldInputs.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
  )
}

const mutateSpy = vi.fn()

const MEMBERS = [
  { user_id: 7, email: 'alice@example.com' },
  { user_id: 8, email: 'bob@example.com' },
]

const DEFS = [
  { id: 1, key: 'budget',   label: 'Budget',   type: 'number', config: {} },
  { id: 2, key: 'title',    label: 'Title',    type: 'text',   config: {} },
  { id: 3, key: 'deadline', label: 'Deadline', type: 'date',   config: {} },
  { id: 4, key: 'phase',    label: 'Phase',    type: 'status', config: { options: ['Open', 'In Progress', 'Done'] } },
  { id: 5, key: 'owner',    label: 'Owner',    type: 'person', config: {} },
]

const ITEM = {
  id: 42,
  fields: {
    budget:   100,
    title:    'Hello',
    deadline: '2026-07-15T00:00:00.000Z',
    phase:    'Open',
    owner:    7,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mutateSpy.mockReset()
  useFieldDefs.mockReturnValue({ data: DEFS, isLoading: false })
  useSetItemField.mockReturnValue({ mutate: mutateSpy })
  useWorkspaceMembers.mockReturnValue({ data: MEMBERS, isLoading: false })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ItemFieldInputs', () => {
  // ── Render ──────────────────────────────────────────────────────────────────

  it('renders data-testid="item-field-inputs" when defs exist', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('item-field-inputs')).toBeInTheDocument()
  })

  it('renders one control per def with data-testid="item-field-{key}"', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('item-field-budget')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-title')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-deadline')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-phase')).toBeInTheDocument()
    expect(screen.getByTestId('item-field-owner')).toBeInTheDocument()
  })

  it('renders the label for each def', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Deadline')).toBeInTheDocument()
    expect(screen.getByText('Phase')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('renders nothing meaningful when defs is empty', () => {
    useFieldDefs.mockReturnValue({ data: [], isLoading: false })
    const { container } = render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    // item-field-inputs should not be in DOM when empty
    expect(screen.queryByTestId('item-field-inputs')).not.toBeInTheDocument()
  })

  // ── Number control ───────────────────────────────────────────────────────────

  it('number control shows the current value from item.fields', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-budget')
    expect(input).toHaveValue(100)
  })

  it('number change calls mutate with { itemId, key, type:"number", value:Number }', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-budget')
    fireEvent.change(input, { target: { value: '250' } })
    fireEvent.blur(input)
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'budget',
      type:   'number',
      value:  250,
    })
  })

  it('number change with empty value calls mutate with value: null', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-budget')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'budget',
      type:   'number',
      value:  null,
    })
  })

  // ── Text control (debounced 400ms) ───────────────────────────────────────────

  it('text control shows the current value from item.fields', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-title')
    expect(input).toHaveValue('Hello')
  })

  it('text change does NOT call mutate before 400ms debounce', () => {
    vi.useFakeTimers()
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-title')
    fireEvent.change(input, { target: { value: 'Updated' } })
    act(() => vi.advanceTimersByTime(300))
    expect(mutateSpy).not.toHaveBeenCalled()
  })

  it('text change calls mutate after 400ms debounce with value:string', () => {
    vi.useFakeTimers()
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-title')
    fireEvent.change(input, { target: { value: 'Updated' } })
    act(() => vi.advanceTimersByTime(400))
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'title',
      type:   'text',
      value:  'Updated',
    })
  })

  it('text change with empty string calls mutate with value: null', () => {
    vi.useFakeTimers()
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-title')
    fireEvent.change(input, { target: { value: '' } })
    act(() => vi.advanceTimersByTime(400))
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'title',
      type:   'text',
      value:  null,
    })
  })

  // ── Date control ─────────────────────────────────────────────────────────────

  it('date control shows YYYY-MM-DD without UTC shift for stored ISO value', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-deadline')
    // String slice of the stored ISO string gives correct calendar day
    expect(input).toHaveValue('2026-07-15')
  })

  it('date change calls mutate with { key, type:"date", value:YYYY-MM-DD }', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-deadline')
    fireEvent.change(input, { target: { value: '2026-08-01' } })
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'deadline',
      type:   'date',
      value:  '2026-08-01',
    })
  })

  it('clearing the date calls mutate with value: null', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const input = screen.getByTestId('item-field-deadline')
    fireEvent.change(input, { target: { value: '' } })
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'deadline',
      type:   'date',
      value:  null,
    })
  })

  // ── Status control ───────────────────────────────────────────────────────────

  it('status control shows options from def.config.options', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('status control has the current value as active (aria-pressed=true)', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a status option calls mutate with { key, type:"status", value:option }', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'phase',
      type:   'status',
      value:  'Done',
    })
  })

  // ── Person control ───────────────────────────────────────────────────────────

  it('person control shows members and Unassigned option', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const select = screen.getByTestId('item-field-owner')
    expect(select).toBeInTheDocument()
    // Unassigned option
    expect(screen.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'alice@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'bob@example.com' })).toBeInTheDocument()
  })

  it('person control reflects the current user_id from item.fields', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const select = screen.getByTestId('item-field-owner')
    expect(select.value).toBe('7')
  })

  it('selecting a member calls mutate with value: Number(user_id)', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const select = screen.getByTestId('item-field-owner')
    fireEvent.change(select, { target: { value: '8' } })
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'owner',
      type:   'person',
      value:  8,
    })
  })

  it('selecting Unassigned calls mutate with value: null', () => {
    render(
      <ItemFieldInputs item={ITEM} listId="1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )
    const select = screen.getByTestId('item-field-owner')
    fireEvent.change(select, { target: { value: '' } })
    expect(mutateSpy).toHaveBeenCalledWith({
      itemId: 42,
      key:    'owner',
      type:   'person',
      value:  null,
    })
  })
})
