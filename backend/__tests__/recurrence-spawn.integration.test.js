// backend/__tests__/recurrence-spawn.integration.test.js
// Integration test: recurrenceService.maybeSpawnNext against a real DB.
// The SQL-level / service-level spawn is what is asserted here. The full
// HTTP item-PUT handler path is covered by the cross-list-move test suite
// staying green.
'use strict';

const { Pool } = require('pg');
const recurrenceService = require('../services/recurrenceService');

const OWNER_EMAIL = 'recurrence-spawn-int@example.test';

describe('recurrenceService.maybeSpawnNext — integration (real DB)', () => {
  let pool, userId, listId, itemId;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up any leftover rows from a previous run
    await pool.query('DELETE FROM users WHERE email = $1', [OWNER_EMAIL]);

    // Seed user + list + item
    userId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [OWNER_EMAIL]
    )).rows[0].id;

    listId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Recur Test List', $1) RETURNING id",
      [userId]
    )).rows[0].id;

    itemId = (await pool.query(
      `INSERT INTO list_items (list_id, text, recur_unit, recur_interval, due_date, completed)
       VALUES ($1, 'Weekly task', 'week', 1, '2025-01-06', FALSE)
       RETURNING id`,
      [listId]
    )).rows[0].id;
  });

  afterAll(async () => {
    // Cascades remove lists + list_items via FK
    await pool.query('DELETE FROM users WHERE email = $1', [OWNER_EMAIL]);
    await pool.end();
  });

  test('spawns a new not-completed item with due_date advanced 7 days when item transitions to completed', async () => {
    // Simulate the item as it would look after being marked completed
    const completedItem = {
      id: itemId,
      list_id: listId,
      text: 'Weekly task',
      parent_id: null,
      assignee_id: null,
      due_date: new Date('2025-01-06T00:00:00.000Z'),
      recur_unit: 'week',
      recur_interval: 1,
      completed: true,
    };

    const spawned = await recurrenceService.maybeSpawnNext(pool, {
      item: completedItem,
      prevCompleted: false,
    });

    expect(spawned).not.toBeNull();
    expect(spawned.list_id).toBe(listId);
    expect(spawned.text).toBe('Weekly task');
    expect(spawned.completed).toBe(false);
    expect(spawned.recur_unit).toBe('week');
    expect(spawned.recur_interval).toBe(1);

    // due_date should be advanced exactly 7 days from 2025-01-06 → 2025-01-13
    const spawnedDue = new Date(spawned.due_date);
    const expectedDue = new Date('2025-01-13T00:00:00.000Z');
    expect(spawnedDue.toISOString().slice(0, 10)).toBe(expectedDue.toISOString().slice(0, 10));

    // Verify the row actually exists in the DB
    const dbCheck = await pool.query(
      'SELECT * FROM list_items WHERE id = $1',
      [spawned.id]
    );
    expect(dbCheck.rows).toHaveLength(1);
    expect(dbCheck.rows[0].completed).toBe(false);
  });

  test('returns null and inserts nothing when prevCompleted is already true', async () => {
    // Count items before
    const before = await pool.query(
      'SELECT COUNT(*) FROM list_items WHERE list_id = $1',
      [listId]
    );
    const countBefore = parseInt(before.rows[0].count, 10);

    const completedItem = {
      id: itemId,
      list_id: listId,
      text: 'Weekly task',
      parent_id: null,
      assignee_id: null,
      due_date: new Date('2025-01-06T00:00:00.000Z'),
      recur_unit: 'week',
      recur_interval: 1,
      completed: true,
    };

    const result = await recurrenceService.maybeSpawnNext(pool, {
      item: completedItem,
      prevCompleted: true, // already was completed — no transition
    });

    expect(result).toBeNull();

    // Item count must be unchanged
    const after = await pool.query(
      'SELECT COUNT(*) FROM list_items WHERE list_id = $1',
      [listId]
    );
    const countAfter = parseInt(after.rows[0].count, 10);
    expect(countAfter).toBe(countBefore);
  });

  test('returns null when item has no recur_unit', async () => {
    const noRecurItem = {
      id: itemId,
      list_id: listId,
      text: 'One-off task',
      parent_id: null,
      assignee_id: null,
      due_date: new Date('2025-01-06T00:00:00.000Z'),
      recur_unit: null,
      recur_interval: null,
      completed: true,
    };

    const result = await recurrenceService.maybeSpawnNext(pool, {
      item: noRecurItem,
      prevCompleted: false,
    });

    expect(result).toBeNull();
  });
});
