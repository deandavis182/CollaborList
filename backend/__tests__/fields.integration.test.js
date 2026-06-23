// backend/__tests__/fields.integration.test.js
// Integration tests for structured fields: field-defs CRUD, presets, per-item values, and items enrichment.
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeFieldsRouter  = require('../routes/fields');
const makeProjectsRouter = require('../routes/projects');

const OWNER      = 'fields-int-owner@example.test';
const VIEW_USER  = 'fields-int-view@example.test';
const EDIT_USER  = 'fields-int-edit@example.test';
const SECRET     = process.env.JWT_SECRET || 'test-secret';
const tokenFor   = (id, email) => jwt.sign({ id, email }, SECRET);

describe('Structured fields — integration (real DB)', () => {
  let pool, ownerId, viewUserId, editUserId;
  let listId, itemId, itemId2;
  let app;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up any leftover data from a previous run
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, VIEW_USER, EDIT_USER]]);

    // Seed users
    ownerId    = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER])).rows[0].id;
    viewUserId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [VIEW_USER])).rows[0].id;
    editUserId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [EDIT_USER])).rows[0].id;

    // Seed a list owned by owner
    listId = (await pool.query(
      "INSERT INTO lists (name,user_id) VALUES ('Test List',$1) RETURNING id",
      [ownerId]
    )).rows[0].id;

    // Share with viewUserId (view) and editUserId (edit)
    await pool.query(
      "INSERT INTO list_shares (list_id,user_id,permission) VALUES ($1,$2,'view'),($1,$3,'edit')",
      [listId, viewUserId, editUserId]
    );

    // Seed two items
    itemId  = (await pool.query("INSERT INTO list_items (list_id,text) VALUES ($1,'Item A') RETURNING id", [listId])).rows[0].id;
    itemId2 = (await pool.query("INSERT INTO list_items (list_id,text) VALUES ($1,'Item B') RETURNING id", [listId])).rows[0].id;

    // Build the test app
    const authenticateToken = (req, res, next) => {
      const h = req.headers['authorization'];
      const t = h && h.split(' ')[1];
      if (!t) return res.status(401).json({ error: 'Access token required' });
      jwt.verify(t, SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
      });
    };
    const sanitize = (s) => (s || '').toString().replace(/[<>"'`;(){}[\]\\]/g, '').slice(0, 1000);
    const emitNoop = () => {};

    app = express();
    app.use(express.json());
    app.use('/api', makeFieldsRouter(authenticateToken, sanitize, { list: emitNoop }));
    app.use('/api/projects', makeProjectsRouter(authenticateToken, sanitize));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, VIEW_USER, EDIT_USER]]);
    await pool.end();
  });

  // -------------------------------------------------------------------------
  // Field def CRUD
  // -------------------------------------------------------------------------

  describe('field-def CRUD', () => {
    let defId;

    test('owner can create a field def → 201', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-defs`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'priority', type: 'status', label: 'Priority', config: { options: ['Low', 'High'] }, position: 0 });
      expect(r.status).toBe(201);
      expect(r.body.key).toBe('priority');
      expect(r.body.type).toBe('status');
      defId = r.body.id;
    });

    test('view-share user can GET field defs → 200', async () => {
      const r = await request(app)
        .get(`/api/lists/${listId}/field-defs`)
        .set('Authorization', `Bearer ${tokenFor(viewUserId, VIEW_USER)}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
      expect(r.body.some(d => d.key === 'priority')).toBe(true);
    });

    test('view-share user cannot POST field def → 403', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-defs`)
        .set('Authorization', `Bearer ${tokenFor(viewUserId, VIEW_USER)}`)
        .send({ key: 'budget', type: 'number', label: 'Budget' });
      expect(r.status).toBe(403);
    });

    test('bad type → 400', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-defs`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'x', type: 'invalid_type', label: 'X' });
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/BAD_TYPE|Invalid field type/i);
    });

    test('edit-share user can update field def → 200', async () => {
      const r = await request(app)
        .put(`/api/field-defs/${defId}`)
        .set('Authorization', `Bearer ${tokenFor(editUserId, EDIT_USER)}`)
        .send({ label: 'Task Priority' });
      expect(r.status).toBe(200);
      expect(r.body.label).toBe('Task Priority');
    });

    test('view-share user cannot update field def → 403', async () => {
      const r = await request(app)
        .put(`/api/field-defs/${defId}`)
        .set('Authorization', `Bearer ${tokenFor(viewUserId, VIEW_USER)}`)
        .send({ label: 'Hacked' });
      expect(r.status).toBe(403);
    });

    test('owner can delete field def → 200 {success}', async () => {
      // Create a throwaway def first
      const created = await request(app)
        .post(`/api/lists/${listId}/field-defs`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'to_delete', type: 'text', label: 'To Delete' });
      expect(created.status).toBe(201);
      const throwawayId = created.body.id;

      const r = await request(app)
        .delete(`/api/field-defs/${throwawayId}`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Presets
  // -------------------------------------------------------------------------

  describe('field presets', () => {
    test('apply "budget" preset → defs cost+payment created → 201', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-presets`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ preset: 'budget' });
      expect(r.status).toBe(201);
      expect(Array.isArray(r.body)).toBe(true);
      const keys = r.body.map(d => d.key);
      expect(keys).toContain('cost');
      expect(keys).toContain('payment');
    });

    test('re-apply "budget" preset is idempotent (no dupes)', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-presets`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ preset: 'budget' });
      expect(r.status).toBe(201);
      // Should still only have one 'cost' and one 'payment'
      const costs    = r.body.filter(d => d.key === 'cost');
      const payments = r.body.filter(d => d.key === 'payment');
      expect(costs).toHaveLength(1);
      expect(payments).toHaveLength(1);
    });

    test('apply "guests" preset → party_size+rsvp created → 201', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-presets`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ preset: 'guests' });
      expect(r.status).toBe(201);
      const keys = r.body.map(d => d.key);
      expect(keys).toContain('party_size');
      expect(keys).toContain('rsvp');
    });

    test('bad preset name → 400', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-presets`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ preset: 'nonexistent' });
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/BAD_PRESET|Unknown preset/i);
    });

    test('view-share user cannot apply preset → 403', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-presets`)
        .set('Authorization', `Bearer ${tokenFor(viewUserId, VIEW_USER)}`)
        .send({ preset: 'budget' });
      expect(r.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Per-item field values
  // -------------------------------------------------------------------------

  describe('per-item field values', () => {
    test('edit-share user can PUT item field value → 200 (upsert)', async () => {
      const r = await request(app)
        .put(`/api/items/${itemId}/fields`)
        .set('Authorization', `Bearer ${tokenFor(editUserId, EDIT_USER)}`)
        .send({ key: 'cost', type: 'number', value: 150 });
      expect(r.status).toBe(200);
      expect(r.body.key).toBe('cost');
      expect(r.body.value).toBe(150);
    });

    test('overwriting same key updates value', async () => {
      const r = await request(app)
        .put(`/api/items/${itemId}/fields`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'cost', type: 'number', value: 999 });
      expect(r.status).toBe(200);
      expect(r.body.value).toBe(999);
    });

    test('setting empty value removes the field → {removed: true}', async () => {
      // First set a string value (string values must be JSON-serialized by the service)
      const setR = await request(app)
        .put(`/api/items/${itemId}/fields`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'payment', type: 'status', value: 'Booked' });
      expect(setR.status).toBe(200);
      expect(setR.body.value).toBe('Booked');

      // Then clear it with empty string
      const r = await request(app)
        .put(`/api/items/${itemId}/fields`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'payment', type: 'status', value: '' });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ removed: true });
    });

    test('view-share user cannot PUT item field value → 403', async () => {
      const r = await request(app)
        .put(`/api/items/${itemId}/fields`)
        .set('Authorization', `Bearer ${tokenFor(viewUserId, VIEW_USER)}`)
        .send({ key: 'cost', type: 'number', value: 42 });
      expect(r.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Items enrichment — GET /api/lists/:listId/items returns `fields` map
  // -------------------------------------------------------------------------

  describe('items enrichment via GET /api/lists/:listId/items', () => {
    // Mount a mini app that uses server.js's route handler logic via direct pool query
    // Because the lists/:listId/items route is inline in server.js (not a mountable router),
    // we test the enrichment by directly querying the database and verifying the SQL
    // produces the expected `fields` map — mirroring the pattern in hub.integration.test.js.

    test('item with a field value has non-empty fields map', async () => {
      // Ensure itemId has cost=999 set (from previous tests)
      const result = await pool.query(
        `SELECT li.*,
           COALESCE(
             (SELECT json_object_agg(f.key, f.value) FROM item_fields f WHERE f.item_id = li.id),
             '{}'::json
           ) AS fields
         FROM list_items li
         WHERE li.id = $1`,
        [itemId]
      );
      expect(result.rows).toHaveLength(1);
      const fields = result.rows[0].fields;
      expect(typeof fields).toBe('object');
      expect(fields.cost).toBe(999);
    });

    test('item with no field values returns empty fields map {}', async () => {
      const result = await pool.query(
        `SELECT li.*,
           COALESCE(
             (SELECT json_object_agg(f.key, f.value) FROM item_fields f WHERE f.item_id = li.id),
             '{}'::json
           ) AS fields
         FROM list_items li
         WHERE li.id = $1`,
        [itemId2]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].fields).toEqual({});
    });

    test('project-items enrichment query returns fields map', async () => {
      // Set a value on itemId2 to verify it shows up
      await pool.query(
        `INSERT INTO item_fields (item_id, key, type, value)
         VALUES ($1, 'rsvp', 'status', '"Yes"')
         ON CONFLICT (item_id, key) DO UPDATE SET value=EXCLUDED.value`,
        [itemId2]
      );

      const result = await pool.query(
        `SELECT li.*,
           COALESCE((SELECT json_object_agg(f.key, f.value) FROM item_fields f WHERE f.item_id=li.id), '{}'::json) AS fields
         FROM list_items li
         WHERE li.id = $1`,
        [itemId2]
      );
      expect(result.rows[0].fields).toHaveProperty('rsvp', 'Yes');
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency — run all checks a second time
  // -------------------------------------------------------------------------

  describe('idempotency (second run)', () => {
    test('re-apply budget preset is still idempotent', async () => {
      const r = await request(app)
        .post(`/api/lists/${listId}/field-presets`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ preset: 'budget' });
      expect(r.status).toBe(201);
      const costs = r.body.filter(d => d.key === 'cost');
      expect(costs).toHaveLength(1);
    });

    test('GET field-defs returns stable result', async () => {
      const r = await request(app)
        .get(`/api/lists/${listId}/field-defs`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(200);
      expect(r.body.filter(d => d.key === 'cost')).toHaveLength(1);
    });

    test('re-upsert item field value is idempotent', async () => {
      const r = await request(app)
        .put(`/api/items/${itemId}/fields`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ key: 'cost', type: 'number', value: 999 });
      expect(r.status).toBe(200);
      expect(r.body.value).toBe(999);
    });
  });
});
