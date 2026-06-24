import { useRef } from 'react'
import { useUpdateItem } from '../../lib/api.js'
import { Chip } from '../../ui/Chip.jsx'
import { listColor, statusChipColor } from '../../lib/listColor.js'

const THRESHOLD = 78
function nextDay(due) {
  const base = due ? new Date(due + 'T00:00:00') : new Date()
  base.setDate(base.getDate() + 1)
  return base.toISOString().slice(0, 10)
}

export function TaskCard({ task, onOpen }) {
  const { mutate } = useUpdateItem(task.list_id)
  const fgRef = useRef(null)
  const state = useRef({ active: false, axis: null, startX: 0, startY: 0, dx: 0 })

  function onPointerDown(e) {
    state.current = { active: true, axis: null, startX: e.clientX, startY: e.clientY, dx: 0 }
    fgRef.current?.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    const s = state.current
    if (!s.active) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (!s.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (s.axis === 'y') { s.active = false; return } // let the list scroll
    }
    s.dx = dx
    if (fgRef.current) {
      fgRef.current.style.transition = 'none'
      fgRef.current.style.transform = `translateX(${dx}px)`
    }
  }
  function onPointerUp() {
    const s = state.current
    if (!s.active) { state.current.active = false; return }
    s.active = false
    const dx = s.dx
    const fg = fgRef.current
    if (Math.abs(dx) < 6 && s.axis !== 'x') { onOpen?.(); return }
    if (Math.abs(dx) >= THRESHOLD) {
      const dir = dx > 0 ? 1 : -1
      if (fg) {
        fg.style.transition = 'transform 230ms ease, opacity 230ms ease'
        fg.style.transform = `translateX(${dir * 115}%)`
        fg.style.opacity = '0'
      }
      setTimeout(() => {
        if (dir > 0) mutate({ id: task.id, completed: true })
        else mutate({ id: task.id, due_date: nextDay(task.due_date) })
      }, 240)
    } else {
      if (fg) { fg.style.transition = 'transform 200ms ease'; fg.style.transform = 'translateX(0)' }
      if (Math.abs(dx) < 6) onOpen?.()
    }
  }

  return (
    <div data-testid={`task-card-${task.id}`} className="relative rounded-2xl overflow-hidden" style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-0 flex items-center justify-between px-4 text-[13px] font-bold">
        <span className="text-success">✓ Done</span>
        <span className="text-warning">Tomorrow →</span>
      </div>
      <div
        ref={fgRef}
        data-testid={`swipe-fg-${task.id}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative bg-surface border border-border shadow-card rounded-2xl px-[14px] py-[13px] flex items-start gap-3"
      >
        <button
          type="button"
          aria-label={task.completed ? 'Completed' : 'Mark complete'}
          onClick={(e) => { e.stopPropagation(); mutate({ id: task.id, completed: !task.completed }) }}
          className={['w-[22px] h-[22px] rounded-full border-2 shrink-0 mt-0.5', task.completed ? 'bg-success border-success' : 'border-border'].join(' ')}
        />
        <div className="min-w-0 flex-1">
          <div className={['text-[15px] font-semibold', task.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{task.text}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: listColor(task.list_id) }} />
              {task.list_name}
            </span>
            {task.status && task.status !== 'To do' && <Chip color={statusChipColor(task.status)}>{task.status}</Chip>}
            {task.due_date && <Chip color="neutral">{task.due_date.slice(5)}</Chip>}
          </div>
        </div>
      </div>
    </div>
  )
}
