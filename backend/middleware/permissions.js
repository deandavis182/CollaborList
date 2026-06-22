const ROLE_ORDER = { member: 1, admin: 2, owner: 3 };

async function getWorkspaceRole(pool, workspaceId, userId) {
  const r = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return r.rows.length ? r.rows[0].role : null;
}

function requireWorkspaceRole(pool, minRole) {
  return async (req, res, next) => {
    try {
      const workspaceId = req.workspaceId || req.params.workspaceId;
      if (!workspaceId) return res.status(400).json({ error: 'Workspace id required' });
      const role = await getWorkspaceRole(pool, workspaceId, req.user.id);
      if (!role || ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
        return res.status(403).json({ error: 'Insufficient workspace permission' });
      }
      req.workspaceRole = role;
      req.workspaceId = workspaceId;
      next();
    } catch (e) {
      console.error('Permission check error:', e);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = { getWorkspaceRole, requireWorkspaceRole, ROLE_ORDER };
