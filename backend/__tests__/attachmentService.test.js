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
