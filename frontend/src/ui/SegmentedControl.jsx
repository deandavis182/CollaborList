/**
 * SegmentedControl — view-switcher (List / Board / Calendar / Timeline).
 *
 * Props:
 *   options  : Array<{ value: string, label: string }>
 *   value    : string   — currently active segment value
 *   onChange : function — called with the selected value on click
 */

export function SegmentedControl({ options = [], value, onChange }) {
  return (
    <div
      role="group"
      className="inline-flex items-center rounded-md border border-border bg-surface-2 p-0.5 gap-0.5"
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange?.(option.value)}
            className={[
              'px-3 py-1 text-sm font-medium rounded-sm transition-colors duration-[150ms]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              isActive
                ? 'bg-surface text-text shadow-sm'
                : 'bg-transparent text-text-muted hover:text-text hover:bg-surface/60',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
