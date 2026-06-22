// backend/routes/workspaces.js
'use strict';

const express = require('express');
const pool = require('../db/pool');
const svc = require('../services/workspaceService');
const { requireWorkspaceRole } = require('../middleware/permissions');

// Factory: receives authenticateToken and sanitize from server.js
module.exports = (authenticateToken, sanitize) => {
  const router = express.Router();
  router.use(authenticateToken);

  // GET /api/workspaces — list workspaces the current user belongs to
  router.get('/', async (req, res) => {
    try {
      res.json(await svc.listForUser(pool, req.user.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
  });

  // POST /api/workspaces — create a new workspace
  router.post('/', async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Workspace name required' });
    try {
      res.status(201).json(await svc.create(pool, req.user.id, name));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  });

  // PUT /api/workspaces/:workspaceId — rename (requires >= admin)
  router.put('/:workspaceId', requireWorkspaceRole(pool, 'admin'), async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Workspace name required' });
    try {
      const updated = await svc.rename(pool, req.params.workspaceId, name);
      if (!updated) return res.status(404).json({ error: 'Workspace not found' });
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update workspace' });
    }
  });

  // DELETE /api/workspaces/:workspaceId — delete workspace (requires owner)
  router.delete('/:workspaceId', requireWorkspaceRole(pool, 'owner'), async (req, res) => {
    try {
      await svc.remove(pool, req.params.workspaceId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete workspace' });
    }
  });

  // GET /api/workspaces/:workspaceId/members — list members (requires >= member)
  router.get('/:workspaceId/members', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      res.json(await svc.listMembers(pool, req.params.workspaceId));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch members' });
    }
  });

  // POST /api/workspaces/:workspaceId/members — add member by email (requires >= admin)
  router.post('/:workspaceId/members', requireWorkspaceRole(pool, 'admin'), async (req, res) => {
    try {
      res.status(201).json(
        await svc.addMemberByEmail(pool, req.params.workspaceId, sanitize(req.body.email), req.body.role)
      );
    } catch (e) {
      if (e.code === 'NO_USER') {
        return res.status(404).json({ error: 'No user with that email' });
      }
      console.error(e);
      res.status(500).json({ error: 'Failed to add member' });
    }
  });

  // DELETE /api/workspaces/:workspaceId/members/:userId — remove member (requires owner)
  router.delete('/:workspaceId/members/:userId', requireWorkspaceRole(pool, 'owner'), async (req, res) => {
    try {
      await svc.removeMember(pool, req.params.workspaceId, req.params.userId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  const proj = require('../services/projectService');

  // GET /api/workspaces/:workspaceId/projects — list projects (requires >= member)
  router.get('/:workspaceId/projects', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      res.json(await proj.listForWorkspace(pool, req.params.workspaceId));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // POST /api/workspaces/:workspaceId/projects — create project (requires >= member)
  router.post('/:workspaceId/projects', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Project name required' });
    try {
      res.status(201).json(await proj.create(pool, req.params.workspaceId, {
        name,
        color: req.body.color || null,
        wedding_date: req.body.wedding_date || null,
      }));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  const tagSvc = require('../services/tagService');

  // GET /api/workspaces/:workspaceId/tags — list tags (requires >= member)
  router.get('/:workspaceId/tags', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      res.json(await tagSvc.listForWorkspace(pool, req.params.workspaceId));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  // POST /api/workspaces/:workspaceId/tags — create tag (requires >= member)
  router.post('/:workspaceId/tags', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Tag name required' });
    try {
      res.status(201).json(await tagSvc.create(pool, req.params.workspaceId, {
        name,
        color: req.body.color || null,
      }));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create tag' });
    }
  });

  // DELETE /api/workspaces/:workspaceId/tags/:tagId — delete tag (requires >= member)
  router.delete('/:workspaceId/tags/:tagId', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      // Verify the tag belongs to this workspace before deleting
      const wsId = await tagSvc.workspaceIdOfTag(pool, req.params.tagId);
      if (!wsId) return res.status(404).json({ error: 'Tag not found' });
      if (String(wsId) !== String(req.params.workspaceId)) {
        return res.status(403).json({ error: 'Tag does not belong to this workspace' });
      }
      await tagSvc.remove(pool, req.params.tagId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete tag' });
    }
  });

  return router;
};
