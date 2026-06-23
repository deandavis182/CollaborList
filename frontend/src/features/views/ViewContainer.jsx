/**
 * ViewContainer — integration point that owns view-switching, mutation routing,
 * and delegates rendering to the selected lens.
 *
 * Props:
 *   items        : array   — pre-fetched item objects to display
 *   listId       : string|number|null  — present for list-scoped contexts
 *   workspaceId  : string|number|null
 *   projectId    : string|number|null
 *   scopeKey     : string  — stable key used by useViewPref for localStorage
 *   weddingDate  : Date    — optional; passed to Calendar/Timeline lenses
 *   members      : array   — [{ user_id, email }]
 *   showAddItem  : boolean — whether the add-item bar should be exposed
 */

import { useState } from 'react'
import { useViewPref } from '../../lib/useViewPref.js'
import { useUpdateAnyItem, useCreateItem, useFieldDefs } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { ViewSwitcher } from './ViewSwitcher.jsx'
import { ListViewLens } from './ListViewLens.jsx'
import { BoardView } from './BoardView.jsx'
import { CalendarView } from './CalendarView.jsx'
import { TimelineView } from './TimelineView.jsx'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { Button } from '../../ui/Button.jsx'
import { FieldsManager } from '../fields/FieldsManager.jsx'
import { FieldRollups } from '../fields/FieldRollups.jsx'

const GROUP_BY_OPTIONS = [
  { value: 'none',       label: 'None' },
  { value: 'completion', label: 'Completion' },
  { value: 'status',     label: 'Status' },
  { value: 'assignee',   label: 'Assignee' },
  { value: 'tag',        label: 'Tag' },
]

export function ViewContainer({
  items = [],
  listId,
  workspaceId,    // eslint-disable-line no-unused-vars
  projectId,      // eslint-disable-line no-unused-vars
  scopeKey = 'default',
  weddingDate,
  members = [],
  showAddItem = false,
  onOpenItem,
}) {
  // ── View preference (persisted per scope) ──────────────────────────────────
  const { view, setView, groupBy, setGroupBy } = useViewPref(scopeKey)

  // ── Board-specific local groupMode ─────────────────────────────────────────
  const [boardMode, setBoardMode] = useState('status')

  // ── Fields manager open state ──────────────────────────────────────────────
  const [fieldsOpen, setFieldsOpen] = useState(false)

  // ── Field defs — enabled only when listId is present (hook guards internally) ─
  const { data: fieldDefs = [] } = useFieldDefs(listId)

  // ── Mutations — always called unconditionally (React rules) ────────────────
  const updateAny  = useUpdateAnyItem()
  // useCreateItem requires a listId; pass null-safe String coercion.
  // We always call the hook but only expose the add-item handler when appropriate.
  const createItem = useCreateItem(listId != null ? String(listId) : null)

  // ── Store action ───────────────────────────────────────────────────────────
  const openDetail = useStore((s) => s.openDetail)

  // ── Handlers ───────────────────────────────────────────────────────────────
  function onToggleComplete(item) {
    updateAny.mutate({
      id: item.id,
      list_id: item.list_id,
      completed: !item.completed,
    })
  }

  function onMove(item, changes) {
    updateAny.mutate({
      id: item.id,
      list_id: item.list_id,
      ...changes,
    })
  }

  function onOpen(id) {
    const item = items.find((it) => String(it.id) === String(id))
    if (onOpenItem && item) {
      onOpenItem(item)
    } else {
      openDetail(id)
    }
  }

  function onAddItem(text) {
    createItem.mutate({ text })
  }

  // The add-item handler is only exposed when the caller says so AND we have a list scope.
  const addItemHandler = showAddItem && listId != null ? onAddItem : undefined

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div data-testid="view-container" className="flex flex-col gap-3">
      {/* Header row: ViewSwitcher + optional group-by control + Fields button */}
      <div className="flex items-center gap-4 flex-wrap">
        <ViewSwitcher view={view} onChange={setView} />

        {view === 'list' && (
          <SegmentedControl
            data-testid="groupby-control"
            options={GROUP_BY_OPTIONS}
            value={groupBy}
            onChange={setGroupBy}
          />
        )}

        {listId != null && (
          <Button
            variant="secondary"
            size="sm"
            data-testid="open-fields-btn"
            onClick={() => setFieldsOpen(true)}
          >
            Fields
          </Button>
        )}
      </div>

      {/* Fields manager sheet — only rendered when listId is present */}
      {listId != null && (
        <FieldsManager
          listId={listId}
          open={fieldsOpen}
          onClose={() => setFieldsOpen(false)}
        />
      )}

      {/* Active lens */}
      {view === 'list' && (
        <>
          <ListViewLens
            items={items}
            members={members}
            fieldDefs={fieldDefs}
            groupBy={groupBy}
            onToggleComplete={onToggleComplete}
            onOpen={onOpen}
            onAddItem={addItemHandler}
          />
          <FieldRollups fieldDefs={fieldDefs} items={items} />
        </>
      )}

      {view === 'board' && (
        <BoardView
          items={items}
          members={members}
          groupMode={boardMode}
          onGroupModeChange={setBoardMode}
          onMove={onMove}
          onOpen={onOpen}
        />
      )}

      {view === 'calendar' && (
        <CalendarView
          items={items}
          weddingDate={weddingDate}
          onOpen={onOpen}
        />
      )}

      {view === 'timeline' && (
        <TimelineView
          items={items}
          weddingDate={weddingDate}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}
