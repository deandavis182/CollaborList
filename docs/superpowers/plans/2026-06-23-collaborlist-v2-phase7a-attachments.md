# Phase 7A — File/Photo Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users attach files/photos to items (wedding inspiration photos, vendor PDFs, contracts), stored on a local Docker volume with metadata in Postgres, uploaded/downloaded through authenticated API endpoints.

**Architecture:** Files live on a Docker named volume `attachments_data` mounted at `/app/uploads` in the backend container (consistent with the single-instance deploy — same tradeoff already accepted for in-memory presence + in-process reminders; revisit before horizontal scaling). Each upload gets a UUID storage key on disk; metadata (original filename, mime, size, item, uploader) lives in a new additive `attachments` table. Upload via `multer` (disk storage, 10 MB cap, images + PDF). Download streams the file through an authenticated endpoint that checks item access via the existing `getItemAccess`. No new socket event (attachments are low-frequency; the detail drawer refetches on open and after mutations) — documented YAGNI.

**Tech Stack:** Backend: `multer` (new), `pg`, existing route-factory + service patterns. Frontend: existing axios `apiClient` (FormData upload), @tanstack/react-query v5, ui/ tokens. Tests: backend Jest (mocked pool + mocked fs for the service; real-router integration with a temp upload dir); frontend Vitest + Testing Library.

## Global Constraints

- **Branch:** `v2-phase7a-attachments` (off `main`). Do NOT switch/create other branches mid-task.
- **ADDITIVE migration only** (new `attachments` table via `CREATE TABLE IF NOT EXISTS`). Zero live-data loss; no destructive SQL.
- **The LIVE APP is the new shell at `/`** (`frontend/src/main.jsx`). Do not touch `RealtimeApp.jsx`.
- **Auth + permissions:** upload/delete require item EDIT (`getItemAccess(...).canEdit`); list/download require VIEW (`.canView`). 404-before-403 ordering. SQL parameterized.
- **CSRF:** uploads are authenticated non-GET → must carry `X-CSRF-Token` (the `apiClient` interceptor already adds it; FormData requests still go through `apiClient`, so it is covered — do NOT bypass apiClient for uploads).
- **Upload limits:** max 10 MB per file; allowed mime types EXACTLY: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`. Reject others with 400.
- **Storage:** files under `/app/uploads` (configurable via `UPLOAD_DIR` env, default `/app/uploads`); on-disk name is a UUID + original extension; never trust/echo the client path. Deleting an attachment row also deletes the file (best-effort; a missing file must not 500 the delete).
- **ui/ primitives + design tokens only — NO hardcoded hex.** Dates via `lib/dates.js`.
- **NO Co-Authored-By trailer.** `.superpowers/` reports gitignored — never commit them.
- **Backend tests run IN the container** (host has no node_modules): `docker compose --profile test build backend-test` before each run; unit `... run --rm backend-test npm test`; integration `... run --rm backend-test npm run test:integration`.

---

## File Structure

**Backend (new):**
- `backend/services/attachmentService.js` — `create(pool, {itemId, uploaderId, filename, mimeType, sizeBytes, storageKey})`, `listForItem(pool, itemId)`, `getById(pool, id)`, `remove(pool, id)` (deletes row; returns the removed row incl storageKey so the caller can unlink the file).
- `backend/routes/attachments.js` — factory `(authenticateToken, upload) => router`: POST `/items/:id/attachments` (multer single-file), GET `/items/:id/attachments`, GET `/attachments/:id/download`, DELETE `/attachments/:id`.
- `backend/lib/uploads.js` — multer config: disk storage to `UPLOAD_DIR`, UUID+ext filename, `limits.fileSize` 10 MB, `fileFilter` allow-list; exports the configured `multer` instance + `ALLOWED_MIME` + `UPLOAD_DIR` + `ensureUploadDir()`.
- Tests: `backend/__tests__/attachmentService.test.js`, `backend/__tests__/uploads.test.js`, `backend/__tests__/attachments.integration.test.js`.

**Backend (modified):**
- `backend/db/migrations.js` — append migration `014_create_attachments`.
- `backend/server.js` — mount `routes/attachments.js`; ensure upload dir at boot.
- `backend/package.json` — add `multer`.
- `backend/Dockerfile` — `RUN mkdir -p /app/uploads` (so the dir exists even before the volume mounts in dev).
- `docker-compose.yml`, `docker-compose.traefik.yml`, `docker-compose.production.yml` — add `attachments_data:/app/uploads` to the backend service + declare the `attachments_data` volume.

**Frontend (new):**
- `frontend/src/lib/api.js` (ADD hooks) — `useAttachments(itemId)`, `useUploadAttachment(itemId)`, `useDeleteAttachment(itemId)`.
- `frontend/src/features/attachments/AttachmentList.jsx` — list + image thumbnails + download links + delete; an upload control (file input) using FormData.
- Tests under `frontend/src/lib/__tests__/` and `frontend/src/features/attachments/__tests__/`.

**Frontend (modified):**
- `frontend/src/features/items/ItemDetailDrawer.jsx` — add an "Attachments" section rendering `<AttachmentList itemId={item.id} />` (below the Custom fields section).

---

## Interfaces (shared signatures)

```js
// backend lib/uploads.js
ALLOWED_MIME // Set or array: image/jpeg,image/png,image/gif,image/webp,application/pdf
UPLOAD_DIR   // process.env.UPLOAD_DIR || '/app/uploads'
ensureUploadDir() // mkdirSync recursive, idempotent
upload // configured multer instance (upload.single('file'))

// backend services/attachmentService.js
async create(pool, { itemId, uploaderId, filename, mimeType, sizeBytes, storageKey }) // → row
async listForItem(pool, itemId) // → [{id, item_id, uploader_id, filename, mime_type, size_bytes, storage_key, created_at}]
async getById(pool, id)         // → row | null
async remove(pool, id)          // → removed row | null

// frontend api.js hooks
useAttachments(itemId)        // GET /items/:id/attachments ; key ['attachments', itemId]
useUploadAttachment(itemId)   // mutationFn(file) → POST FormData ; invalidate ['attachments', itemId]
useDeleteAttachment(itemId)   // mutationFn(attachmentId) → DELETE ; invalidate ['attachments', itemId]
```

**Download response:** `GET /api/attachments/:id/download` streams the file with `Content-Type: <mime_type>` and `Content-Disposition: inline; filename="<original>"`. The frontend links/`<img>` point at `/api/attachments/${id}/download`. Because download is a GET it does NOT need CSRF, but it IS auth'd — the browser sends the JWT? NO: `<img>`/anchor GETs do not carry the Authorization header. SO: the download endpoint must accept the token via a `?token=` query param as a fallback (verified the same way) OR the list endpoint returns a short-lived signed URL. To keep it simple and consistent with this app's JWT model: the download route accepts the JWT from either the `Authorization` header OR a `token` query param; the frontend builds `/api/attachments/${id}/download?token=${jwt}` for `<img>`/anchor href. (This is acceptable for this app's scale; document the tradeoff that the token appears in the URL.)

---

### Task 1: Migration `014_create_attachments`

**Files:**
- Modify: `backend/db/migrations.js` (append to the `migrations` array, after `013_collab_defaults_and_watermark`)
- Test: `backend/__tests__/migration-014.integration.test.js`

- [ ] **Step 1: Write the failing integration test**

`backend/__tests__/migration-014.integration.test.js`:
```js
'use strict';
const pool = require('../db/pool');
const { runMigrations } = require('../db/migrations');

beforeAll(async () => { await runMigrations(); });
afterAll(async () => { await pool.end(); });

test('attachments table exists with expected columns', async () => {
  const r = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'attachments' ORDER BY ordinal_position`);
  const cols = Object.fromEntries(r.rows.map((x) => [x.column_name, x.data_type]));
  expect(cols).toHaveProperty('id');
  expect(cols).toHaveProperty('item_id');
  expect(cols).toHaveProperty('uploader_id');
  expect(cols).toHaveProperty('filename');
  expect(cols).toHaveProperty('mime_type');
  expect(cols).toHaveProperty('size_bytes');
  expect(cols).toHaveProperty('storage_key');
  expect(cols).toHaveProperty('created_at');
});

test('migration is idempotent (re-run does not throw)', async () => {
  await expect(runMigrations()).resolves.not.toThrow();
});

test('deleting an item cascades its attachments', async () => {
  // create user, list, item, attachment; delete item; attachment gone
  const u = await pool.query(`INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id`, ['att-mig@x.com','x']);
  const l = await pool.query(`INSERT INTO lists (name,user_id) VALUES ($1,$2) RETURNING id`, ['L', u.rows[0].id]);
  const it = await pool.query(`INSERT INTO list_items (list_id,text) VALUES ($1,$2) RETURNING id`, [l.rows[0].id, 'i']);
  await pool.query(`INSERT INTO attachments (item_id,uploader_id,filename,mime_type,size_bytes,storage_key) VALUES ($1,$2,$3,$4,$5,$6)`,
    [it.rows[0].id, u.rows[0].id, 'a.png', 'image/png', 10, 'key-1']);
  await pool.query(`DELETE FROM list_items WHERE id=$1`, [it.rows[0].id]);
  const left = await pool.query(`SELECT * FROM attachments WHERE storage_key=$1`, ['key-1']);
  expect(left.rows.length).toBe(0);
  await pool.query(`DELETE FROM users WHERE id=$1`, [u.rows[0].id]);
});
```

- [ ] **Step 2: Run, expect fail** — `docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npm run test:integration -- migration-014` → FAIL (no attachments table).

- [ ] **Step 3: Append the migration** to `backend/db/migrations.js` (after the 013 entry, before the closing `]`):
```js
  {
    name: '014_create_attachments',
    sql: `
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL REFERENCES list_items(id) ON DELETE CASCADE,
        uploader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);
    `
  },
```

- [ ] **Step 4: Run, expect pass** — same command → PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add backend/db/migrations.js backend/__tests__/migration-014.integration.test.js
git commit -m "feat(7A.T1): migration 014 — attachments table (additive, item-cascade)"
```

---

### Task 2: `lib/uploads.js` — multer config + upload dir

**Files:**
- Create: `backend/lib/uploads.js`
- Create: `backend/__tests__/uploads.test.js`
- Modify: `backend/package.json` (add `"multer": "^1.4.5-lts.1"`)
- Modify: `backend/Dockerfile` (`RUN mkdir -p /app/uploads` before `CMD`)

**Interfaces:** Produces `ALLOWED_MIME`, `UPLOAD_DIR`, `ensureUploadDir()`, `upload` (multer instance), and a pure `isAllowedMime(mime)` helper.

- [ ] **Step 1: Add the dependency** — add `"multer": "^1.4.5-lts.1"` to `backend/package.json` dependencies; `docker compose --profile test build backend-test` installs it.

- [ ] **Step 2: Write the failing test**

`backend/__tests__/uploads.test.js`:
```js
'use strict';
const path = require('path');
process.env.UPLOAD_DIR = path.join(__dirname, '__upload_tmp__');
const { ALLOWED_MIME, UPLOAD_DIR, isAllowedMime, upload, ensureUploadDir } = require('../lib/uploads');
const fs = require('fs');

afterAll(() => { try { fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }); } catch (_) {} });

test('allows only the documented mime types', () => {
  ['image/jpeg','image/png','image/gif','image/webp','application/pdf'].forEach((m) => expect(isAllowedMime(m)).toBe(true));
  ['text/html','application/x-msdownload','image/svg+xml',''].forEach((m) => expect(isAllowedMime(m)).toBe(false));
});

test('ensureUploadDir creates the directory idempotently', () => {
  ensureUploadDir();
  expect(fs.existsSync(UPLOAD_DIR)).toBe(true);
  expect(() => ensureUploadDir()).not.toThrow();
});

test('multer instance is configured with a 10MB file size limit', () => {
  expect(upload).toBeDefined();
  // multer stores limits on the instance options
  // (smoke: the instance exposes .single)
  expect(typeof upload.single).toBe('function');
});
```

- [ ] **Step 3: Run, expect fail** — `... run --rm backend-test npx jest uploads` → FAIL (module not found).

- [ ] **Step 4: Implement `backend/lib/uploads.js`**
```js
'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024;

function isAllowedMime(mime) { return ALLOWED_MIME.has(mime); }

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { ensureUploadDir(); cb(null, UPLOAD_DIR); } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (isAllowedMime(file.mimetype)) cb(null, true);
    else cb(null, false); // rejected silently; route returns 400 when req.file is absent
  },
});

module.exports = { ALLOWED_MIME, UPLOAD_DIR, MAX_BYTES, isAllowedMime, ensureUploadDir, upload };
```

- [ ] **Step 5: Edit `backend/Dockerfile`** — add before `EXPOSE`:
```dockerfile
RUN mkdir -p /app/uploads
```

- [ ] **Step 6: Run, expect pass** — `... run --rm backend-test npx jest uploads` → PASS (3).

- [ ] **Step 7: Commit**
```bash
git add backend/lib/uploads.js backend/__tests__/uploads.test.js backend/package.json backend/Dockerfile
git commit -m "feat(7A.T2): multer upload config (10MB, image+pdf allow-list) + uploads lib"
```

---

### Task 3: `attachmentService` — CRUD over the attachments table

**Files:**
- Create: `backend/services/attachmentService.js`
- Create: `backend/__tests__/attachmentService.test.js`

**Interfaces:** `create`, `listForItem`, `getById`, `remove` (signatures above). Pool is the first arg.

- [ ] **Step 1: Write the failing test**

`backend/__tests__/attachmentService.test.js`:
```js
'use strict';
const svc = require('../services/attachmentService');

test('create inserts and returns the row', async () => {
  const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 1 }] }) };
  await svc.create(pool, { itemId: 5, uploaderId: 2, filename: 'a.png', mimeType: 'image/png', sizeBytes: 9, storageKey: 'k1' });
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/INSERT INTO attachments/);
  expect(params).toEqual([5, 2, 'a.png', 'image/png', 9, 'k1']);
});

test('listForItem queries by item ordered by created_at', async () => {
  const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 1 }] }) };
  const rows = await svc.listForItem(pool, 5);
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/WHERE item_id = \$1/);
  expect(params).toEqual([5]);
  expect(rows).toEqual([{ id: 1 }]);
});

test('getById returns row or null', async () => {
  const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
  expect(await svc.getById(pool, 9)).toBeNull();
});

test('remove deletes and returns the removed row', async () => {
  const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 3, storage_key: 'k3' }] }) };
  const removed = await svc.remove(pool, 3);
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/DELETE FROM attachments WHERE id = \$1 RETURNING/);
  expect(params).toEqual([3]);
  expect(removed.storage_key).toBe('k3');
});
```

- [ ] **Step 2: Run, expect fail** — `... npx jest attachmentService` → FAIL.

- [ ] **Step 3: Implement `backend/services/attachmentService.js`**
```js
'use strict';

async function create(pool, { itemId, uploaderId, filename, mimeType, sizeBytes, storageKey }) {
  const r = await pool.query(
    `INSERT INTO attachments (item_id, uploader_id, filename, mime_type, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [itemId, uploaderId, filename, mimeType, sizeBytes, storageKey]
  );
  return r.rows[0];
}

async function listForItem(pool, itemId) {
  const r = await pool.query(
    `SELECT * FROM attachments WHERE item_id = $1 ORDER BY created_at ASC, id ASC`,
    [itemId]
  );
  return r.rows;
}

async function getById(pool, id) {
  const r = await pool.query(`SELECT * FROM attachments WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function remove(pool, id) {
  const r = await pool.query(`DELETE FROM attachments WHERE id = $1 RETURNING *`, [id]);
  return r.rows[0] || null;
}

module.exports = { create, listForItem, getById, remove };
```

- [ ] **Step 4: Run, expect pass.** — `... npx jest attachmentService` → PASS (4).

- [ ] **Step 5: Commit**
```bash
git add backend/services/attachmentService.js backend/__tests__/attachmentService.test.js
git commit -m "feat(7A.T3): attachmentService CRUD"
```

---

### Task 4: `routes/attachments.js` + mount + boot dir + compose volume

**Files:**
- Create: `backend/routes/attachments.js`
- Create: `backend/__tests__/attachments.integration.test.js`
- Modify: `backend/server.js` (mount + `ensureUploadDir()` at boot)
- Modify: `docker-compose.yml`, `docker-compose.traefik.yml`, `docker-compose.production.yml` (volume)

**Interfaces:**
- Factory `module.exports = (authenticateToken, upload) => router`. Mounted: `app.use('/api', require('./routes/attachments')(authenticateToken, require('./lib/uploads').upload));`
- Consumes `attachmentService`, `lib/uploads` (UPLOAD_DIR), `services/itemAccess.getItemAccess`, `db/pool`, `jsonwebtoken` (for the download `?token=` fallback — reuse the same verify the auth middleware uses; import the app's JWT secret).

- [ ] **Step 1: Write the failing real-router integration test**

`backend/__tests__/attachments.integration.test.js` — mounts the real router via supertest with a temp `UPLOAD_DIR`, a real DB (fresh user/list/item, cleaned up). Cover:
- POST a small PNG buffer → 201, row persisted, file written to disk.
- POST a disallowed type (e.g. `text/plain`) → 400.
- GET list → returns the attachment.
- GET download (with `Authorization` header) → 200, correct `Content-Type`, body bytes match.
- DELETE (uploader) → 204/200, row gone, file unlinked.
- view-only user (share 'view') → 403 on POST; 200 on GET list/download. non-member → 404/403.
Use supertest `.attach('file', buffer, {filename, contentType})`. Set `process.env.UPLOAD_DIR` to an OS temp dir in the test and clean it in afterAll.

- [ ] **Step 2: Run, expect fail** — `... npm run test:integration -- attachments` → FAIL.

- [ ] **Step 3: Implement `backend/routes/attachments.js`**
```js
'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { getItemAccess } = require('../services/itemAccess');
const attachmentService = require('../services/attachmentService');
const { UPLOAD_DIR } = require('../lib/uploads');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

module.exports = (authenticateToken, upload) => {
  const router = express.Router();

  // POST /items/:id/attachments — multipart single 'file'. Auth via header.
  router.post('/items/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const access = await getItemAccess(pool, req.params.id, req.user.id);
      if (!access.found)   { cleanup(req.file); return res.status(404).json({ error: 'Item not found' }); }
      if (!access.canEdit) { cleanup(req.file); return res.status(403).json({ error: 'No edit permission' }); }
      if (!req.file)       return res.status(400).json({ error: 'No valid file (allowed: jpeg, png, gif, webp, pdf; max 10MB)' });

      const row = await attachmentService.create(pool, {
        itemId: Number(req.params.id),
        uploaderId: req.user.id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storageKey: req.file.filename,
      });
      res.status(201).json(row);
    } catch (e) {
      cleanup(req.file);
      console.error('POST attachments error:', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // GET /items/:id/attachments
  router.get('/items/:id/attachments', authenticateToken, async (req, res) => {
    try {
      const access = await getItemAccess(pool, req.params.id, req.user.id);
      if (!access.found)   return res.status(404).json({ error: 'Item not found' });
      if (!access.canView) return res.status(403).json({ error: 'Not authorized' });
      res.json(await attachmentService.listForItem(pool, req.params.id));
    } catch (e) {
      console.error('GET attachments error:', e);
      res.status(500).json({ error: 'Failed to list attachments' });
    }
  });

  // GET /attachments/:id/download — auth via header OR ?token= (for <img>/anchor)
  router.get('/attachments/:id/download', async (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const att = await attachmentService.getById(pool, req.params.id);
      if (!att) return res.status(404).json({ error: 'Not found' });
      const access = await getItemAccess(pool, att.item_id, user.id);
      if (!access.found || !access.canView) return res.status(403).json({ error: 'Not authorized' });

      const filePath = path.join(UPLOAD_DIR, att.storage_key);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
      res.setHeader('Content-Type', att.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${att.filename.replace(/"/g, '')}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      console.error('GET download error:', e);
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // DELETE /attachments/:id — uploader or item editor
  router.delete('/attachments/:id', authenticateToken, async (req, res) => {
    try {
      const att = await attachmentService.getById(pool, req.params.id);
      if (!att) return res.status(404).json({ error: 'Not found' });
      const access = await getItemAccess(pool, att.item_id, req.user.id);
      if (!access.found)   return res.status(404).json({ error: 'Item not found' });
      if (!access.canEdit) return res.status(403).json({ error: 'No edit permission' });

      const removed = await attachmentService.remove(pool, req.params.id);
      if (removed) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR, removed.storage_key)); }
        catch (e) { console.error('attachment file unlink failed (non-fatal):', e.message); }
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('DELETE attachment error:', e);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  function resolveUser(req) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
  }
  function cleanup(file) {
    if (file && file.path) { try { fs.unlinkSync(file.path); } catch (_) {} }
  }

  return router;
};
```

- [ ] **Step 4: Mount + ensure dir in `backend/server.js`** — alongside the other route factories (after the push mount ~line 1163):
```js
const { upload: attachmentUpload, ensureUploadDir } = require('./lib/uploads');
ensureUploadDir();
app.use('/api', require('./routes/attachments')(authenticateToken, attachmentUpload));
```
(Place `ensureUploadDir()` at module top with the other boot setup, or just before the mount — it's idempotent.)

- [ ] **Step 5: Add the volume to all three compose files** — under the backend service `volumes:` (add the key if absent), and declare the named volume next to `postgres_data`:
```yaml
    volumes:
      - attachments_data:/app/uploads
# ...and in the top-level volumes: block
volumes:
  postgres_data:
  attachments_data:
```
(Do this in `docker-compose.yml`, `docker-compose.traefik.yml`, `docker-compose.production.yml`, matching each file's existing structure.)

- [ ] **Step 6: Run, expect pass** — `docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npm run test:integration -- attachments` → PASS; also `... npm test` (unit suite green).

- [ ] **Step 7: Commit**
```bash
git add backend/routes/attachments.js backend/__tests__/attachments.integration.test.js backend/server.js docker-compose.yml docker-compose.traefik.yml docker-compose.production.yml
git commit -m "feat(7A.T4): attachments routes (upload/list/download/delete) + mount + volume"
```

---

### Task 5: Frontend hooks + `AttachmentList` + drawer wiring

**Files:**
- Modify: `frontend/src/lib/api.js` (add 3 hooks)
- Create: `frontend/src/features/attachments/AttachmentList.jsx`
- Create: `frontend/src/features/attachments/__tests__/AttachmentList.test.jsx`
- Create: `frontend/src/lib/__tests__/api.attachments.test.jsx`
- Modify: `frontend/src/features/items/ItemDetailDrawer.jsx` (add Attachments section)

**Interfaces:** hooks above. Download/thumbnail URLs are `/api/attachments/${id}/download?token=${jwt}` where the jwt comes from `localStorage.getItem('token')`.

- [ ] **Step 1: Add hooks to `frontend/src/lib/api.js`** (follow existing patterns; FormData upload):
```js
export function useAttachments(itemId) {
  return useQuery({
    queryKey: ['attachments', itemId],
    queryFn: async () => (await apiClient.get(`/items/${itemId}/attachments`)).data,
    enabled: Boolean(itemId),
  })
}
export function useUploadAttachment(itemId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/items/${itemId}/attachments`, fd)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['attachments', itemId] }),
  })
}
export function useDeleteAttachment(itemId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId) => apiClient.delete(`/attachments/${attachmentId}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['attachments', itemId] }),
  })
}
```
(Do NOT set a `Content-Type` header for the FormData post — axios sets the multipart boundary automatically. The interceptor's `X-CSRF-Token` still applies.)

- [ ] **Step 2: Write `AttachmentList.test.jsx`** — mock `../../lib/api`: renders attachments (image → `<img>` whose src contains `/api/attachments/<id>/download`; non-image → a download link); upload input change calls `useUploadAttachment.mutate(file)`; delete button calls `useDeleteAttachment.mutate(id)`; empty → a subtle "No attachments" hint. testids `attachment-list`, `attachment-${id}`, `delete-attachment-${id}`, `attachment-upload-input`.

- [ ] **Step 3: Write `api.attachments.test.jsx`** — mock apiClient: useAttachments GETs the right URL; useUploadAttachment posts FormData to `/items/:id/attachments`; useDeleteAttachment DELETEs `/attachments/:id`; both invalidate `['attachments', itemId]`.

- [ ] **Step 4: Run, expect fail** — `cd frontend && npm test -- AttachmentList api.attachments` → FAIL.

- [ ] **Step 5: Implement `AttachmentList.jsx`** — uses the 3 hooks; image mime → thumbnail `<img>` linking to the download URL, else a filename download link; a file `<input type="file">` (accept the allowed types) whose onChange calls upload then resets; a delete (×) per row. Build the URL with the token: `const token = localStorage.getItem('token'); const url = \`/api/attachments/${a.id}/download?token=${token}\``. ui/ tokens only.

- [ ] **Step 6: Wire into `ItemDetailDrawer.jsx`** — add an "Attachments" section (`ui/Field`-style heading) rendering `<AttachmentList itemId={item.id} />` below the Custom fields section, only when `item` exists.

- [ ] **Step 7: Run, expect pass + build** — `cd frontend && npm test` (full suite green) and `cd frontend && npm run build`.

- [ ] **Step 8: Commit**
```bash
git add frontend/src/lib/api.js frontend/src/features/attachments frontend/src/features/items/ItemDetailDrawer.jsx frontend/src/lib/__tests__/api.attachments.test.jsx
git commit -m "feat(7A.T5): attachment hooks + AttachmentList UI wired into item drawer"
```

---

### Task 6: Live Playwright E2E (upload + view + delete)

**Files:** none committed (verification task). Document results in the report.

- [ ] **Step 1:** Rebuild + restart the backend + frontend containers on the branch (`docker compose up -d --build backend frontend`); confirm health.
- [ ] **Step 2:** Live Playwright against `/`: open a list, open an item's detail drawer, upload a small PNG via the attachment input, verify it appears as a thumbnail and the row persists after closing/reopening the drawer; verify the download URL returns the image (200, image content-type); delete it and confirm it disappears. Screenshot.
- [ ] **Step 3:** Fix any runtime bugs found (commit fixes with `fix(7A.T6): ...`). Document in the report.

---

## Self-review notes
- Spec coverage: file/photo attachments with storage infra → Tasks 1-6. Storage = local volume (decision documented). Automations/recurring tasks are Phase 7B (separate plan).
- Security: upload/delete gated on item EDIT, list/download on VIEW; download token-in-query tradeoff documented; mime allow-list + 10MB cap enforced by multer; UUID storage keys (no path traversal); file unlinked on delete + on failed upload.
- Zero-loss: additive migration 014 only.

## Pre-deploy note for the user (document in final report)
- The `attachments_data` Docker volume persists uploads across deploys — confirm it's declared in whichever compose file you deploy with, and include it in backups alongside the DB.
- Download URLs embed the JWT as `?token=` (needed for `<img>`/anchor GETs). Acceptable at this scale; revisit with signed short-lived URLs if attachments ever become public/shared externally.
