'use strict';
const { nextDueDate } = require('../lib/recurrence');

async function maybeSpawnNext(pool, { item, prevCompleted }) {
  if (!item) return null;
  const becameCompleted = item.completed === true && prevCompleted !== true;
  if (!becameCompleted) return null;
  if (!item.recur_unit || !item.recur_interval || !item.due_date) return null;

  const due = nextDueDate(item.due_date, item.recur_unit, item.recur_interval);
  const r = await pool.query(
    `INSERT INTO list_items
       (list_id, text, parent_id, assignee_id, due_date, status, completed, recur_unit, recur_interval, position)
     VALUES ($1, $2, $3, $4, $5, 'To do', FALSE, $6, $7,
             COALESCE((SELECT MAX(position) FROM list_items WHERE list_id = $1), 0) + 1000)
     RETURNING *`,
    [item.list_id, item.text, item.parent_id, item.assignee_id, due, item.recur_unit, item.recur_interval]
  );
  return r.rows[0];
}
module.exports = { maybeSpawnNext };
