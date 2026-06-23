/**
 * ListItems — renders all items for a list with an add-item input at the bottom.
 *
 * Props:
 *   listId  : string | number  — the list whose items to display
 *   members : array            — [{ user_id, email }] passed through to ItemRow
 */

import { useState } from 'react'
import { useListItems, useCreateItem, useUpdateItem } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Button } from '../../ui/Button.jsx'
import { ItemRow } from './ItemRow.jsx'

/**
 * Build an id→depth map by walking parent_id chains.
 * Caps walk at 50 steps to prevent infinite cycles.
 */
function buildDepthMap(items) {
  const idToItem = {}
  for (const item of items) {
    idToItem[String(item.id)] = item
  }

  const depthCache = {}

  function getDepth(id, visited = new Set()) {
    const key = String(id)
    if (key in depthCache) return depthCache[key]
    if (visited.has(key) || visited.size >= 50) return 0
    const item = idToItem[key]
    if (!item || item.parent_id == null) {
      depthCache[key] = 0
      return 0
    }
    visited.add(key)
    const d = 1 + getDepth(String(item.parent_id), visited)
    depthCache[key] = d
    return d
  }

  for (const item of items) {
    getDepth(String(item.id))
  }

  return depthCache
}

export function ListItems({ listId, members = [] }) {
  const { data: items = [], isLoading } = useListItems(listId)
  const updateItem = useUpdateItem(listId)
  const createItem = useCreateItem(listId)
  const openDetail = useStore((s) => s.openDetail)

  const [addText, setAddText] = useState('')

  const depthMap = buildDepthMap(items)

  function handleAdd() {
    const text = addText.trim()
    if (!text) return
    createItem.mutate({ text })
    setAddText('')
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  if (isLoading) {
    return (
      <p data-testid="list-items-loading" className="text-sm text-text-muted py-4 text-center">
        Loading items…
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {items.length === 0 ? (
        <p data-testid="list-items-empty" className="text-sm text-text-muted py-4 text-center">
          No items yet
        </p>
      ) : (
        <ul role="list" className="flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow
                item={item}
                depth={depthMap[String(item.id)] ?? 0}
                members={members}
                onToggleComplete={(it) =>
                  updateItem.mutate({ id: it.id, completed: !it.completed })
                }
                onOpen={openDetail}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add-item input */}
      <div className="flex items-center gap-2 pt-3 mt-1 border-t border-border">
        <input
          type="text"
          data-testid="add-item-input"
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="New item…"
          className="flex-1 text-sm bg-transparent border-none outline-none text-text placeholder:text-text-muted"
        />
        <Button
          variant="secondary"
          size="sm"
          data-testid="add-item-button"
          onClick={handleAdd}
        >
          Add
        </Button>
      </div>
    </div>
  )
}
