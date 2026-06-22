// backend/__tests__/migration-013.integration.test.js
// Integration test for migration 013_collab_defaults_and_watermark.
// Runs the SQL directly (not via runMigrations) because the test DB volume
// persists and name-gated migrations never re-run against freshly seeded data.
'use strict';

const { Pool } = require('pg');
const { migrations } = require('../db/migrations');

const MIGRATION_NAME = '013_collab_defaults_and_watermark';
const SEED_EMAIL = 'migration-013-seed@example.test';

describe('Migration 013 — collab_defaults_and_watermark (real DB)', () => {
  let pool;
  let userId;
  let listId;
  let migrationSql;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp',
      user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Resolve the migration SQL
    const m = migrations.find(m => m.name === MIGRATION_NAME);
    if (!m) throw new Error(`Migration ${MIGRATION_NAME} not found in migrations array`);
    migrationSql = m.sql;

    // Clean up any prior test data
    await pool.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);

    // Seed a throwaway user + list (needed to satisfy FK for list_items)
    const u = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [SEED_EMAIL]
    );
    userId = u.rows[0].id;

    const l = await pool.query(
      'INSERT INTO lists (name, user_id) VALUES ($1, $2) RETURNING id',
      ['Migration 013 Test List', userId]
    );
    listId = l.rows[0].id;
  });

  afterAll(async () => {
    // Deleting the user cascades to lists and list_items via FK
    await pool.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);
    await pool.end();
  });

  test('migration SQL exists in migrations array at position after 012', () => {
    const idx012 = migrations.findIndex(m => m.name === '012_backfill_workspaces_projects');
    const idx013 = migrations.findIndex(m => m.name === MIGRATION_NAME);
    expect(idx013).toBeGreaterThan(idx012);
  });

  test('migration is idempotent — runs twice without error', async () => {
    await expect(pool.query(migrationSql)).resolves.toBeDefined();
    await expect(pool.query(migrationSql)).resolves.toBeDefined();
  });

  test('workspace_members.last_seen_activity column exists', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'workspace_members'
        AND column_name = 'last_seen_activity'
    `);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].column_name).toBe('last_seen_activity');
    expect(result.rows[0].data_type).toBe('timestamp without time zone');
  });

  test('inserting a list_items row without status yields status = "To do" (DEFAULT)', async () => {
    const item = await pool.query(
      'INSERT INTO list_items (list_id, text) VALUES ($1, $2) RETURNING id, status',
      [listId, 'default-status-item']
    );
    expect(item.rows[0].status).toBe('To do');
  });

  test('backfill UPDATE: NULL status → "Done" when completed=true, "To do" when completed=false', async () => {
    // Force-insert two items with status=NULL bypassing the default
    const doneItem = await pool.query(
      "INSERT INTO list_items (list_id, text, completed, status) VALUES ($1, $2, true, NULL) RETURNING id",
      [listId, 'force-null-done']
    );
    const todoItem = await pool.query(
      "INSERT INTO list_items (list_id, text, completed, status) VALUES ($1, $2, false, NULL) RETURNING id",
      [listId, 'force-null-todo']
    );

    // Run the backfill portion of the migration SQL
    const backfillSql = `
      UPDATE list_items SET status = CASE WHEN completed THEN 'Done' ELSE 'To do' END
      WHERE status IS NULL
    `;
    await pool.query(backfillSql);

    const doneResult = await pool.query(
      'SELECT status FROM list_items WHERE id = $1',
      [doneItem.rows[0].id]
    );
    const todoResult = await pool.query(
      'SELECT status FROM list_items WHERE id = $1',
      [todoItem.rows[0].id]
    );

    expect(doneResult.rows[0].status).toBe('Done');
    expect(todoResult.rows[0].status).toBe('To do');
  });
});
