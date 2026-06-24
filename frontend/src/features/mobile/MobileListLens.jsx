import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { statusChipColor } from '../../lib/listColor.js'
import { useUpdateItem } from '../../lib/api.js'
export function MobileListLens({ listId, items = [], members = [], onOpen }) {
  const { mutate } = useUpdateItem(listId)
  const emailById = Object.fromEntries(members.map((m) => [m.user_id, m.email]))
  return (
    <div className="h-full overflow-y-auto px-[18px] pb-[116px]">
      {items.map((item) => (
        <div key={item.id} data-testid={`lens-row-${item.id}`} className="flex items-center gap-3 py-[13px] px-1 border-b border-border">
          <button type="button" data-testid={`lens-check-${item.id}`} aria-label={item.completed ? 'Completed' : 'Mark complete'}
            onClick={() => mutate({ id: item.id, completed: !item.completed })}
            className={['w-[22px] h-[22px] rounded-full border-2 shrink-0', item.completed ? 'bg-success border-success' : 'border-border'].join(' ')} />
          <button type="button" onClick={() => onOpen?.(item.id)} className="min-w-0 flex-1 text-left">
            <span className={['block text-[15px] font-semibold truncate', item.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{item.text}</span>
            <span className="flex items-center gap-1.5 mt-1">
              {item.status && item.status !== 'To do' && <Chip color={statusChipColor(item.status)}>{item.status}</Chip>}
              {item.due_date && <Chip color="neutral">{item.due_date.slice(5)}</Chip>}
            </span>
          </button>
          {item.assignee_id != null && <Avatar name={emailById[item.assignee_id] || String(item.assignee_id)} size="sm" />}
        </div>
      ))}
    </div>
  )
}
