import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useListItems: vi.fn(),
  useCreateItem: vi.fn(),
  useUpdateItem: vi.fn(),
}))

import { useListItems, useCreateItem, useUpdateItem } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ListItems } from '../ListItems.jsx'

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

function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
    socket: null,
  })
}

const defaultMutateSpy = vi.fn()

function setupDefaultMocks({ items = [], isLoading = false } = {}) {
  useListItems.mockReturnValue({ data: items, isLoading })
  useCreateItem.mockReturnValue({ mutate: defaultMutateSpy, isPending: false })
  useUpdateItem.mockReturnValue({ mutate: defaultMutateSpy, isPending: false })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ListItems', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    defaultMutateSpy.mockReset()
  })

  // ---- loading state ----
  it('shows loading indicator while items are loading', () => {
    setupDefaultMocks({ isLoading: true })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('list-items-loading')).toBeInTheDocument()
  })

  // ---- empty state ----
  it('shows empty state when there are no items', () => {
    setupDefaultMocks({ items: [] })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('list-items-empty')).toBeInTheDocument()
  })

  // ---- renders item text ----
  it('renders item text', () => {
    setupDefaultMocks({
      items: [{ id: 'i1', text: 'Buy milk', completed: false }],
    })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  // ---- renders status chip ----
  it('renders status chip for items with status', () => {
    setupDefaultMocks({
      items: [{ id: 'i1', text: 'Task A', completed: false, status: 'Doing' }],
    })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    expect(screen.getByText('Doing')).toBeInTheDocument()
  })

  // ---- renders assignee avatar ----
  it('renders assignee avatar when assignee_id and members are provided', () => {
    setupDefaultMocks({
      items: [
        { id: 'i1', text: 'Assigned task', completed: false, assignee_id: 42 },
      ],
    })

    const members = [{ user_id: 42, email: 'alice@example.com' }]
    render(<ListItems listId="list-1" members={members} />, { wrapper: Wrapper })

    // Avatar renders initials or aria-label from member email
    expect(screen.getByLabelText('alice@example.com')).toBeInTheDocument()
  })

  // ---- toggling checkbox calls updateItem.mutate ----
  it('toggling the checkbox calls updateItem.mutate with { id, completed: !completed }', () => {
    const updateMutate = vi.fn()
    useListItems.mockReturnValue({
      data: [{ id: 'i1', text: 'Task', completed: false }],
      isLoading: false,
    })
    useCreateItem.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useUpdateItem.mockReturnValue({ mutate: updateMutate, isPending: false })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(updateMutate).toHaveBeenCalledWith({ id: 'i1', completed: true })
  })

  // ---- clicking row body calls openDetail ----
  it('clicking the row body calls openDetail(item.id)', () => {
    setupDefaultMocks({
      items: [{ id: 'i1', text: 'Task', completed: false }],
    })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    // Click the item row (but not the checkbox)
    const row = screen.getByTestId('item-row-i1')
    fireEvent.click(row)

    expect(useStore.getState().detailItemId).toBe('i1')
  })

  // ---- clicking checkbox does NOT call openDetail ----
  it('clicking the checkbox does NOT open the detail panel', () => {
    const updateMutate = vi.fn()
    useListItems.mockReturnValue({
      data: [{ id: 'i1', text: 'Task', completed: false }],
      isLoading: false,
    })
    useCreateItem.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useUpdateItem.mockReturnValue({ mutate: updateMutate, isPending: false })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    // detailItemId should remain null
    expect(useStore.getState().detailItemId).toBeNull()
  })

  // ---- add item ----
  it('typing text and clicking Add calls createItem.mutate({ text }) and clears the input', () => {
    const createMutate = vi.fn()
    useListItems.mockReturnValue({ data: [], isLoading: false })
    useCreateItem.mockReturnValue({ mutate: createMutate, isPending: false })
    useUpdateItem.mockReturnValue({ mutate: vi.fn(), isPending: false })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    const input = screen.getByTestId('add-item-input')
    fireEvent.change(input, { target: { value: 'New item text' } })

    const addButton = screen.getByTestId('add-item-button')
    fireEvent.click(addButton)

    expect(createMutate).toHaveBeenCalledWith({ text: 'New item text' })
    expect(input.value).toBe('')
  })

  // ---- add item on Enter ----
  it('pressing Enter in the add-item input calls createItem.mutate', () => {
    const createMutate = vi.fn()
    useListItems.mockReturnValue({ data: [], isLoading: false })
    useCreateItem.mockReturnValue({ mutate: createMutate, isPending: false })
    useUpdateItem.mockReturnValue({ mutate: vi.fn(), isPending: false })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    const input = screen.getByTestId('add-item-input')
    fireEvent.change(input, { target: { value: 'Enter item' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(createMutate).toHaveBeenCalledWith({ text: 'Enter item' })
  })

  // ---- empty / whitespace does nothing ----
  it('empty or whitespace text does NOT call createItem.mutate', () => {
    const createMutate = vi.fn()
    useListItems.mockReturnValue({ data: [], isLoading: false })
    useCreateItem.mockReturnValue({ mutate: createMutate, isPending: false })
    useUpdateItem.mockReturnValue({ mutate: vi.fn(), isPending: false })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    const addButton = screen.getByTestId('add-item-button')
    fireEvent.click(addButton)

    expect(createMutate).not.toHaveBeenCalled()

    const input = screen.getByTestId('add-item-input')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(addButton)

    expect(createMutate).not.toHaveBeenCalled()
  })

  // ---- presence-list emit on mount ----
  it('emits presence-list with listId when socket is in the store', () => {
    const socketEmit = vi.fn()
    useStore.setState({ socket: { emit: socketEmit } })
    setupDefaultMocks({ items: [] })

    render(<ListItems listId="list-42" />, { wrapper: Wrapper })

    expect(socketEmit).toHaveBeenCalledWith('presence-list', 'list-42')
  })

  it('does not throw when socket is null', () => {
    useStore.setState({ socket: null })
    setupDefaultMocks({ items: [] })

    // Should render without error
    expect(() =>
      render(<ListItems listId="list-1" />, { wrapper: Wrapper })
    ).not.toThrow()
  })

  // ---- nesting: child has greater padding than parent ----
  it('a child item (parent_id set) renders with greater left padding than its parent', () => {
    setupDefaultMocks({
      items: [
        { id: 'parent-1', text: 'Parent', completed: false, parent_id: null },
        { id: 'child-1', text: 'Child', completed: false, parent_id: 'parent-1' },
      ],
    })

    render(<ListItems listId="list-1" />, { wrapper: Wrapper })

    const parentRow = screen.getByTestId('item-row-parent-1')
    const childRow = screen.getByTestId('item-row-child-1')

    const parentPadding = parseInt(parentRow.style.paddingLeft || '0', 10)
    const childPadding = parseInt(childRow.style.paddingLeft || '0', 10)

    expect(childPadding).toBeGreaterThan(parentPadding)
  })
})
