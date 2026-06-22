// backend/services/projectService.js
'use strict';

async function listForWorkspace(pool, workspaceId) {
  const r = await pool.query(
    'SELECT * FROM projects WHERE workspace_id=$1 ORDER BY position, created_at', [workspaceId]);
  return r.rows;
}

async function create(pool, workspaceId, { name, color = null, wedding_date = null }) {
  const r = await pool.query(
    'INSERT INTO projects (workspace_id, name, color, wedding_date) VALUES ($1,$2,$3,$4) RETURNING *',
    [workspaceId, name, color, wedding_date]);
  return r.rows[0];
}

async function getWorkspaceIdForProject(pool, projectId) {
  const r = await pool.query('SELECT workspace_id FROM projects WHERE id=$1', [projectId]);
  return r.rows.length ? r.rows[0].workspace_id : null;
}

async function update(pool, projectId, fields) {
  const allowed = ['name', 'color', 'wedding_date', 'archived', 'position'];
  const sets = [], vals = [];
  for (const k of allowed) {
    if (k in fields && fields[k] !== undefined) {
      vals.push(fields[k]);
      sets.push(`${k}=$${vals.length}`);
    }
  }
  if (!sets.length) {
    const r = await pool.query('SELECT * FROM projects WHERE id=$1', [projectId]);
    return r.rows[0];
  }
  vals.push(projectId);
  const r = await pool.query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
  return r.rows[0];
}

async function remove(pool, projectId) {
  await pool.query('DELETE FROM projects WHERE id=$1', [projectId]);
}

module.exports = { listForWorkspace, create, getWorkspaceIdForProject, update, remove };
