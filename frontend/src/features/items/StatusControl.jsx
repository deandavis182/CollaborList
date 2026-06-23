/**
 * StatusControl — segmented picker for item status.
 *
 * Props:
 *   value    : string   — current status value
 *   onChange : function — called with the selected status string
 */

import { SegmentedControl } from '../../ui/SegmentedControl.jsx'

const STATUS_OPTIONS = [
  { value: 'To do', label: 'To do' },
  { value: 'Doing', label: 'Doing' },
  { value: 'Done', label: 'Done' },
  { value: 'Blocked', label: 'Blocked' },
]

export function StatusControl({ value, onChange }) {
  return (
    <SegmentedControl
      options={STATUS_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}
