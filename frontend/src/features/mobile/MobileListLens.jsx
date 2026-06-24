import { useRef, useState, useEffect } from 'react'
import { useUpdateItem } from '../../lib/api.js'
import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { statusChipColor } from '../../lib/listColor.js'

const ROW_H = 56
const GAP = 1000

function positionForIndex(order, targetIndex, movingId) {
  const without = order.filter((it) => it.id !== movingId)
  const prev = without[targetIndex - 1]
  const next = without[targetIndex]
  if (!prev && !next) return GAP
  if (!prev) return Math.floor(next.position / 2) || 1
  if (!next) return prev.position + GAP
  const mid = Math.floor((prev.position + next.position) / 2)
  return mid === prev.position ? prev.position + 1 : mid
}

export function MobileListLens({ listId, items, members = [], onOpen }) {
  const { mutate } = useUpdateItem(listId)
  const [order, setOrder] = useState(items)
  useEffect(() => { setOrder(items) }, [items])
  const drag = useRef({ id: null, startY: 0, startIndex: 0 })

  const emailById = Object.fromEntries(members.map((m) => [m.user_id, m.email]))

  function onHandleDown(e, item, index) {
    e.stopPropagation()
    drag.current = { id: item.id, startY: e.clientY, startIndex: index, targetIndex: index }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onHandleMove(e) {
    const d = drag.current
    if (d.id == null) return
    const dy = e.clientY - d.startY
    d.targetIndex = Math.max(0, Math.min(order.length - 1, d.startIndex + Math.round(dy / ROW_H)))
  }
  function onHandleUp() {
    const d = drag.current
    if (d.id == null) return
    const { id, startIndex, targetIndex } = d
    drag.current = { id: null }
    if (targetIndex === startIndex) return
    const moving = order.find((it) => it.id === id)
    const reordered = order.filter((it) => it.id !== id)
    reordered.splice(targetIndex, 0, moving)
    setOrder(reordered)
    const position = positionForIndex(order, targetIndex, id)
    mutate({ id, position })
  }

  return (
    <div className="h-full overflow-y-auto px-[18px] pb-[116px]">
      {order.map((item, index) => (
        <div key={item.id} data-testid={`lens-row-${item.id}`} className="flex items-center gap-3 py-[13px] px-1 border-b border-border" style={{ minHeight: ROW_H }}>
          <button
            type="button"
            data-testid={`lens-check-${item.id}`}
            aria-label={item.completed ? 'Completed' : 'Mark complete'}
            onClick={() => mutate({ id: item.id, completed: !item.completed })}
            className={['w-[22px] h-[22px] rounded-full border-2 shrink-0', item.completed ? 'bg-success border-success' : 'border-border'].join(' ')}
          />
          <button type="button" onClick={() => onOpen?.(item.id)} className="min-w-0 flex-1 text-left">
            <span className={['block text-[15px] font-semibold truncate', item.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{item.text}</span>
            <span className="flex items-center gap-1.5 mt-1">
              {item.status && item.status !== 'To do' && <Chip color={statusChipColor(item.status)}>{item.status}</Chip>}
              {item.due_date && <Chip color="neutral">{item.due_date.slice(5)}</Chip>}
            </span>
          </button>
          {item.assignee_id != null && <Avatar name={emailById[item.assignee_id] || String(item.assignee_id)} size="sm" />}
          <span
            data-testid={`reorder-handle-${item.id}`}
            data-reorder-handle
            onPointerDown={(e) => onHandleDown(e, item, index)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            className="shrink-0 cursor-grab px-1 py-2 flex flex-col gap-1"
            style={{ touchAction: 'none' }}
            aria-label="Reorder"
          >
            <span className="block w-4 h-[2px] bg-text-muted rounded-full" />
            <span className="block w-4 h-[2px] bg-text-muted rounded-full" />
            <span className="block w-4 h-[2px] bg-text-muted rounded-full" />
          </span>
        </div>
      ))}
    </div>
  )
}
