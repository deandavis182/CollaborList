'use strict';
jest.mock('../lib/recurrence', () => ({ nextDueDate: jest.fn(() => new Date('2026-07-23T00:00:00.000Z')) }));
const svc = require('../services/recurrenceService');

const RULE_ITEM = { id: 5, list_id: 3, text: 'Pay installment', parent_id: null, assignee_id: 7,
  due_date: '2026-06-23T00:00:00.000Z', completed: true, recur_unit: 'month', recur_interval: 1 };

test('spawns next occurrence on completion transition', async () => {
  const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 99 }] }) };
  const row = await svc.maybeSpawnNext(pool, { item: RULE_ITEM, prevCompleted: false });
  expect(pool.query).toHaveBeenCalledTimes(1);
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/INSERT INTO list_items/);
  // new item: same list/text/parent/assignee, not completed, recurrence copied, advanced due
  expect(params).toContain(3);                 // list_id
  expect(params).toContain('Pay installment'); // text
  expect(params).toContain('month');           // recur_unit copied
  expect(row).toEqual({ id: 99 });
});
test('no spawn when already completed before (no transition)', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: RULE_ITEM, prevCompleted: true })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
test('no spawn when not completed now', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: { ...RULE_ITEM, completed: false }, prevCompleted: false })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
test('no spawn without a recurrence rule', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: { ...RULE_ITEM, recur_unit: null }, prevCompleted: false })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
test('no spawn without a due_date', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: { ...RULE_ITEM, due_date: null }, prevCompleted: false })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
