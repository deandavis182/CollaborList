/**
 * TagPicker — display and edit an item's tags.
 *
 * Props:
 *   item        : object             — the item (must have item.id and item.tags:[])
 *   workspaceId : string | number    — used to fetch workspace tags
 *   listId      : string | number    — used for cache invalidation on mutation
 *
 * Renders:
 *   - Current item tags as removable Chips
 *   - A "+ Tag" button that opens a small menu of unapplied workspace tags
 */

import { useState } from 'react'
import { useTags, useAddItemTag, useRemoveItemTag } from '../../lib/api.js'
import { Chip } from '../../ui/Chip.jsx'

/**
 * Map an arbitrary hex color string to one of the Chip color tokens.
 * Re-uses the same mapping as TagManager.
 */
function hexToChipColor(hex) {
  if (!hex) return 'neutral'
  const h = hex.toLowerCase()
  if (h === '#ef4444') return 'danger'
  if (h === '#22c55e') return 'success'
  if (h === '#eab308') return 'warning'
  if (h === '#3b82f6') return 'primary'
  if (h === '#8b5cf6') return 'accent'
  return 'neutral'
}

export function TagPicker({ item, workspaceId, listId }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: workspaceTags = [] } = useTags(workspaceId)
  const { mutate: addTag } = useAddItemTag(listId)
  const { mutate: removeTag } = useRemoveItemTag(listId)

  const itemTags = item?.tags ?? []

  // Build a Set of already-applied tag ids (using String coercion for safety)
  const appliedIds = new Set(itemTags.map((t) => String(t.id)))

  // Tags available to add
  const availableTags = workspaceTags.filter((t) => !appliedIds.has(String(t.id)))

  function handleRemove(tag) {
    removeTag({ itemId: item.id, tagId: tag.id })
  }

  function handleAdd(tag) {
    addTag({ itemId: item.id, tag_id: tag.id })
    setMenuOpen(false)
  }

  return (
    <div data-testid="tag-picker" className="flex flex-wrap items-center gap-1.5">
      {/* Applied tag chips */}
      {itemTags.map((tag) => (
        <Chip
          key={String(tag.id)}
          data-testid={`item-tag-${tag.id}`}
          color={hexToChipColor(tag.color)}
          onRemove={() => handleRemove(tag)}
        >
          {tag.name}
        </Chip>
      ))}

      {/* Add tag control */}
      <div className="relative">
        <button
          type="button"
          aria-label="+ Tag"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-medium rounded-sm bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          + Tag
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-md border border-border bg-surface shadow-lg py-1"
          >
            {availableTags.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-text-muted">No more tags available</p>
            ) : (
              availableTags.map((tag) => (
                <button
                  key={String(tag.id)}
                  type="button"
                  role="menuitem"
                  data-testid={`tag-option-${tag.id}`}
                  onClick={() => handleAdd(tag)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Chip color={hexToChipColor(tag.color)} className="pointer-events-none">
                    {tag.name}
                  </Chip>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
