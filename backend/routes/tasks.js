// backend/routes/tasks.js
'use strict';

const express = require('express');
const pool = require('../db/pool');
const taskService = require('../services/taskService');

module.exports = (authenticateToken) => {
  const router = express.Router();
  router.use(authenticateToken);

  // GET /api/me/tasks — items assigned to the current user across all accessible lists
  router.get('/tasks', async (req, res) => {
    try {
      res.json(await taskService.forUser(pool, req.user.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // GET /api/me/items — ALL items accessible to the current user (not just assigned to them)
  router.get('/items', async (req, res) => {
    try {
      res.json(await taskService.accessibleForUser(pool, req.user.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  return router;
};
