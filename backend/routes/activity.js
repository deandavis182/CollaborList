// backend/routes/activity.js
'use strict';

const express = require('express');
const pool = require('../db/pool');
const activityService = require('../services/activityService');
const { requireWorkspaceRole } = require('../middleware/permissions');

module.exports = (authenticateToken, sanitize, emit) => {
  const router = express.Router();
  router.use(authenticateToken);

  // GET /api/activity/workspace/:workspaceId
  // Returns activity feed for a workspace (newest-first, up to 50)
  // plus the caller's unread count.
  router.get('/workspace/:workspaceId', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const [items, unread] = await Promise.all([
        activityService.listForWorkspace(pool, workspaceId, { limit: 50 }),
        activityService.unreadCount(pool, workspaceId, req.user.id),
      ]);
      res.json({ items, unread });
    } catch (e) {
      console.error('Error fetching activity feed:', e);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  // POST /api/activity/workspace/:workspaceId/read
  // Marks all current activity as read for the calling user.
  router.post('/workspace/:workspaceId/read', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try {
      const { workspaceId } = req.params;
      await activityService.markRead(pool, workspaceId, req.user.id);
      res.json({ success: true });
    } catch (e) {
      console.error('Error marking activity read:', e);
      res.status(500).json({ error: 'Failed to mark activity read' });
    }
  });

  return router;
};
