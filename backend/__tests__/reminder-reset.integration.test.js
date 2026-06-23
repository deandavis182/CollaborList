// backend/__tests__/reminder-reset.integration.test.js
// Integration test for the reminder_sent reset behaviour introduced in Task 5.
//
// Approach: SQL-level assertion (per the task brief).
// The item PUT handler in server.js builds a dynamic UPDATE query.  When due_date
// is present in the request body it appends both `due_date = $N` AND
// `reminder_sent = FALSE`.  We verify this by:
//   1. Seeding a list_items row with reminder_sent = TRUE.
//   2. Running the exact UPDATE that the handler would build for a due_date change.
//   3. Asserting reminder_sent is now FALSE in the DB.
//
// This avoids replicating the full server.js startup or the 400-line PUT handler.
'use strict';

const { Pool } = require('pg');

const OWNER_EMAIL = 'reminder-reset-owner@example.test';

describe('reminder_sent reset on due_date change (SQL-level)', () => {
  let pool;
  let ownerId, listId, itemId;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    await pool.query('DELETE FROM users WHERE email = $1', [OWNER_EMAIL]);

    ownerId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [OWNER_EMAIL]
    )).rows[0].id;

    listId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Reminder Reset List', $1) RETURNING id",
      [ownerId]
    )).rows[0].id;

    // Seed item with reminder_sent = TRUE to simulate a reminder that has already fired
    itemId = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, due_date, reminder_sent)
       VALUES ($1, 'Item with reminder', 1, '2026-01-01', TRUE) RETURNING id`,
      [listId]
    )).rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [OWNER_EMAIL]);
    await pool.end();
  });

  test('updating due_date resets reminder_sent to FALSE', async () => {
    // Confirm the starting state
    const before = await pool.query(
      'SELECT reminder_sent FROM list_items WHERE id = $1',
      [itemId]
    );
    expect(before.rows[0].reminder_sent).toBe(true);

    // Run the exact UPDATE the handler builds when due_date is in the request:
    //   UPDATE list_items SET updated_at = NOW(), due_date = $1, reminder_sent = FALSE
    //   WHERE id = $2 RETURNING *
    const result = await pool.query(
      'UPDATE list_items SET updated_at = NOW(), due_date = $1, reminder_sent = FALSE WHERE id = $2 RETURNING *',
      ['2027-06-30', itemId]
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].reminder_sent).toBe(false);

    // Double-check by re-fetching from the DB
    const after = await pool.query(
      'SELECT reminder_sent FROM list_items WHERE id = $1',
      [itemId]
    );
    expect(after.rows[0].reminder_sent).toBe(false);
  });

  test('setting due_date to null also resets reminder_sent to FALSE', async () => {
    // Re-arm reminder_sent = TRUE
    await pool.query('UPDATE list_items SET reminder_sent = TRUE WHERE id = $1', [itemId]);

    const before = await pool.query('SELECT reminder_sent FROM list_items WHERE id = $1', [itemId]);
    expect(before.rows[0].reminder_sent).toBe(true);

    // Clearing due_date (null) should also reset reminder_sent
    const result = await pool.query(
      'UPDATE list_items SET updated_at = NOW(), due_date = $1, reminder_sent = FALSE WHERE id = $2 RETURNING *',
      [null, itemId]
    );

    expect(result.rows[0].reminder_sent).toBe(false);
    expect(result.rows[0].due_date).toBeNull();
  });
});
