import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useUpdateItem: vi.fn(),
}))

import { useUpdateItem } from '../../../lib/api.js'
import { RecurrencePicker } from '../RecurrencePicker.jsx'

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

const ITEM_NO_RECUR = {
  id: 10,
  list_id: 'list-1',
  text: 'A task',
  recur_unit: null,
  recur_interval: null,
}

const ITEM_WEEKLY = {
  id: 11,
  list_id: 'list-1',
  text: 'Weekly task',
  recur_unit: 'week',
  recur_interval: 1,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RecurrencePicker', () => {
  let mutateSpy

  beforeEach(() => {
    vi.clearAllMocks()
    mutateSpy = vi.fn()
    useUpdateItem.mockReturnValue({ mutate: mutateSpy, isPending: false })
  })

  // -------------------------------------------------------------------------
  // 1. Renders with testid
  // -------------------------------------------------------------------------
  it('renders the recurrence-picker container', () => {
    render(<RecurrencePicker item={ITEM_NO_RECUR} />, { wrapper: Wrapper })

    expect(screen.getByTestId('recurrence-picker')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 2. Unit select reflects item.recur_unit
  // -------------------------------------------------------------------------
  it('shows "None" selected when item has no recur_unit', () => {
    render(<RecurrencePicker item={ITEM_NO_RECUR} />, { wrapper: Wrapper })

    const select = screen.getByTestId('recurrence-unit')
    expect(select.value).toBe('')
  })

  it('reflects item.recur_unit = "week" in the unit select', () => {
    render(<RecurrencePicker item={ITEM_WEEKLY} />, { wrapper: Wrapper })

    const select = screen.getByTestId('recurrence-unit')
    expect(select.value).toBe('week')
  })

  // -------------------------------------------------------------------------
  // 3. Interval input is hidden when no unit selected
  // -------------------------------------------------------------------------
  it('does NOT render recurrence-interval when recur_unit is null', () => {
    render(<RecurrencePicker item={ITEM_NO_RECUR} />, { wrapper: Wrapper })

    expect(screen.queryByTestId('recurrence-interval')).not.toBeInTheDocument()
  })

  it('renders recurrence-interval when recur_unit is set', () => {
    render(<RecurrencePicker item={ITEM_WEEKLY} />, { wrapper: Wrapper })

    expect(screen.getByTestId('recurrence-interval')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 4. Choosing Weekly calls mutate with recur_unit:'week', recur_interval:1
  // -------------------------------------------------------------------------
  it('choosing Weekly calls mutate({ id, recur_unit: "week", recur_interval: 1 })', () => {
    render(<RecurrencePicker item={ITEM_NO_RECUR} />, { wrapper: Wrapper })

    const select = screen.getByTestId('recurrence-unit')
    fireEvent.change(select, { target: { value: 'week' } })

    expect(mutateSpy).toHaveBeenCalledWith({
      id: ITEM_NO_RECUR.id,
      recur_unit: 'week',
      recur_interval: 1,
    })
  })

  // -------------------------------------------------------------------------
  // 5. Changing the interval calls mutate with new recur_interval
  // -------------------------------------------------------------------------
  it('changing the interval input calls mutate with the new recur_interval', () => {
    render(<RecurrencePicker item={ITEM_WEEKLY} />, { wrapper: Wrapper })

    const intervalInput = screen.getByTestId('recurrence-interval')
    fireEvent.change(intervalInput, { target: { value: '3' } })

    expect(mutateSpy).toHaveBeenCalledWith({
      id: ITEM_WEEKLY.id,
      recur_unit: 'week',
      recur_interval: 3,
    })
  })

  // -------------------------------------------------------------------------
  // 6. Choosing None calls mutate with recur_unit:null, recur_interval:null
  // -------------------------------------------------------------------------
  it('choosing None calls mutate({ id, recur_unit: null, recur_interval: null })', () => {
    render(<RecurrencePicker item={ITEM_WEEKLY} />, { wrapper: Wrapper })

    const select = screen.getByTestId('recurrence-unit')
    fireEvent.change(select, { target: { value: '' } })

    expect(mutateSpy).toHaveBeenCalledWith({
      id: ITEM_WEEKLY.id,
      recur_unit: null,
      recur_interval: null,
    })
  })

  // -------------------------------------------------------------------------
  // 7. useUpdateItem is called with the correct listId
  // -------------------------------------------------------------------------
  it('calls useUpdateItem with item.list_id', () => {
    render(<RecurrencePicker item={ITEM_NO_RECUR} />, { wrapper: Wrapper })

    expect(useUpdateItem).toHaveBeenCalledWith(ITEM_NO_RECUR.list_id)
  })
})
