// backend/services/taskService.js
'use strict';

async function forUser(pool, userId, { limit = 200 } = {}) {
  const r = await pool.query(
    `SELECT li.*, l.name AS list_name, l.project_id AS project_id, p.name AS project_name, p.workspace_id AS workspace_id
FROM list_items li
JOIN lists l ON l.id = li.list_id
LEFT JOIN projects p ON p.id = l.project_id
WHERE li.assignee_id = $1
  AND (
    l.user_id = $1
    OR EXISTS (SELECT 1 FROM list_shares ls WHERE ls.list_id = l.id AND ls.user_id = $1)
    OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1)
  )
ORDER BY li.due_date ASC NULLS LAST, li.created_at ASC
LIMIT $2`,
    [userId, limit]
  );
  return r.rows;
}

module.exports = { forUser };
