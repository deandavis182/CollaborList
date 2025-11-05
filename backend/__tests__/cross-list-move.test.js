const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Mock dependencies
jest.mock('pg');
jest.mock('socket.io');

describe('Cross-List Item Move Tests', () => {
  let app;
  let mockPool;
  let mockClient;
  let authToken;
  const JWT_SECRET = 'test-secret';
  const userId = 1;
  const otherUserId = 2;

  beforeAll(() => {
    // Set up environment variables
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://test';
  });

  beforeEach(() => {
    // Create mock pool and client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    Pool.mockImplementation(() => mockPool);

    // Clear all previous mocks
    jest.clearAllMocks();

    // Generate auth token
    authToken = jwt.sign({ id: userId, email: 'test@example.com' }, JWT_SECRET);

    // Set up Express app with minimal routes for testing
    app = express();
    app.use(express.json());

    // Add authenticateToken middleware
    const authenticateToken = (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) return res.sendStatus(401);

      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
      });
    };

    // Mock emitListUpdate function
    global.emitListUpdate = jest.fn();

    // Add the PUT /api/items/:id route
    app.put('/api/items/:id', authenticateToken, async (req, res) => {
      const { id } = req.params;
      let { text, completed, position, notes, parent_id, list_id: requestedListId } = req.body;

      // Sanitize text input if provided
      if (text !== undefined) {
        text = text.trim();
        if (text.length < 1) {
          return res.status(400).json({ error: 'Item text cannot be empty' });
        }
      }

      if (requestedListId !== undefined && requestedListId !== null) {
        const parsed = parseInt(requestedListId, 10);
        if (Number.isNaN(parsed)) {
          return res.status(400).json({ error: 'Invalid target list' });
        }
        requestedListId = parsed;
      }

      try {
        // Check edit permission through list
        const permCheck = await mockPool.query(
          `SELECT l.user_id, ls.permission, li.list_id
           FROM list_items li
           JOIN lists l ON li.list_id = l.id
           LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
           WHERE li.id = $1`,
          [id, req.user.id]
        );

        if (permCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Item not found' });
        }

        const isSourceOwner = permCheck.rows[0].user_id === req.user.id;
        const canEdit = isSourceOwner || permCheck.rows[0].permission === 'edit';

        if (!canEdit) {
          return res.status(403).json({ error: 'No edit permission' });
        }

        const originalListId = permCheck.rows[0].list_id;
        let targetListId = originalListId;
        let isCrossListMove = false;

        if (requestedListId !== undefined && requestedListId !== originalListId) {
          if (!isSourceOwner) {
            return res.status(403).json({ error: 'Only list owners can move items to other lists' });
          }

          const targetCheck = await mockPool.query(
            `SELECT l.user_id, ls.permission
             FROM lists l
             LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
             WHERE l.id = $1`,
            [requestedListId, req.user.id]
          );

          if (targetCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target list not found' });
          }

          const targetOwnerId = targetCheck.rows[0].user_id;
          const targetPermission = targetCheck.rows[0].permission;
          const canAddToTarget = targetOwnerId === req.user.id || targetPermission === 'edit';

          if (!canAddToTarget) {
            return res.status(403).json({ error: 'No edit permission on target list' });
          }

          targetListId = requestedListId;
          isCrossListMove = true;

          if (parent_id === undefined) {
            parent_id = null;
          }
        }

        const parentValidationListId = isCrossListMove ? targetListId : originalListId;

        if (parent_id !== undefined && parent_id !== null) {
          const parentCheck = await mockPool.query(
            'SELECT id FROM list_items WHERE id = $1 AND list_id = $2',
            [parent_id, parentValidationListId]
          );
          if (parentCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid parent item' });
          }
          if (parent_id == id) {
            return res.status(400).json({ error: 'Item cannot be its own parent' });
          }
        }

        if (isCrossListMove) {
          const posResult = await mockPool.query(
            'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM list_items WHERE list_id = $1 AND parent_id IS NOT DISTINCT FROM $2',
            [targetListId, parent_id === undefined ? null : parent_id]
          );
          position = posResult.rows[0].next_position;
        }

        let query = 'UPDATE list_items SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (text !== undefined) {
          query += `, text = $${paramCount++}`;
          params.push(text);
        }
        if (completed !== undefined) {
          query += `, completed = $${paramCount++}`;
          params.push(completed);
        }
        if (position !== undefined) {
          query += `, position = $${paramCount++}`;
          params.push(position);
        }
        if (notes !== undefined) {
          query += `, notes = $${paramCount++}`;
          params.push(notes);
        }
        if (parent_id !== undefined) {
          query += `, parent_id = $${paramCount++}`;
          params.push(parent_id);
        }
        if (requestedListId !== undefined) {
          query += `, list_id = $${paramCount++}`;
          params.push(targetListId);
        }

        query += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(id);

        let updatedItem;

        // Use transaction for cross-list moves to ensure atomicity
        if (isCrossListMove) {
          const client = await mockPool.connect();
          try {
            await client.query('BEGIN');

            // Update the main item
            const result = await client.query(query, params);

            if (result.rows.length === 0) {
              await client.query('ROLLBACK');
              return res.status(404).json({ error: 'Item not found' });
            }

            // Move all descendants to the target list
            await client.query(
              `WITH RECURSIVE subtree AS (
                 SELECT id FROM list_items WHERE id = $1
                 UNION
                 SELECT li.id
                 FROM list_items li
                 JOIN subtree s ON li.parent_id = s.id
               )
               UPDATE list_items
               SET list_id = $2
               WHERE id IN (SELECT id FROM subtree)`,
              [id, targetListId]
            );

            // Get the updated item with all changes
            const refreshedItem = await client.query('SELECT * FROM list_items WHERE id = $1', [id]);
            updatedItem = refreshedItem.rows[0];

            await client.query('COMMIT');

            // Emit updates after successful transaction
            emitListUpdate(originalListId, 'items-refresh', { listId: originalListId });
            emitListUpdate(targetListId, 'items-refresh', { listId: targetListId });
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        } else {
          // Simple update without transaction for non-cross-list changes
          const result = await mockPool.query(query, params);

          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
          }

          updatedItem = result.rows[0];
          emitListUpdate(targetListId, 'item-updated', { listId: targetListId, item: updatedItem });
        }

        res.json(updatedItem);
      } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
      }
    });
  });

  describe('Cross-List Move Feature', () => {
    test('should successfully move item to another list when user is owner', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 20;

      // Mock permission check - user is owner of source list
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: sourceListId }]
      });

      // Mock target list check - user is owner
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null }]
      });

      // Mock position calculation
      mockPool.query.mockResolvedValueOnce({
        rows: [{ next_position: 5 }]
      });

      // Mock transaction queries
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // UPDATE main item
          rows: [{ id: itemId, text: 'Test item', list_id: targetListId, position: 5 }]
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE descendants
        .mockResolvedValueOnce({ // SELECT refreshed item
          rows: [{ id: itemId, text: 'Test item', list_id: targetListId, position: 5 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(200);
      expect(response.body.list_id).toBe(targetListId);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(global.emitListUpdate).toHaveBeenCalledWith(sourceListId, 'items-refresh', { listId: sourceListId });
      expect(global.emitListUpdate).toHaveBeenCalledWith(targetListId, 'items-refresh', { listId: targetListId });
    });

    test('should rollback transaction if error occurs during cross-list move', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 20;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: sourceListId }]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null }]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ next_position: 5 }]
      });

      // Simulate error during transaction
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // UPDATE main item
          rows: [{ id: itemId, text: 'Test item', list_id: targetListId }]
        })
        .mockRejectedValueOnce(new Error('Database error')); // Simulate error

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(500);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should move item with descendants to another list', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 20;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: sourceListId }]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null }]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ next_position: 5 }]
      });

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: itemId, text: 'Parent item', list_id: targetListId }]
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE descendants with recursive CTE
        .mockResolvedValueOnce({
          rows: [{ id: itemId, text: 'Parent item', list_id: targetListId }]
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(200);

      // Verify the recursive CTE was called
      const recursiveCTECall = mockClient.query.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('WITH RECURSIVE subtree')
      );
      expect(recursiveCTECall).toBeDefined();
      // id from URL params is a string, targetListId is a number
      expect(recursiveCTECall[1]).toEqual([String(itemId), targetListId]);
    });
  });

  describe('Permission Validation', () => {
    test('should reject move if user is not owner of source list', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 20;

      // User has edit permission but is not owner
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: otherUserId, permission: 'edit', list_id: sourceListId }]
      });

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Only list owners can move items to other lists');
    });

    test('should reject move if user lacks edit permission on target list', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 20;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: sourceListId }]
      });

      // User has view permission on target
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: otherUserId, permission: 'view' }]
      });

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No edit permission on target list');
    });

    test('should allow move if user has edit permission on target list', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 20;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: sourceListId }]
      });

      // User has edit permission on target
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: otherUserId, permission: 'edit' }]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ next_position: 5 }]
      });

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: itemId, text: 'Test item', list_id: targetListId }]
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE descendants
        .mockResolvedValueOnce({
          rows: [{ id: itemId, text: 'Test item', list_id: targetListId }]
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(200);
    });

    test('should reject move if target list does not exist', async () => {
      const itemId = 1;
      const sourceListId = 10;
      const targetListId = 999;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: sourceListId }]
      });

      // Target list not found
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Target list not found');
    });

    test('should reject move if item does not exist', async () => {
      const itemId = 999;
      const targetListId = 20;

      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: targetListId });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid list_id format', async () => {
      const itemId = 1;

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ list_id: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid target list');
    });

    test('should allow regular updates without cross-list move', async () => {
      const itemId = 1;
      const listId = 10;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: userId, permission: null, list_id: listId }]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: itemId, text: 'Updated text', list_id: listId, completed: true }]
      });

      const response = await request(app)
        .put(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Updated text', completed: true });

      expect(response.status).toBe(200);
      expect(response.body.text).toBe('Updated text');
      expect(mockPool.connect).not.toHaveBeenCalled(); // No transaction for regular updates
    });
  });
});
