// backend/services/workspaceService.js
'use strict';

async function listForUser(pool, userId) {
  const r = await pool.query(
    `SELECT w.*, m.role FROM workspaces w
     JOIN workspace_members m ON m.workspace_id = w.id
     WHERE m.user_id = $1 ORDER BY w.created_at`,
    [userId]
  );
  return r.rows;
}

async function create(pool, userId, name) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1,$2) RETURNING *',
      [name, userId]
    );
    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')",
      [w.rows[0].id, userId]
    );
    await client.query('COMMIT');
    return { ...w.rows[0], role: 'owner' };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function rename(pool, workspaceId, name) {
  const r = await pool.query(
    'UPDATE workspaces SET name=$1 WHERE id=$2 RETURNING *',
    [name, workspaceId]
  );
  return r.rows[0];
}

async function remove(pool, workspaceId) {
  await pool.query('DELETE FROM workspaces WHERE id=$1', [workspaceId]);
}

async function listMembers(pool, workspaceId) {
  const r = await pool.query(
    `SELECT m.user_id, u.email, m.role FROM workspace_members m
     JOIN users u ON u.id = m.user_id WHERE m.workspace_id=$1 ORDER BY m.role`,
    [workspaceId]
  );
  return r.rows;
}

async function addMemberByEmail(pool, workspaceId, email, role) {
  const u = await pool.query('SELECT id, email FROM users WHERE email=$1', [email]);
  if (!u.rows.length) {
    const e = new Error('No such user');
    e.code = 'NO_USER';
    throw e;
  }
  const userId = u.rows[0].id;
  const safeRole = ['member', 'admin'].includes(role) ? role : 'member';
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [workspaceId, userId, safeRole]
  );
  return { user_id: userId, email: u.rows[0].email, role: safeRole };
}

async function removeMember(pool, workspaceId, userId) {
  await pool.query(
    'DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2',
    [workspaceId, userId]
  );
}

// Provisioning for new users — Personal workspace + General project + owner membership (one txn).
async function provisionNewUser(pool, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('Personal',$1) RETURNING id",
      [userId]
    );
    const wsId = w.rows[0].id;
    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')",
      [wsId, userId]
    );
    await client.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'General')",
      [wsId]
    );
    await client.query('COMMIT');
    return wsId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  listForUser,
  create,
  rename,
  remove,
  listMembers,
  addMemberByEmail,
  removeMember,
  provisionNewUser,
};
