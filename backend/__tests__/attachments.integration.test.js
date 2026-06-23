// backend/__tests__/attachments.integration.test.js
// Real-router integration tests for routes/attachments.js.
// Uses a real DB and a temp UPLOAD_DIR; cleans up in afterAll.
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

// MUST set UPLOAD_DIR before requiring lib/uploads or the router
const TEMP_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'att-test-'));
process.env.UPLOAD_DIR = TEMP_UPLOAD_DIR;

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeAttachmentsRouter = require('../routes/attachments');
const { upload: attachmentUpload } = require('../lib/uploads');

// Unique email prefixes to avoid cross-suite collisions
const OWNER  = 'att7a-owner@example.test';
const VIEWER = 'att7a-viewer@example.test';
const EDITOR = 'att7a-editor@example.test';
const OTHER  = 'att7a-other@example.test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

// Minimal PNG — 8-byte PNG signature + IHDR chunk (minimal valid structure)
// multer checks the declared contentType from .attach(), not magic bytes
const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, // IHDR length
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x01, // width: 1
  0x00, 0x00, 0x00, 0x01, // height: 1
  0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc.
  0x90, 0x77, 0x53, 0xde, // CRC
]);

describe('Attachments router (real DB)', () => {
  let pool;
  let ownerId, viewerId, editorId, otherId;
  let listId, itemId;
  let app;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up any leftover rows from prior runs
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, VIEWER, EDITOR, OTHER]]);

    // Create users
    ownerId  = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER])).rows[0].id;
    viewerId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [VIEWER])).rows[0].id;
    editorId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [EDITOR])).rows[0].id;
    otherId  = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OTHER])).rows[0].id;

    // Create list + item owned by owner
    listId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Att7A List', $1) RETURNING id", [ownerId]
    )).rows[0].id;
    itemId = (await pool.query(
      "INSERT INTO list_items (list_id, text, position) VALUES ($1,'Att7A Item',1) RETURNING id", [listId]
    )).rows[0].id;

    // Share list with viewer (view) and editor (edit)
    await pool.query(
      "INSERT INTO list_shares (list_id, user_id, permission) VALUES ($1,$2,'view')", [listId, viewerId]
    );
    await pool.query(
      "INSERT INTO list_shares (list_id, user_id, permission) VALUES ($1,$2,'edit')", [listId, editorId]
    );

    // Build minimal express app with only the attachments router
    const authenticateToken = (req, res, next) => {
      const h = req.headers['authorization'] || '';
      const t = h.startsWith('Bearer ') ? h.slice(7) : null;
      if (!t) return res.status(401).json({ error: 'Access token required' });
      jwt.verify(t, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
      });
    };

    app = express();
    app.use(express.json());
    app.use('/api', makeAttachmentsRouter(authenticateToken, attachmentUpload));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, VIEWER, EDITOR, OTHER]]);
    await pool.end();
    // Clean up temp upload directory
    try { fs.rmSync(TEMP_UPLOAD_DIR, { recursive: true, force: true }); } catch (_) {}
  });

  // ─── POST /api/items/:id/attachments ─────────────────────────────────────

  describe('POST /api/items/:id/attachments', () => {
    test('owner can upload a PNG → 201, file written to disk', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .attach('file', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' });

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        item_id: itemId,
        filename: 'test.png',
        mime_type: 'image/png',
      });
      expect(r.body.id).toBeDefined();
      expect(r.body.storage_key).toBeDefined();

      // File should exist on disk
      const filePath = path.join(TEMP_UPLOAD_DIR, r.body.storage_key);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('upload disallowed MIME type → 400', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .attach('file', Buffer.from('hello'), { filename: 'test.txt', contentType: 'text/plain' });

      expect(r.status).toBe(400);
    });

    test('view-only user cannot upload → 403', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`)
        .attach('file', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' });

      expect(r.status).toBe(403);
    });

    test('non-member cannot upload → 403 (item found but no access)', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(otherId, OTHER)}`)
        .attach('file', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' });

      // getItemAccess finds the item but canEdit=false for non-members → 403
      expect(r.status).toBe(403);
    });

    test('unauthenticated request → 401', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .attach('file', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' });

      expect(r.status).toBe(401);
    });

    test('editor can upload → 201', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(editorId, EDITOR)}`)
        .attach('file', PNG_BUFFER, { filename: 'editor.png', contentType: 'image/png' });

      expect(r.status).toBe(201);
      expect(r.body.filename).toBe('editor.png');
    });
  });

  // ─── GET /api/items/:id/attachments ──────────────────────────────────────

  describe('GET /api/items/:id/attachments', () => {
    test('owner can list attachments → 200 with array', async () => {
      const r = await request(app)
        .get(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
      expect(r.body.length).toBeGreaterThanOrEqual(1);
    });

    test('view-only user can list attachments → 200', async () => {
      const r = await request(app)
        .get(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`);

      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    test('non-member cannot list → 403 (item found but no access)', async () => {
      const r = await request(app)
        .get(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(otherId, OTHER)}`);

      // getItemAccess finds the item but canView=false for non-members → 403
      expect(r.status).toBe(403);
    });

    test('unauthenticated → 401', async () => {
      const r = await request(app).get(`/api/items/${itemId}/attachments`);
      expect(r.status).toBe(401);
    });
  });

  // ─── GET /api/attachments/:id/download ───────────────────────────────────

  describe('GET /api/attachments/:id/download', () => {
    let attId;
    let storageKey;

    beforeAll(async () => {
      // Upload a fresh attachment for download tests
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .attach('file', PNG_BUFFER, { filename: 'download-test.png', contentType: 'image/png' });

      expect(r.status).toBe(201);
      attId = r.body.id;
      storageKey = r.body.storage_key;
    });

    test('download via Authorization header → 200, correct content-type, bytes match', async () => {
      const r = await request(app)
        .get(`/api/attachments/${attId}/download`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toMatch('image/png');
      expect(Buffer.from(r.body).slice(0, 8)).toEqual(PNG_BUFFER.slice(0, 8));
    });

    test('download via ?token= query param → 200', async () => {
      const token = tokenFor(ownerId, OWNER);
      const r = await request(app)
        .get(`/api/attachments/${attId}/download?token=${token}`);

      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toMatch('image/png');
    });

    test('view-only user can download → 200', async () => {
      const r = await request(app)
        .get(`/api/attachments/${attId}/download`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`);

      expect(r.status).toBe(200);
    });

    test('non-member cannot download → 403', async () => {
      const r = await request(app)
        .get(`/api/attachments/${attId}/download`)
        .set('Authorization', `Bearer ${tokenFor(otherId, OTHER)}`);

      expect(r.status).toBe(403);
    });

    test('unauthenticated → 401', async () => {
      const r = await request(app)
        .get(`/api/attachments/${attId}/download`);

      expect(r.status).toBe(401);
    });

    test('non-existent attachment → 404', async () => {
      const r = await request(app)
        .get('/api/attachments/999999999/download')
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

      expect(r.status).toBe(404);
    });
  });

  // ─── DELETE /api/attachments/:id ─────────────────────────────────────────

  describe('DELETE /api/attachments/:id', () => {
    let attId;
    let storageKey;

    beforeAll(async () => {
      // Upload an attachment to delete
      const r = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .attach('file', PNG_BUFFER, { filename: 'to-delete.png', contentType: 'image/png' });

      expect(r.status).toBe(201);
      attId = r.body.id;
      storageKey = r.body.storage_key;
    });

    test('view-only user cannot delete → 403', async () => {
      const r = await request(app)
        .delete(`/api/attachments/${attId}`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`);

      expect(r.status).toBe(403);
    });

    test('non-member cannot delete → 403 (item found but no access)', async () => {
      const r = await request(app)
        .delete(`/api/attachments/${attId}`)
        .set('Authorization', `Bearer ${tokenFor(otherId, OTHER)}`);

      // getItemAccess finds the item but canEdit=false for non-members → 403
      expect(r.status).toBe(403);
    });

    test('owner can delete → 200, row gone, file unlinked', async () => {
      const filePath = path.join(TEMP_UPLOAD_DIR, storageKey);
      expect(fs.existsSync(filePath)).toBe(true);

      const r = await request(app)
        .delete(`/api/attachments/${attId}`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);

      // File should be unlinked
      expect(fs.existsSync(filePath)).toBe(false);

      // Row should be gone from DB
      const dbCheck = await pool.query('SELECT id FROM attachments WHERE id = $1', [attId]);
      expect(dbCheck.rows.length).toBe(0);
    });

    test('delete already-deleted attachment → 404', async () => {
      const r = await request(app)
        .delete(`/api/attachments/${attId}`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

      expect(r.status).toBe(404);
    });

    test('best-effort: delete succeeds even if file is already missing from disk', async () => {
      // Upload a new attachment
      const uploadRes = await request(app)
        .post(`/api/items/${itemId}/attachments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .attach('file', PNG_BUFFER, { filename: 'ghost.png', contentType: 'image/png' });
      expect(uploadRes.status).toBe(201);
      const ghostId = uploadRes.body.id;
      const ghostKey = uploadRes.body.storage_key;

      // Manually remove the file from disk
      try { fs.unlinkSync(path.join(TEMP_UPLOAD_DIR, ghostKey)); } catch (_) {}

      // Delete should still succeed (best-effort)
      const r = await request(app)
        .delete(`/api/attachments/${ghostId}`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

      expect(r.status).toBe(200);
    });
  });
});
