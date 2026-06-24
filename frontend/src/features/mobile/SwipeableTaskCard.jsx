import { Chip } from '../../ui/Chip.jsx'
import { listColor, statusChipColor } from '../../lib/listColor.js'

export function TaskCard({ task, onOpen }) {
  return (
    <button
      type="button"
      data-testid={`task-card-${task.id}`}
      onClick={onOpen}
      className="w-full text-left bg-surface border border-border shadow-card rounded-2xl px-[14px] py-[13px] flex items-start gap-3"
    >
      <span className={['w-[22px] h-[22px] rounded-full border-2 shrink-0 mt-0.5', task.completed ? 'bg-success border-success' : 'border-border'].join(' ')} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={['block text-[15px] font-semibold', task.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{task.text}</span>
        <span className="flex items-center gap-1.5 flex-wrap mt-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
            <span className="w-2 h-2 rounded-full" style={{ background: listColor(task.list_id) }} />
            {task.list_name}
          </span>
          {task.status && task.status !== 'To do' && <Chip color={statusChipColor(task.status)}>{task.status}</Chip>}
          {task.due_date && <Chip color="neutral">{task.due_date.slice(5)}</Chip>}
        </span>
      </span>
    </button>
  )
}
