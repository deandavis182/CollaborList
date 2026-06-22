'use strict';

const { list, create, remove, getOwnerAndItem, parseMentions } = require('../services/commentService');

describe('commentService', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    test('issues the join query with [itemId] and returns rows', async () => {
      const rows = [
        { id: 1, item_id: 5, user_id: 2, body: 'hello', created_at: new Date(), email: 'a@example.com' },
      ];
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await list(mockPool, 5);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/FROM comments c JOIN users u ON u\.id = c\.user_id/);
      expect(sql).toMatch(/WHERE c\.item_id = \$1/);
      expect(sql).toMatch(/ORDER BY c\.created_at ASC/);
      expect(params).toEqual([5]);
      expect(result).toBe(rows);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    test('inserts with [itemId, userId, body] and returns a row carrying email', async () => {
      const inserted = { id: 10, item_id: 5, user_id: 3, body: 'hey', created_at: new Date() };
      const email = 'b@example.com';

      // First query: INSERT … RETURNING
      mockPool.query.mockResolvedValueOnce({ rows: [inserted] });
      // Second query: SELECT email FROM users WHERE id=$1
      mockPool.query.mockResolvedValueOnce({ rows: [{ email }] });

      const result = await create(mockPool, { itemId: 5, userId: 3, body: 'hey' });

      // INSERT call
      const [insertSql, insertParams] = mockPool.query.mock.calls[0];
      expect(insertSql).toMatch(/INSERT INTO comments/);
      expect(insertSql).toMatch(/RETURNING/);
      expect(insertParams).toEqual([5, 3, 'hey']);

      // Result carries email
      expect(result).toEqual({ ...inserted, email });
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    test('deletes with [commentId]', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await remove(mockPool, 99);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/DELETE FROM comments WHERE id = \$1/);
      expect(params).toEqual([99]);
    });
  });

  // ---------------------------------------------------------------------------
  // getOwnerAndItem
  // ---------------------------------------------------------------------------
  describe('getOwnerAndItem', () => {
    test('returns { user_id, item_id } when a row is found', async () => {
      const row = { user_id: 7, item_id: 42 };
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      const result = await getOwnerAndItem(mockPool, 55);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/SELECT user_id, item_id FROM comments WHERE id = \$1/);
      expect(params).toEqual([55]);
      expect(result).toEqual(row);
    });

    test('returns null when no rows are found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getOwnerAndItem(mockPool, 999);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // parseMentions
  // ---------------------------------------------------------------------------
  describe('parseMentions', () => {
    test('extracts multiple mentions from a body', () => {
      expect(parseMentions('hello @alice and @bob!')).toEqual(['alice', 'bob']);
    });

    test('dedupes case-insensitively (@Dean and @dean → one "dean")', () => {
      expect(parseMentions('@Dean said hello @dean')).toEqual(['dean']);
    });

    test('handles full-email mentions (@a@b.com)', () => {
      const result = parseMentions('ping @a@b.com please');
      expect(result).toContain('a@b.com');
    });

    test('lone @ yields []', () => {
      expect(parseMentions('send to @')).toEqual([]);
    });

    test('@ followed by space yields []', () => {
      expect(parseMentions('@ hello')).toEqual([]);
    });

    test('empty string yields []', () => {
      expect(parseMentions('')).toEqual([]);
    });

    test('null / undefined yields []', () => {
      expect(parseMentions(null)).toEqual([]);
      expect(parseMentions(undefined)).toEqual([]);
    });

    test('ignores punctuation boundaries (hi @dean, @sue! → ["dean","sue"])', () => {
      expect(parseMentions('hi @dean, @sue!')).toEqual(['dean', 'sue']);
    });

    test('returns lowercased handles', () => {
      expect(parseMentions('@Alice @BOB')).toEqual(['alice', 'bob']);
    });
  });
});
