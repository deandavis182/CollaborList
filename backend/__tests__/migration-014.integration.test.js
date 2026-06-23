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
