import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../lib/store.js'
import { useListItems, useUpdateItem, useWorkspaceMembers } from '../../lib/api.js'
import { Sheet } from '../../ui/Sheet.jsx'
import { StatusControl } from '../items/StatusControl.jsx'
import { AssigneePicker } from '../items/AssigneePicker.jsx'
import { DueDateField } from '../items/DueDateField.jsx'
import { CommentThread } from '../comments/CommentThread.jsx'
import { listColor } from '../../lib/listColor.js'

export function MobileItemSheet() {
  const detailItemId = useStore((s) => s.detailItemId)
  const ctx = useStore((s) => s.detailContext) || {}
  const closeDetail = useStore((s) => s.closeDetail)
  const listId = ctx.listId
  const workspaceId = ctx.workspaceId

  const { data: items = [] } = useListItems(listId)
  const { mutate } = useUpdateItem(listId)
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const item = items.find((i) => String(i.id) === String(detailItemId))

  const [notes, setNotes] = useState('')
  const notesTimer = useRef(null)
  useEffect(() => { setNotes(item?.notes || '') }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!detailItemId || !item) return null

  function onNotes(v) {
    setNotes(v)
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => mutate({ id: item.id, notes: v }), 500)
  }

  return (
    <Sheet variant="bottom" open onClose={closeDetail} title={item.text} titleHidden>
      <div className="px-5 pb-8 space-y-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={item.completed ? 'Completed' : 'Mark complete'}
            onClick={() => mutate({ id: item.id, completed: !item.completed })}
            className={['w-[26px] h-[26px] rounded-full border-2 shrink-0 mt-1', item.completed ? 'bg-success border-success' : 'border-border'].join(' ')}
          />
          <h2 className="text-[21px] font-bold font-display text-text">{item.text}</h2>
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <StatusControl value={item.status} onChange={(status) => mutate({ id: item.id, status })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <FieldLabel>Assignee</FieldLabel>
            <AssigneePicker value={item.assignee_id} members={members} onChange={(assignee_id) => mutate({ id: item.id, assignee_id })} />
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <FieldLabel>Due</FieldLabel>
            <DueDateField value={item.due_date} onChange={(due_date) => mutate({ id: item.id, due_date })} />
          </div>
        </div>

        <div className="rounded-xl bg-surface-2 p-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: listColor(item.list_id) }} />
          <span className="text-[14px] text-text">{item.list_name}</span>
          {item.project_name && <span className="text-[12px] text-text-muted">· {item.project_name}</span>}
        </div>

        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={3} className="w-full rounded-xl bg-surface-2 p-3 text-[14px] text-text outline-none resize-none" placeholder="Add notes…" />
        </div>

        <CommentThread itemId={item.id} workspaceId={workspaceId} listId={listId} />
      </div>
    </Sheet>
  )
}

function FieldLabel({ children }) {
  return <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted mb-1.5">{children}</div>
}
