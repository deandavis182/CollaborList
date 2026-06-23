import { SegmentedControl } from '../../ui/SegmentedControl.jsx'

const VIEW_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'timeline', label: 'Timeline' },
]

/**
 * ViewSwitcher — segmented control for switching between view modes.
 *
 * Props:
 *   view     : 'list' | 'board' | 'calendar' | 'timeline'
 *   onChange : (value: string) => void
 */
export function ViewSwitcher({ view, onChange }) {
  return (
    <SegmentedControl
      options={VIEW_OPTIONS}
      value={view}
      onChange={onChange}
      data-testid="view-switcher"
      aria-label="Switch view"
    />
  )
}
