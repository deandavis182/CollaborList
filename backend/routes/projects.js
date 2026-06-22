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

  return router;
};
