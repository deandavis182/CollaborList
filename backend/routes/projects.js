// backend/routes/projects.js
'use strict';

const express = require('express');
const pool = require('../db/pool');
const proj = require('../services/projectService');
const { requireWorkspaceRole } = require('../middleware/permissions');

module.exports = (authenticateToken, sanitize) => {
  const router = express.Router();
  router.use(authenticateToken);

  // Resolve the workspace for permission checks on a project id.
  async function attachWorkspace(req, res, next) {
    try {
      const wsId = await proj.getWorkspaceIdForProject(pool, req.params.id);
      if (!wsId) return res.status(404).json({ error: 'Project not found' });
      req.workspaceId = wsId;
      next();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to resolve project' });
    }
  }

  // PUT /api/projects/:id — update project (requires >= member via workspace)
  router.put('/:id', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    const fields = { ...req.body };
    if ('name' in fields) fields.name = sanitize(fields.name);
    try {
      res.json(await proj.update(pool, req.params.id, fields));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  // DELETE /api/projects/:id — delete project (requires >= member via workspace)
  router.delete('/:id', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      await proj.remove(pool, req.params.id);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // GET /api/projects/:id/lists — lists in a project (requires >= member of its workspace)
  router.get('/:id/lists', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM lists WHERE project_id=$1 ORDER BY created_at DESC',
        [req.params.id]
      );
      res.json(r.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch project lists' });
    }
  });

  // GET /api/projects/:id/items — all items across the project's lists, with list name + tags
  router.get('/:id/items', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT li.*, l.name AS list_name,
           COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name,'color',t.color) ORDER BY t.name)
                     FROM item_tags it JOIN tags t ON t.id=it.tag_id WHERE it.item_id=li.id), '[]'::json) AS tags,
           COALESCE((SELECT json_object_agg(f.key, f.value) FROM item_fields f WHERE f.item_id=li.id), '{}'::json) AS fields
         FROM list_items li
         JOIN lists l ON l.id = li.list_id
         WHERE l.project_id = $1
         ORDER BY li.due_date ASC NULLS LAST, li.position`,
        [req.params.id]
      );
      res.json(r.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch project items' });
    }
  });

  return router;
};
