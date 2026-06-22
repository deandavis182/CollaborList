// backend/__tests__/item-collab.integration.test.js
// Integration tests for item collaboration fields: assignee_id, due_date, status.
// Uses a real DB. Mounts a minimal express app replicating the POST and PUT handlers
// to avoid server.js startup side-effects (Socket.io, global pool init).
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const OWNER_EMAIL = 'item-collab-owner@example.test';
const MEMBER_EMAIL = 'item-collab-member@example.test';
const STRANGER_EMAIL = 'item-collab-stranger@example.test';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const VALID_STATUSES = ['To do', 'Doing', 'Done', 'Blocked'];

describe('Item collaboration fields (real DB)', () => {
  let pool;
  let ownerId, memberId, strangerId;
  let wsId, projectId, listId;
  let ownerToken, memberToken, strangerToken;
  let app;

  const tokenFor = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

  const sanitizeInput = (s) => (s || '').toString().replace(/[<>"'`;(){}[\]\\]/g, '').slice(0, 1000);

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp',
      user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Cleanup any leftovers from prior runs
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER_EMAIL, MEMBER_EMAIL, STRANGER_EMAIL]]);

    // Create users
    ownerId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [OWNER_EMAIL]
    )).rows[0].id;

    memberId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [MEMBER_EMAIL]
    )).rows[0].id;

    strangerId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [STRANGER_EMAIL]
    )).rows[0].id;

    // Create workspace + membership
    wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('CollabTest WS', $1) RETURNING id",
      [ownerId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
      [wsId, ownerId]
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')",
      [wsId, memberId]
    );

    // Create project in workspace
    projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1, 'CollabTest Project') RETURNING id",
      [wsId]
    )).rows[0].id;

    // Create list linked to project (owned by owner)
    listId = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('CollabTest List', $1, $2) RETURNING id",
      [ownerId, projectId]
    )).rows[0].id;

    ownerToken = tokenFor(ownerId, OWNER_EMAIL);
    memberToken = tokenFor(memberId, MEMBER_EMAIL);
    strangerToken = tokenFor(strangerId, STRANGER_EMAIL);

    // Build minimal express app that replicates the POST and PUT item handlers.
    // Uses the real pool and mirrors server.js handler logic exactly (including the
    // new assignee_id, due_date, status fields).
    app = express();
    app.use(express.json());

    const authenticateToken = (req, res, next) => {
      const h = req.headers['authorization'];
      const t = h && h.split(' ')[1];
      if (!t) return res.status(401).json({ error: 'Access token required' });
      jwt.verify(t, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
      });
    };

    // Helper: validate assignee for a given listId.
    // Returns true if assigneeId is valid for this list, false otherwise.
    async function validateAssignee(listId, assigneeId) {
      const r = await pool.query(
        `SELECT 1 FROM lists l
         WHERE l.id = $1
           AND l.project_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM workspace_members wm
             JOIN projects p ON p.workspace_id = wm.workspace_id
             WHERE p.id = l.project_id AND wm.user_id = $2
           )
         UNION ALL
         SELECT 1 FROM lists l
         WHERE l.id = $1
           AND l.project_id IS NULL
           AND (l.user_id = $2 OR EXISTS (
             SELECT 1 FROM list_shares ls WHERE ls.list_id = l.id AND ls.user_id = $2
           ))`,
        [listId, assigneeId]
      );
      return r.rows.length > 0;
    }

    // POST /api/lists/:listId/items
    app.post('/api/lists/:listId/items', authenticateToken, async (req, res) => {
      const { listId } = req.params;
      let { text, completed = false, notes = '', parent_id = null,
            assignee_id = null, due_date = null, status } = req.body;

      text = sanitizeInput(text);
      if (!text || text.length < 1) {
        return res.status(400).json({ error: 'Item text is required' });
      }

      // Status/completed sync
      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        completed = (status === 'Done');
      } else {
        status = completed ? 'Done' : 'To do';
      }

      try {
        // Permission check
        const permCheck = await pool.query(
          `SELECT l.user_id, ls.permission
           FROM lists l
           LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
           WHERE l.id = $1`,
          [listId, req.user.id]
        );
        if (permCheck.rows.length === 0) return res.status(404).json({ error: 'List not found' });
        const canEdit = permCheck.rows[0].user_id === req.user.id || permCheck.rows[0].permission === 'edit';
        if (!canEdit) return res.status(403).json({ error: 'No edit permission' });

        // Validate assignee_id
        if (assignee_id !== null) {
          const valid = await validateAssignee(listId, assignee_id);
          if (!valid) return res.status(400).json({ error: 'Invalid assignee' });
        }

        // Parent validation
        if (parent_id) {
          const parentCheck = await pool.query(
            'SELECT id FROM list_items WHERE id = $1 AND list_id = $2',
            [parent_id, listId]
          );
          if (parentCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid parent item' });
        }

        // Position
        const posResult = await pool.query(
          'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM list_items WHERE list_id = $1 AND parent_id IS NOT DISTINCT FROM $2',
          [listId, parent_id]
        );
        const nextPosition = posResult.rows[0].next_position;

        const result = await pool.query(
          `INSERT INTO list_items (list_id, text, completed, position, notes, parent_id, assignee_id, due_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [listId, text, completed, nextPosition, notes, parent_id, assignee_id, due_date, status]
        );

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ error: 'Failed to create item' });
      }
    });

    // PUT /api/items/:id
    app.put('/api/items/:id', authenticateToken, async (req, res) => {
      const { id } = req.params;
      let { text, completed, position, notes, parent_id, list_id: requestedListId,
            assignee_id, due_date, status } = req.body;

      if (text !== undefined) {
        text = sanitizeInput(text);
        if (text.length < 1) return res.status(400).json({ error: 'Item text cannot be empty' });
      }

      // Validate status early
      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (requestedListId !== undefined && requestedListId !== null) {
        const parsed = parseInt(requestedListId, 10);
        if (Number.isNaN(parsed)) return res.status(400).json({ error: 'Invalid target list' });
        requestedListId = parsed;
      }

      try {
        // Permission check
        const permCheck = await pool.query(
          `SELECT l.user_id, ls.permission, li.list_id
           FROM list_items li
           JOIN lists l ON li.list_id = l.id
           LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
           WHERE li.id = $1`,
          [id, req.user.id]
        );
        if (permCheck.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        const isSourceOwner = permCheck.rows[0].user_id === req.user.id;
        const canEdit = isSourceOwner || permCheck.rows[0].permission === 'edit';
        if (!canEdit) return res.status(403).json({ error: 'No edit permission' });

        const originalListId = permCheck.rows[0].list_id;
        let targetListId = originalListId;
        let isCrossListMove = false;

        if (requestedListId !== undefined && requestedListId !== originalListId) {
          if (!isSourceOwner) return res.status(403).json({ error: 'Only list owners can move items to other lists' });
          const targetCheck = await pool.query(
            `SELECT l.user_id, ls.permission
             FROM lists l
             LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
             WHERE l.id = $1`,
            [requestedListId, req.user.id]
          );
          if (targetCheck.rows.length === 0) return res.status(404).json({ error: 'Target list not found' });
          const canAddToTarget = targetCheck.rows[0].user_id === req.user.id || targetCheck.rows[0].permission === 'edit';
          if (!canAddToTarget) return res.status(403).json({ error: 'No edit permission on target list' });
          targetListId = requestedListId;
          isCrossListMove = true;
          if (parent_id === undefined) parent_id = null;
        }

        // Validate assignee_id AFTER permission check (never leak before authz)
        if (assignee_id !== undefined && assignee_id !== null) {
          const valid = await validateAssignee(targetListId, assignee_id);
          if (!valid) return res.status(400).json({ error: 'Invalid assignee' });
        }

        const parentValidationListId = isCrossListMove ? targetListId : originalListId;
        if (parent_id !== undefined && parent_id !== null) {
          const parentCheck = await pool.query(
            'SELECT id FROM list_items WHERE id = $1 AND list_id = $2',
            [parent_id, parentValidationListId]
          );
          if (parentCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid parent item' });
          if (parent_id == id) return res.status(400).json({ error: 'Item cannot be its own parent' });
        }

        if (isCrossListMove) {
          const posResult = await pool.query(
            'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM list_items WHERE list_id = $1 AND parent_id IS NOT DISTINCT FROM $2',
            [targetListId, parent_id === undefined ? null : parent_id]
          );
          position = posResult.rows[0].next_position;
        }

        // Dynamic field builder
        let query = 'UPDATE list_items SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (text !== undefined) { query += `, text = $${paramCount++}`; params.push(text); }
        if (status !== undefined) {
          // status provided: status wins — always derive completed from status
          query += `, status = $${paramCount++}`; params.push(status);
          query += `, completed = $${paramCount++}`; params.push(status === 'Done');
        } else if (completed !== undefined) {
          // Only completed provided: sync status too
          query += `, status = $${paramCount++}`; params.push(completed ? 'Done' : 'To do');
          query += `, completed = $${paramCount++}`; params.push(completed);
        }
        if (position !== undefined) { query += `, position = $${paramCount++}`; params.push(position); }
        if (notes !== undefined) { query += `, notes = $${paramCount++}`; params.push(notes); }
        if (parent_id !== undefined) { query += `, parent_id = $${paramCount++}`; params.push(parent_id); }
        if (requestedListId !== undefined) { query += `, list_id = $${paramCount++}`; params.push(targetListId); }
        if (assignee_id !== undefined) { query += `, assignee_id = $${paramCount++}`; params.push(assignee_id); }
        if (due_date !== undefined) { query += `, due_date = $${paramCount++}`; params.push(due_date); }

        query += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(id);

        let updatedItem;

        if (isCrossListMove) {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const result = await client.query(query, params);
            if (result.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
            await client.query(
              `WITH RECURSIVE subtree AS (
                 SELECT id FROM list_items WHERE id = $1
                 UNION
                 SELECT li.id FROM list_items li JOIN subtree s ON li.parent_id = s.id
               )
               UPDATE list_items SET list_id = $2 WHERE id IN (SELECT id FROM subtree)`,
              [id, targetListId]
            );
            const refreshedItem = await client.query('SELECT * FROM list_items WHERE id = $1', [id]);
            updatedItem = refreshedItem.rows[0];
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        } else {
          const result = await pool.query(query, params);
          if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
          updatedItem = result.rows[0];
        }

        res.json(updatedItem);
      } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
      }
    });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER_EMAIL, MEMBER_EMAIL, STRANGER_EMAIL]]);
    await pool.end();
  });

  // Helper to create an item directly in the DB for PUT tests
  async function seedItem(overrides = {}) {
    const r = await pool.query(
      `INSERT INTO list_items (list_id, text, completed, position, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        overrides.list_id || listId,
        overrides.text || 'Test item',
        overrides.completed !== undefined ? overrides.completed : false,
        overrides.position || 1,
        overrides.status || 'To do',
      ]
    );
    return r.rows[0];
  }

  // ─── POST tests ───────────────────────────────────────────────────────────

  describe('POST /api/lists/:listId/items — status/completed sync', () => {
    test('POST with status:Done → row.status=Done AND row.completed=true', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'done item', status: 'Done' });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('Done');
      expect(r.body.completed).toBe(true);
    });

    test('POST with no status + completed:true → status=Done', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'completed true item', completed: true });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('Done');
      expect(r.body.completed).toBe(true);
    });

    test('POST with no status + completed:false → status=To do', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'not completed item', completed: false });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('To do');
      expect(r.body.completed).toBe(false);
    });

    test('POST with no status + no completed → status=To do, completed=false', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'default item' });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('To do');
      expect(r.body.completed).toBe(false);
    });

    test('POST with invalid status → 400', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'bad status item', status: 'Nope' });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Invalid status');
    });

    test('POST with status:Doing → row.status=Doing AND row.completed=false', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'doing item', status: 'Doing' });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('Doing');
      expect(r.body.completed).toBe(false);
    });
  });

  describe('POST /api/lists/:listId/items — assignee_id', () => {
    test('POST with assignee_id = workspace member → 201, row.assignee_id set', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'assigned item', assignee_id: memberId });
      expect(r.status).toBe(201);
      expect(r.body.assignee_id).toBe(memberId);
    });

    test('POST with assignee_id = stranger (no access) → 400 Invalid assignee', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'bad assignee item', assignee_id: strangerId });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Invalid assignee');
    });

    test('POST with assignee_id = null → 201, no assignee', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'unassigned item', assignee_id: null });
      expect(r.status).toBe(201);
      expect(r.body.assignee_id).toBeNull();
    });
  });

  // ─── PUT tests ────────────────────────────────────────────────────────────

  describe('PUT /api/items/:id — status/completed sync', () => {
    test('PUT status:Done → completed=true', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Done' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Done');
      expect(r.body.completed).toBe(true);
    });

    test('PUT status:Doing → completed=false', async () => {
      const item = await seedItem({ completed: true, status: 'Done' });
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Doing' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Doing');
      expect(r.body.completed).toBe(false);
    });

    test('PUT status:Blocked → completed=false', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Blocked' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Blocked');
      expect(r.body.completed).toBe(false);
    });

    test('PUT completed:true (no status) → status=Done', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ completed: true });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Done');
      expect(r.body.completed).toBe(true);
    });

    test('PUT completed:false (no status) → status=To do', async () => {
      const item = await seedItem({ completed: true, status: 'Done' });
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ completed: false });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('To do');
      expect(r.body.completed).toBe(false);
    });

    test('PUT invalid status:Nope → 400', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Nope' });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Invalid status');
    });

    test('PUT both status:Done + completed:false → status wins, completed=true', async () => {
      const item = await seedItem();
      // Spec §4: status='Done' ⇔ completed=true. When both are provided, status wins for completed.
      // So status=Done + completed=false → completed must be true (derived from status).
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Done', completed: false });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Done');
      expect(r.body.completed).toBe(true);
    });

    test('PUT both status:Doing + completed:true → status wins, completed=false', async () => {
      const item = await seedItem({ status: 'Done', completed: true });
      // status=Doing is not Done, so completed must be false (derived from status).
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Doing', completed: true });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Doing');
      expect(r.body.completed).toBe(false);
    });
  });

  describe('PUT /api/items/:id — assignee_id', () => {
    test('PUT assignee_id = workspace member → 200, row.assignee_id set', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ assignee_id: memberId });
      expect(r.status).toBe(200);
      expect(r.body.assignee_id).toBe(memberId);
    });

    test('PUT assignee_id = stranger (no workspace access) → 400 Invalid assignee', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ assignee_id: strangerId });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Invalid assignee');
    });

    test('PUT assignee_id = null → unassigns (200, assignee_id=null)', async () => {
      const item = await seedItem();
      // First assign
      await pool.query('UPDATE list_items SET assignee_id = $1 WHERE id = $2', [memberId, item.id]);
      // Now clear
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ assignee_id: null });
      expect(r.status).toBe(200);
      expect(r.body.assignee_id).toBeNull();
    });
  });

  describe('PUT /api/items/:id — due_date', () => {
    test('PUT due_date set → persists', async () => {
      const item = await seedItem();
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ due_date: '2026-12-31T00:00:00.000Z' });
      expect(r.status).toBe(200);
      expect(r.body.due_date).toBeTruthy();
    });

    test('PUT due_date cleared (null) → null persists', async () => {
      const item = await seedItem();
      // Set first
      await pool.query("UPDATE list_items SET due_date = '2026-12-31' WHERE id = $1", [item.id]);
      // Clear
      const r = await request(app)
        .put(`/api/items/${item.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ due_date: null });
      expect(r.status).toBe(200);
      expect(r.body.due_date).toBeNull();
    });
  });
});
