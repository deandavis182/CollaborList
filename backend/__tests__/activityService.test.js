'use strict';

const {
  record,
  listForWorkspace,
  unreadCount,
  markRead,
  projectContextForList,
} = require('../services/activityService');

describe('activityService', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
  });

  // ---------------------------------------------------------------------------
  // record
  // ---------------------------------------------------------------------------
  describe('record', () => {
    test('inserts with 6 params in order and returns the row', async () => {
      const row = {
        id: 1,
        workspace_id: 10,
        project_id: 20,
        actor_id: 3,
        verb: 'item.created',
        target: { id: 99 },
        meta: {},
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      const result = await record(mockPool, {
        workspaceId: 10,
        projectId: 20,
        actorId: 3,
        verb: 'item.created',
        target: { id: 99 },
        meta: {},
      });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO activity/);
      expect(sql).toMatch(/RETURNING/);
      expect(params).toEqual([10, 20, 3, 'item.created', { id: 99 }, {}]);
      expect(result).toBe(row);
    });

    test('uses projectId default null when omitted', async () => {
      const row = { id: 2, workspace_id: 10, project_id: null };
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      await record(mockPool, {
        workspaceId: 10,
        actorId: 3,
        verb: 'list.created',
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[1]).toBeNull(); // projectId
    });

    test('works when passed a fake transaction client (object with .query)', async () => {
      const fakeClient = { query: jest.fn() };
      const row = { id: 3, workspace_id: 5, verb: 'item.deleted' };
      fakeClient.query.mockResolvedValueOnce({ rows: [row] });

      const result = await record(fakeClient, {
        workspaceId: 5,
        actorId: 7,
        verb: 'item.deleted',
        target: null,
        meta: {},
      });

      expect(fakeClient.query).toHaveBeenCalledTimes(1);
      const [sql, params] = fakeClient.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO activity/);
      expect(params[0]).toBe(5);  // workspaceId
      expect(params[2]).toBe(7);  // actorId
      expect(result).toBe(row);
    });
  });

  // ---------------------------------------------------------------------------
  // listForWorkspace
  // ---------------------------------------------------------------------------
  describe('listForWorkspace', () => {
    test('issues join+ORDER BY DESC+LIMIT query with [workspaceId, limit], default limit 50', async () => {
      const rows = [
        { id: 1, workspace_id: 10, actor_email: 'a@example.com' },
        { id: 2, workspace_id: 10, actor_email: 'b@example.com' },
      ];
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await listForWorkspace(mockPool, 10);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/LEFT JOIN users u ON u\.id = a\.actor_id/);
      expect(sql).toMatch(/WHERE a\.workspace_id = \$1/);
      expect(sql).toMatch(/ORDER BY a\.created_at DESC/);
      expect(sql).toMatch(/LIMIT \$2/);
      expect(params).toEqual([10, 50]);
      expect(result).toBe(rows);
    });

    test('respects custom limit', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await listForWorkspace(mockPool, 10, { limit: 10 });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toEqual([10, 10]);
    });
  });

  // ---------------------------------------------------------------------------
  // unreadCount
  // ---------------------------------------------------------------------------
  describe('unreadCount', () => {
    test('returns the integer count and uses [workspaceId, userId] params', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 7 }] });

      const result = await unreadCount(mockPool, 10, 3);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/COUNT\(\*\)/);
      expect(sql).toMatch(/WHERE a\.workspace_id = \$1/);
      expect(sql).toMatch(/COALESCE/);
      expect(params).toEqual([10, 3]);
      expect(result).toBe(7);
    });

    test('returns 0 when no unread rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await unreadCount(mockPool, 10, 3);

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // markRead
  // ---------------------------------------------------------------------------
  describe('markRead', () => {
    test('runs UPDATE workspace_members with [workspaceId, userId]', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await markRead(mockPool, 10, 3);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/UPDATE workspace_members/);
      expect(sql).toMatch(/last_seen_activity/);
      expect(sql).toMatch(/WHERE workspace_id = \$1 AND user_id = \$2/);
      expect(params).toEqual([10, 3]);
    });
  });

  // ---------------------------------------------------------------------------
  // projectContextForList
  // ---------------------------------------------------------------------------
  describe('projectContextForList', () => {
    test('returns {workspaceId, projectId} when a list with a project is found', async () => {
      const row = { workspaceId: 10, projectId: 20 };
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      const result = await projectContextForList(mockPool, 5);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/FROM lists l LEFT JOIN projects p ON p\.id = l\.project_id/);
      expect(sql).toMatch(/WHERE l\.id = \$1/);
      expect(params).toEqual([5]);
      expect(result).toEqual({ workspaceId: 10, projectId: 20 });
    });

    test('returns {workspaceId: null, projectId: null} when no rows are found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await projectContextForList(mockPool, 999);

      expect(result).toEqual({ workspaceId: null, projectId: null });
    });
  });
});
