/**
 * ItemDetailDrawer — slide-in drawer for editing a single item's details.
 *
 * Props:
 *   listId      : string | number  — the list the item belongs to
 *   workspaceId : string | number  — workspace for member resolution (optional)
 *
 * Opens when store.detailItemId is set; closes via store.closeDetail.
 */

import { useRef, useState, useEffect } from 'react'
import { useStore } from '../../lib/store.js'
import { useListItems, useUpdateItem, useWorkspaceMembers } from '../../lib/api.js'
import { Sheet } from '../../ui/Sheet.jsx'
import { Field } from '../../ui/Field.jsx'
import { StatusControl } from './StatusControl.jsx'
import { AssigneePicker } from './AssigneePicker.jsx'
import { DueDateField } from './DueDateField.jsx'
import { CommentThread } from '../comments/CommentThread.jsx'

export function ItemDetailDrawer({ listId, workspaceId }) {
  const detailItemId = useStore((s) => s.detailItemId)
  const closeDetail = useStore((s) => s.closeDetail)

  const { data: items = [] } = useListItems(listId)
  const item = items.find((it) => String(it.id) === String(detailItemId)) ?? null

  const { data: members = [] } = useWorkspaceMembers(workspaceId)

  const updateItem = useUpdateItem(listId)

  // ---------------------------------------------------------------------------
  // Local controlled state for the text input — keep in sync when item changes
  // ---------------------------------------------------------------------------
  const [textValue, setTextValue] = useState(item?.text ?? '')

  useEffect(() => {
    setTextValue(item?.text ?? '')
  }, [item?.id, item?.text])

  // ---------------------------------------------------------------------------
  // Local controlled state for notes — debounce 500ms before mutating
  // ---------------------------------------------------------------------------
  const [notesValue, setNotesValue] = useState(item?.notes ?? '')
  const notesDebounceRef = useRef(null)

  useEffect(() => {
    setNotesValue(item?.notes ?? '')
  }, [item?.id, item?.notes])

  function handleNotesChange(e) {
    const notes = e.target.value
    setNotesValue(notes)

    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current)
    }
    notesDebounceRef.current = setTimeout(() => {
      updateItem.mutate({ id: item.id, notes })
    }, 500)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) {
        clearTimeout(notesDebounceRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Text commit handlers
  // ---------------------------------------------------------------------------
  function commitText() {
    if (!item) return
    const trimmed = textValue.trim()
    if (!trimmed) return
    if (trimmed !== item.text) {
      updateItem.mutate({ id: item.id, text: trimmed })
    }
  }

  function handleTextKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitText()
      e.target.blur()
    }
  }

  return (
    <Sheet
      variant="drawer"
      open={Boolean(detailItemId && item)}
      onClose={closeDetail}
      title={item?.text ?? 'Item'}
    >
      <div data-testid="item-detail-drawer" className="flex flex-col gap-5">

        {/* 1. Title / text */}
        <Field label="Title" htmlFor="item-detail-title">
          <input
            id="item-detail-title"
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={handleTextKeyDown}
            className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </Field>

        {/* 2. Status */}
        <Field label="Status">
          <StatusControl
            value={item?.status}
            onChange={(status) => updateItem.mutate({ id: item.id, status })}
          />
        </Field>

        {/* 3. Assignee */}
        <Field label="Assignee" htmlFor="item-detail-assignee">
          <AssigneePicker
            value={item?.assignee_id}
            members={members}
            onChange={(assignee_id) => updateItem.mutate({ id: item.id, assignee_id })}
          />
        </Field>

        {/* 4. Due date */}
        <Field label="Due date" htmlFor="item-detail-due-date">
          <DueDateField
            value={item?.due_date}
            onChange={(due_date) => updateItem.mutate({ id: item.id, due_date })}
          />
        </Field>

        {/* 5. Notes — debounced 500ms */}
        <Field label="Notes" htmlFor="item-detail-notes">
          <textarea
            id="item-detail-notes"
            value={notesValue}
            onChange={handleNotesChange}
            rows={4}
            className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
          />
        </Field>

        {/* 6. Comments */}
        {item && (
          <CommentThread itemId={item.id} workspaceId={workspaceId} listId={listId} />
        )}

      </div>
    </Sheet>
  )
}
