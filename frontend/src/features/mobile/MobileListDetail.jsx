import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useListItems, useWorkspaceMembers, useUpdateItem } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { BoardView } from '../views/BoardView.jsx'
import { MobileListLens } from './MobileListLens.jsx'

const LENS = [{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }]

export function MobileListDetail() {
  const { workspaceId, listId } = useParams()
  const navigate = useNavigate()
  const [lens, setLens] = useState('list')
  const { data: items = [] } = useListItems(listId)
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const { mutate: updateItem } = useUpdateItem(listId)
  const openItem = useStore((s) => s.openItem)

  const onOpen = (id) => openItem(id, { listId: Number(listId), workspaceId: Number(workspaceId) })
  const onMove = ({ id, ...changes }) => updateItem({ id, ...changes })
  const listName = items[0]?.list_name || 'List'

  return (
    <div data-testid="mobile-list-detail" className="flex flex-col h-full bg-bg">
      <div className="px-[18px] pt-[60px] pb-3 shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-[34px] h-[34px] rounded-full bg-surface-2 text-text-muted text-xl leading-none grid place-items-center">‹</button>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold font-display text-text truncate">{listName}</h1>
          </div>
        </div>
        <SegmentedControl options={LENS} value={lens} onChange={setLens} />
      </div>
      <div className="flex-1 overflow-hidden">
        {lens === 'list'
          ? <MobileListLens listId={listId} items={items} members={members} onOpen={onOpen} />
          : <div className="h-full overflow-x-auto px-[18px] pb-[116px]"><BoardView items={items} members={members} groupMode="status" onMove={onMove} onOpen={onOpen} /></div>}
      </div>
    </div>
  )
}
