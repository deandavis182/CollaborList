'use strict';

const { getItemAccess } = require('../services/itemAccess');

describe('getItemAccess', () => {
  const itemId = 42;
  const userId = 1;
  const otherUserId = 2;
  const listId = 10;

  let mockPool;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
  });

  test('owner: owner_id === userId, permission null → found true, isOwner true, canView true, canEdit true, correct listId', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ owner_id: userId, permission: null, list_id: listId }],
    });

    const result = await getItemAccess(mockPool, itemId, userId);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE li.id = $1'),
      [itemId, userId]
    );
    expect(result.found).toBe(true);
    expect(result.listId).toBe(listId);
    expect(result.isOwner).toBe(true);
    expect(result.canView).toBe(true);
    expect(result.canEdit).toBe(true);
  });

  test('edit-share: owner_id !== userId, permission "edit" → canView true, canEdit true, isOwner false', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ owner_id: otherUserId, permission: 'edit', list_id: listId }],
    });

    const result = await getItemAccess(mockPool, itemId, userId);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE li.id = $1'),
      [itemId, userId]
    );
    expect(result.found).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.canView).toBe(true);
    expect(result.canEdit).toBe(true);
  });

  test('view-share: permission "view" → canView true, canEdit false', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ owner_id: otherUserId, permission: 'view', list_id: listId }],
    });

    const result = await getItemAccess(mockPool, itemId, userId);

    expect(result.found).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.canView).toBe(true);
    expect(result.canEdit).toBe(false);
  });

  test('no access: zero rows → found false, canView false, canEdit false, listId null', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getItemAccess(mockPool, itemId, userId);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE li.id = $1'),
      [itemId, userId]
    );
    expect(result.found).toBe(false);
    expect(result.listId).toBeNull();
    expect(result.isOwner).toBe(false);
    expect(result.canView).toBe(false);
    expect(result.canEdit).toBe(false);
  });
});
