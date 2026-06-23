'use strict';
const pool = require('../db/pool');
const { runMigrations } = require('../db/migrations');
beforeAll(async () => { await runMigrations(); });
afterAll(async () => { await pool.end(); });

test('list_items has recur_unit and recur_interval columns', async () => {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='list_items'`);
  const cols = r.rows.map((x) => x.column_name);
  expect(cols).toContain('recur_unit');
  expect(cols).toContain('recur_interval');
});
test('migration idempotent', async () => { await expect(runMigrations()).resolves.not.toThrow(); });
test('columns default to NULL (no recurrence) for a new item', async () => {
  const u = await pool.query(`INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id`, ['recur-mig@x.com','x']);
  const l = await pool.query(`INSERT INTO lists (name,user_id) VALUES ($1,$2) RETURNING id`, ['L', u.rows[0].id]);
  const it = await pool.query(`INSERT INTO list_items (list_id,text) VALUES ($1,$2) RETURNING recur_unit, recur_interval`, [l.rows[0].id, 'i']);
  expect(it.rows[0].recur_unit).toBeNull();
  expect(it.rows[0].recur_interval).toBeNull();
  await pool.query(`DELETE FROM users WHERE id=$1`, [u.rows[0].id]);
});
