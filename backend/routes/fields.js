// backend/routes/fields.js
'use strict';

const express = require('express');
const pool = require('../db/pool');
const events = require('../realtime/events');
const { getItemAccess } = require('../services/itemAccess');
const fieldService = require('../services/fieldService');
const itemFieldService = require('../services/itemFieldService');

/**
 * Factory matching the router style in routes/comments.js / routes/projects.js.
 *
 * @param {Function} authenticateToken - Express middleware that populates req.user
 * @param {Function} sanitize          - Input sanitizer (returns string)
 * @param {{ list: Function }} emit    - emit.list(listId, eventName, payload)
 */
module.exports = (authenticateToken, sanitize, emit) => {
  const router = express.Router();
  router.use(authenticateToken);

  // GET /api/lists/:listId/field-defs
  router.get('/lists/:listId/field-defs', async (req, res) => {
    try {
      const userId = req.user.id;
      const { listId } = req.params;
      const access = await fieldService.getListAccess(pool, listId, userId);
      if (!access.found)   return res.status(404).json({ error: 'List not found' });
      if (!access.canView) return res.status(403).json({ error: 'Not authorized' });

      const defs = await fieldService.listDefs(pool, listId);
      res.json(defs);
    } catch (e) {
      console.error('GET /lists/:listId/field-defs error:', e);
      res.status(500).json({ error: 'Failed to fetch field defs' });
    }
  });

  // POST /api/lists/:listId/field-defs
  router.post('/lists/:listId/field-defs', async (req, res) => {
    try {
      const userId = req.user.id;
      const { listId } = req.params;
      const access = await fieldService.getListAccess(pool, listId, userId);
      if (!access.found)    return res.status(404).json({ error: 'List not found' });
      if (!access.canEdit)  return res.status(403).json({ error: 'Not authorized' });

      const { key, type, label, config, position } = req.body;
      const safeKey   = sanitize(key);
      const safeLabel = sanitize(label || '');

      let def;
      try {
        def = await fieldService.createDef(pool, listId, { key: safeKey, type, label: safeLabel, config, position });
      } catch (err) {
        if (err.code === 'BAD_TYPE') return res.status(400).json({ error: err.message });
        throw err;
      }

      try {
        emit.list(listId, events.FIELD_UPDATED, { listId: Number(listId) });
      } catch (emitErr) {
        console.error('emit.list FIELD_UPDATED failed (non-fatal):', emitErr);
      }

      res.status(201).json(def);
    } catch (e) {
      console.error('POST /lists/:listId/field-defs error:', e);
      res.status(500).json({ error: 'Failed to create field def' });
    }
  });

  // PUT /api/field-defs/:id
  router.put('/field-defs/:id', async (req, res) => {
    try {
      const userId = req.user.id;
      const defId  = req.params.id;

      const listId = await fieldService.listIdOfDef(pool, defId);
      if (listId == null) return res.status(404).json({ error: 'Field def not found' });

      const access = await fieldService.getListAccess(pool, listId, userId);
      if (!access.found)   return res.status(404).json({ error: 'List not found' });
      if (!access.canEdit) return res.status(403).json({ error: 'Not authorized' });

      const { label, config, position, type } = req.body;
      const updateFields = {};
      if (label    != null) updateFields.label    = sanitize(label);
      if (config   != null) updateFields.config   = config;
      if (position != null) updateFields.position = position;
      if (type     != null) updateFields.type     = type;

      let def;
      try {
        def = await fieldService.updateDef(pool, defId, updateFields);
      } catch (err) {
        if (err.code === 'BAD_TYPE') return res.status(400).json({ error: err.message });
        throw err;
      }

      try {
        emit.list(listId, events.FIELD_UPDATED, { listId });
      } catch (emitErr) {
        console.error('emit.list FIELD_UPDATED failed (non-fatal):', emitErr);
      }

      res.json(def);
    } catch (e) {
      console.error('PUT /field-defs/:id error:', e);
      res.status(500).json({ error: 'Failed to update field def' });
    }
  });

  // DELETE /api/field-defs/:id
  router.delete('/field-defs/:id', async (req, res) => {
    try {
      const userId = req.user.id;
      const defId  = req.params.id;

      const listId = await fieldService.listIdOfDef(pool, defId);
      if (listId == null) return res.status(404).json({ error: 'Field def not found' });

      const access = await fieldService.getListAccess(pool, listId, userId);
      if (!access.found)   return res.status(404).json({ error: 'List not found' });
      if (!access.canEdit) return res.status(403).json({ error: 'Not authorized' });

      await fieldService.removeDef(pool, defId);

      try {
        emit.list(listId, events.FIELD_UPDATED, { listId });
      } catch (emitErr) {
        console.error('emit.list FIELD_UPDATED failed (non-fatal):', emitErr);
      }

      res.json({ success: true });
    } catch (e) {
      console.error('DELETE /field-defs/:id error:', e);
      res.status(500).json({ error: 'Failed to delete field def' });
    }
  });

  // POST /api/lists/:listId/field-presets
  router.post('/lists/:listId/field-presets', async (req, res) => {
    try {
      const userId = req.user.id;
      const { listId } = req.params;
      const { preset } = req.body;

      const access = await fieldService.getListAccess(pool, listId, userId);
      if (!access.found)   return res.status(404).json({ error: 'List not found' });
      if (!access.canEdit) return res.status(403).json({ error: 'Not authorized' });

      let defs;
      try {
        defs = await fieldService.applyPreset(pool, listId, preset);
      } catch (err) {
        if (err.code === 'BAD_PRESET') return res.status(400).json({ error: err.message });
        throw err;
      }

      try {
        emit.list(listId, events.FIELD_UPDATED, { listId: Number(listId) });
      } catch (emitErr) {
        console.error('emit.list FIELD_UPDATED failed (non-fatal):', emitErr);
      }

      res.status(201).json(defs);
    } catch (e) {
      console.error('POST /lists/:listId/field-presets error:', e);
      res.status(500).json({ error: 'Failed to apply field preset' });
    }
  });

  // PUT /api/items/:id/fields
  router.put('/items/:id/fields', async (req, res) => {
    try {
      const userId = req.user.id;
      const itemId = req.params.id;
      const { key, type, value } = req.body;

      const access = await getItemAccess(pool, itemId, userId);
      if (!access.found)   return res.status(404).json({ error: 'Item not found' });
      if (!access.canEdit) return res.status(403).json({ error: 'Not authorized' });

      const row = await itemFieldService.setValue(pool, itemId, { key, type, value });

      try {
        emit.list(access.listId, events.FIELD_UPDATED, { listId: access.listId, itemId: Number(itemId) });
      } catch (emitErr) {
        console.error('emit.list FIELD_UPDATED failed (non-fatal):', emitErr);
      }

      if (row === null) {
        return res.json({ removed: true });
      }
      res.json(row);
    } catch (e) {
      console.error('PUT /items/:id/fields error:', e);
      res.status(500).json({ error: 'Failed to set field value' });
    }
  });

  return router;
};
