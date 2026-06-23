/**
 * NotificationPrefs — Sheet for managing push notification preferences.
 *
 * Props:
 *   open    : boolean
 *   onClose : function
 *
 * Contains:
 *   - EnableNotifications at top
 *   - Four category toggle checkboxes (assignments, mentions, comments, reminders)
 *   - Quiet-hours start/end inputs + Clear button
 *
 * Note: per-project mute UI is deferred (data layer exists but UI is out of scope
 * for this task — it belongs in the Project settings view).
 */

import { useState, useEffect } from 'react'
import { Sheet } from '../../ui/Sheet.jsx'
import { Field } from '../../ui/Field.jsx'
import { Button } from '../../ui/Button.jsx'
import { EnableNotifications } from './EnableNotifications.jsx'
import { useNotificationPrefs, useUpdateNotificationPrefs } from '../../lib/api.js'

const CATEGORIES = [
  { key: 'assignments', label: 'Assignments', testid: 'pref-assignments' },
  { key: 'mentions',    label: 'Mentions',    testid: 'pref-mentions' },
  { key: 'comments',    label: 'Comments',    testid: 'pref-comments' },
  { key: 'reminders',  label: 'Due reminders', testid: 'pref-reminders' },
]

export function NotificationPrefs({ open, onClose }) {
  const { data: prefs } = useNotificationPrefs()
  const updatePrefs = useUpdateNotificationPrefs()

  // Local state for quiet hours inputs
  const [qhStart, setQhStart] = useState('')
  const [qhEnd,   setQhEnd]   = useState('')

  // Sync quiet-hours local state when prefs load/change
  useEffect(() => {
    if (prefs?.quietHours) {
      setQhStart(String(prefs.quietHours.start ?? ''))
      setQhEnd(String(prefs.quietHours.end ?? ''))
    } else {
      setQhStart('')
      setQhEnd('')
    }
  }, [prefs?.quietHours])

  function handleToggle(key, currentValue) {
    updatePrefs.mutate({ [key]: !currentValue })
  }

  function handleQuietHoursChange() {
    const start = parseInt(qhStart, 10)
    const end   = parseInt(qhEnd, 10)
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      updatePrefs.mutate({ quietHours: { start, end } })
    }
  }

  function handleClearQuietHours() {
    setQhStart('')
    setQhEnd('')
    updatePrefs.mutate({ quietHours: null })
  }

  return (
    <Sheet
      variant="drawer"
      open={open}
      onClose={onClose}
      title="Notifications"
    >
      <div data-testid="notification-prefs" className="flex flex-col gap-6">

        {/* ── Push enable / status ─────────────────────────────────────── */}
        <section>
          <EnableNotifications />
        </section>

        {/* ── Category toggles ─────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Notify me about
          </h3>
          <ul className="flex flex-col gap-3">
            {CATEGORIES.map(({ key, label, testid }) => {
              const checked = prefs ? Boolean(prefs[key]) : false
              return (
                <li key={key} className="flex items-center justify-between">
                  <label
                    htmlFor={`pref-${key}`}
                    className="text-sm text-text cursor-pointer"
                  >
                    {label}
                  </label>
                  <input
                    id={`pref-${key}`}
                    type="checkbox"
                    data-testid={testid}
                    checked={checked}
                    onChange={() => handleToggle(key, checked)}
                    className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                  />
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Quiet hours ──────────────────────────────────────────────── */}
        <section data-testid="pref-quiet-hours">
          <h3 className="mb-1 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Quiet hours
          </h3>
          <p className="mb-3 text-xs text-text-muted">
            No notifications will be sent during this window (0–23, wrap-around supported).
          </p>
          <div className="flex items-end gap-3">
            <Field label="Start (0–23)" htmlFor="qh-start">
              <input
                id="qh-start"
                type="number"
                min={0}
                max={23}
                value={qhStart}
                onChange={(e) => setQhStart(e.target.value)}
                onBlur={handleQuietHoursChange}
                placeholder="e.g. 22"
                className="w-20 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="End (0–23)" htmlFor="qh-end">
              <input
                id="qh-end"
                type="number"
                min={0}
                max={23}
                value={qhEnd}
                onChange={(e) => setQhEnd(e.target.value)}
                onBlur={handleQuietHoursChange}
                placeholder="e.g. 8"
                className="w-20 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearQuietHours}
              className="mb-0.5"
            >
              Clear
            </Button>
          </div>
        </section>

      </div>
    </Sheet>
  )
}
