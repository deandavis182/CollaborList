'use strict';
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

// Query items due within the next 24h (or overdue) that still need a reminder.
// Joins list → project → workspace for the deep link. Derives `kind` in SQL.
async function findDueItems(pool, now) {
  const result = await pool.query(
    `SELECT li.id, li.text, li.due_date, li.assignee_id,
            li.list_id,
            p.id   AS project_id,
            p.workspace_id AS workspace_id,
            CASE
              WHEN li.due_date < date_trunc('day', $1::timestamptz) THEN 'overdue'
              WHEN li.due_date < date_trunc('day', $1::timestamptz) + interval '1 day' THEN 'today'
              ELSE 'soon'
            END AS kind
     FROM list_items li
     JOIN lists l    ON l.id = li.list_id
     LEFT JOIN projects p ON p.id = l.project_id
     WHERE li.assignee_id IS NOT NULL
       AND li.completed = FALSE
       AND li.reminder_sent = FALSE
       AND li.due_date IS NOT NULL
       AND li.due_date <= $1::timestamptz + interval '24 hours'`,
    [now]
  );
  return result.rows;
}

async function runReminderSweep(pool, now = new Date()) {
  const items = await findDueItems(pool, now);
  if (items.length === 0) return { scanned: 0, sent: 0 };

  const notified = [];
  for (const it of items) {
    try {
      await notificationService.notifyDueReminder(pool, {
        assigneeId: it.assignee_id,
        item: { id: it.id, text: it.text },
        projectId: it.project_id,
        listId: it.list_id,
        workspaceId: it.workspace_id,
        kind: it.kind,
      });
      notified.push(it.id);
    } catch (e) {
      console.error('reminder notify failed (non-fatal):', e);
    }
  }

  if (notified.length > 0) {
    await pool.query('UPDATE list_items SET reminder_sent = TRUE WHERE id = ANY($1)', [notified]);
  }
  return { scanned: items.length, sent: notified.length };
}

function startReminderJob(pool, { intervalMs = 15 * 60 * 1000 } = {}) {
  if (!pushService.isEnabled()) {
    console.warn('reminders: push disabled — reminder job not started.');
    return null;
  }
  const timer = setInterval(() => {
    runReminderSweep(pool, new Date()).catch((e) => console.error('reminder sweep error (non-fatal):', e));
  }, intervalMs);
  if (timer.unref) timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { findDueItems, runReminderSweep, startReminderJob };
