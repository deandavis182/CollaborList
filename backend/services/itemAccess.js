'use strict';

/**
 * Retrieves item access details for a given user.
 *
 * Mirrors the permission SQL used in PUT /api/items/:id in server.js.
 *
 * @param {object} pool - pg Pool instance
 * @param {number|string} itemId
 * @param {number|string} userId
 * @returns {{ found, listId, isOwner, canView, canEdit }}
 */
async function getItemAccess(pool, itemId, userId) {
  const result = await pool.query(
    `SELECT l.user_id AS owner_id, ls.permission AS permission, li.list_id AS list_id
     FROM list_items li
     JOIN lists l ON li.list_id = l.id
     LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
     WHERE li.id = $1`,
    [itemId, userId]
  );

  if (result.rows.length === 0) {
    return { found: false, listId: null, isOwner: false, canView: false, canEdit: false };
  }

  const row = result.rows[0];
  const isOwner = row.owner_id === userId;
  const canEdit = isOwner || row.permission === 'edit';
  const canView = isOwner || row.permission != null;

  return { found: true, listId: row.list_id, isOwner, canView, canEdit };
}

module.exports = { getItemAccess };
