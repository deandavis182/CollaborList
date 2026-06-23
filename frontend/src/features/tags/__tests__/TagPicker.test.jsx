import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useTags: vi.fn(),
  useAddItemTag: vi.fn(),
  useRemoveItemTag: vi.fn(),
}))

import { useTags, useAddItemTag, useRemoveItemTag } from '../../../lib/api.js'
import { TagPicker } from '../TagPicker.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      {children}
    </QueryClientProvider>
  )
}

const WORKSPACE_ID = 'ws-1'
const LIST_ID = 'list-1'

const TAG_A = { id: 'tag-a', name: 'Urgent', color: '#ef4444' }
const TAG_B = { id: 'tag-b', name: 'Feature', color: '#3b82f6' }
const TAG_C = { id: 'tag-c', name: 'Bug', color: null }

// An item that already has TAG_A applied
const ITEM_WITH_ONE_TAG = {
  id: 'item-1',
  text: 'My task',
  tags: [TAG_A],
}

// An item with no tags
const ITEM_NO_TAGS = {
  id: 'item-2',
  text: 'No tags task',
  tags: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TagPicker', () => {
  let mockAddMutate
  let mockRemoveMutate

  beforeEach(() => {
    vi.clearAllMocks()

    mockAddMutate = vi.fn()
    mockRemoveMutate = vi.fn()

    // All workspace tags
    useTags.mockReturnValue({ data: [TAG_A, TAG_B, TAG_C], isLoading: false })
    useAddItemTag.mockReturnValue({ mutate: mockAddMutate, isPending: false })
    useRemoveItemTag.mockReturnValue({ mutate: mockRemoveMutate, isPending: false })
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders the tag-picker container', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('tag-picker')).toBeInTheDocument()
  })

  it('renders existing item tags as chips with correct testids', () => {
    render(
      <TagPicker item={ITEM_WITH_ONE_TAG} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('item-tag-tag-a')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('does NOT render chips for tags not on the item', () => {
    render(
      <TagPicker item={ITEM_WITH_ONE_TAG} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByTestId('item-tag-tag-b')).not.toBeInTheDocument()
    expect(screen.queryByTestId('item-tag-tag-c')).not.toBeInTheDocument()
  })

  it('renders no applied-tag chips when item.tags is empty', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    // No tag chips exist
    expect(screen.queryByTestId(/^item-tag-/)).not.toBeInTheDocument()
  })

  // ── Remove ────────────────────────────────────────────────────────────────

  it('clicking × on a chip calls useRemoveItemTag.mutate({ itemId, tagId })', () => {
    render(
      <TagPicker item={ITEM_WITH_ONE_TAG} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )

    const removeButton = screen.getByRole('button', { name: 'Remove' })
    fireEvent.click(removeButton)

    expect(mockRemoveMutate).toHaveBeenCalledWith({
      itemId: 'item-1',
      tagId: 'tag-a',
    })
  })

  it('uses String() coercion — works when ids are numbers', () => {
    const itemNumericIds = {
      id: 100,
      text: 'Numeric ids',
      tags: [{ id: 7, name: 'Urgent', color: '#ef4444' }],
    }

    render(
      <TagPicker item={itemNumericIds} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )

    const removeButton = screen.getByRole('button', { name: 'Remove' })
    fireEvent.click(removeButton)

    expect(mockRemoveMutate).toHaveBeenCalledWith({
      itemId: 100,
      tagId: 7,
    })
  })

  // ── Add menu ──────────────────────────────────────────────────────────────

  it('renders a "+ Tag" button', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByRole('button', { name: /\+ tag/i })).toBeInTheDocument()
  })

  it('clicking "+ Tag" shows only workspace tags NOT already on the item', () => {
    render(
      <TagPicker item={ITEM_WITH_ONE_TAG} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /\+ tag/i }))

    // TAG_A is already on the item — should NOT appear in menu
    expect(screen.queryByTestId('tag-option-tag-a')).not.toBeInTheDocument()
    // TAG_B and TAG_C are not on item — should appear
    expect(screen.getByTestId('tag-option-tag-b')).toBeInTheDocument()
    expect(screen.getByTestId('tag-option-tag-c')).toBeInTheDocument()
  })

  it('selecting a tag from the menu calls useAddItemTag.mutate({ itemId, tag_id })', () => {
    render(
      <TagPicker item={ITEM_WITH_ONE_TAG} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /\+ tag/i }))
    fireEvent.click(screen.getByTestId('tag-option-tag-b'))

    expect(mockAddMutate).toHaveBeenCalledWith({
      itemId: 'item-1',
      tag_id: 'tag-b',
    })
  })

  it('closing the menu (clicking again) hides the options', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )

    const addBtn = screen.getByRole('button', { name: /\+ tag/i })
    fireEvent.click(addBtn) // open
    expect(screen.getByTestId('tag-option-tag-a')).toBeInTheDocument()

    fireEvent.click(addBtn) // close
    expect(screen.queryByTestId('tag-option-tag-a')).not.toBeInTheDocument()
  })

  it('shows a hint when all workspace tags are already on the item', () => {
    const itemAllTags = {
      id: 'item-full',
      text: 'All tags applied',
      tags: [TAG_A, TAG_B, TAG_C],
    }

    render(
      <TagPicker item={itemAllTags} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /\+ tag/i }))

    expect(screen.getByText(/no more tags/i)).toBeInTheDocument()
  })

  it('useAddItemTag is called with listId', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(useAddItemTag).toHaveBeenCalledWith(LIST_ID)
  })

  it('useRemoveItemTag is called with listId', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(useRemoveItemTag).toHaveBeenCalledWith(LIST_ID)
  })

  it('useTags is called with workspaceId', () => {
    render(
      <TagPicker item={ITEM_NO_TAGS} workspaceId={WORKSPACE_ID} listId={LIST_ID} />,
      { wrapper: Wrapper }
    )
    expect(useTags).toHaveBeenCalledWith(WORKSPACE_ID)
  })
})
