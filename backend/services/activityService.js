'use strict';

/**
 * Record an activity event. `db` may be a pg Pool or a transaction client —
 * both expose `.query`, so callers inside a transaction can pass their client.
 *
 * @param {object} db - pg Pool or transaction client
 * @param {{ workspaceId, projectId?, actorId, verb, target?, meta? }} opts
 * @returns {object} inserted activity row
 */
async function record(db, { workspaceId, projectId = null, actorId, verb, target = null, meta = {} }) {
  const r = await db.query(
    `INSERT INTO activity (workspace_id, project_id, actor_id, verb, target, meta)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [workspaceId, projectId, actorId, verb, target, meta]
  );
  return r.rows[0];
}

/**
 * List activity for a workspace, newest-first, joined to actor email.
 *
 * @param {object} pool - pg Pool
 * @param {number|string} workspaceId
 * @param {{ limit? }} opts
 * @returns {Array} activity rows with actor_email
 */
async function listForWorkspace(pool, workspaceId, { limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT a.*, u.email AS actor_email
     FROM activity a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.workspace_id = $1
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $2`,
    [workspaceId, limit]
  );
  return r.rows;
}

/**
 * Count activity rows newer than this member's last_seen_activity watermark.
 * NULL watermark means all rows count.
 *
 * @param {object} pool - pg Pool
 * @param {number|string} workspaceId
 * @param {number|string} userId
 * @returns {number} unread count
 */
async function unreadCount(pool, workspaceId, userId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM activity a
     WHERE a.workspace_id = $1
       AND a.created_at > COALESCE(
         (SELECT last_seen_activity FROM workspace_members WHERE workspace_id = $1 AND user_id = $2),
         '-infinity'::timestamp
       )`,
    [workspaceId, userId]
  );
  return r.rows[0].count;
}

/**
 * Update the member's last_seen_activity watermark to NOW().
 *
 * @param {object} pool - pg Pool
 * @param {number|string} workspaceId
 * @param {number|string} userId
 */
async function markRead(pool, workspaceId, userId) {
  await pool.query(
    `UPDATE workspace_members SET last_seen_activity = NOW() WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
}

/**
 * Resolve an item's list to its workspace and project context.
 * Returns NULLs when the list has no project or doesn't exist.
 *
 * @param {object} pool - pg Pool
 * @param {number|string} listId
 * @returns {{ workspaceId, projectId }}
 */
async function projectContextForList(pool, listId) {
  const r = await pool.query(
    `SELECT p.workspace_id AS "workspaceId", l.project_id AS "projectId"
     FROM lists l LEFT JOIN projects p ON p.id = l.project_id
     WHERE l.id = $1`,
    [listId]
  );
  if (r.rows.length === 0) return { workspaceId: null, projectId: null };
  return r.rows[0];
}

module.exports = { record, listForWorkspace, unreadCount, markRead, projectContextForList };
