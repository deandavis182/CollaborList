import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { listColor, statusChipColor } from '../../lib/listColor.js'

export function TaskResultRow({ task, showListContext = false, assigneeEmail, onOpen }) {
  return (
    <button
      type="button"
      data-testid={`result-row-${task.id}`}
      onClick={onOpen}
      className="w-full flex items-center gap-3 py-[13px] px-1 text-left border-b border-border"
    >
      <span className={['w-[22px] h-[22px] rounded-full border-2 shrink-0', task.completed ? 'bg-success border-success' : 'border-border'].join(' ')} />
      <span className="min-w-0 flex-1">
        <span className={['block text-[15px] font-semibold truncate', task.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{task.text}</span>
        <span className="flex items-center gap-1.5 flex-wrap mt-1">
          {showListContext && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: listColor(task.list_id) }} />
              {task.list_name}
            </span>
          )}
          {task.status && task.status !== 'To do' && <Chip color={statusChipColor(task.status)}>{task.status}</Chip>}
          {task.due_date && <Chip color="neutral">{task.due_date.slice(5)}</Chip>}
        </span>
      </span>
      {task.assignee_id != null && <Avatar name={assigneeEmail || String(task.assignee_id)} size="sm" />}
    </button>
  )
}
