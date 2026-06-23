// backend/__tests__/taskService.test.js
'use strict';

const { forUser } = require('../services/taskService');

describe('taskService.forUser', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
  });

  test('issues query containing assignee_id = $1', async () => {
    const rows = [{ id: 1, text: 'item', list_name: 'My List', project_name: null }];
    mockPool.query.mockResolvedValueOnce({ rows });

    await forUser(mockPool, 42);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/assignee_id = \$1/);
  });

  test('query contains the owner access branch (l.user_id = $1)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await forUser(mockPool, 7);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/l\.user_id = \$1/);
  });

  test('query contains the list_shares EXISTS branch', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await forUser(mockPool, 7);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM list_shares ls WHERE ls\.list_id = l\.id AND ls\.user_id = \$1\s*\)/);
  });

  test('query contains the workspace_members EXISTS branch', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await forUser(mockPool, 7);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM workspace_members wm WHERE wm\.workspace_id = p\.workspace_id AND wm\.user_id = \$1\s*\)/);
  });

  test('query orders by due_date ASC NULLS LAST', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await forUser(mockPool, 5);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY li\.due_date ASC NULLS LAST/);
  });

  test('uses default limit 200, called with [userId, 200]', async () => {
    const rows = [{ id: 10 }];
    mockPool.query.mockResolvedValueOnce({ rows });

    await forUser(mockPool, 99);

    const [, params] = mockPool.query.mock.calls[0];
    expect(params).toEqual([99, 200]);
  });

  test('respects a custom limit', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await forUser(mockPool, 99, { limit: 50 });

    const [, params] = mockPool.query.mock.calls[0];
    expect(params).toEqual([99, 50]);
  });

  test('returns r.rows', async () => {
    const rows = [{ id: 1, text: 'task', list_name: 'L', project_name: 'P' }];
    mockPool.query.mockResolvedValueOnce({ rows });

    const result = await forUser(mockPool, 3);

    expect(result).toBe(rows);
  });
});
