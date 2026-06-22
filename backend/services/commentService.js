'use strict';

/**
 * List all comments for an item, oldest-first, joined to their author's email.
 *
 * @param {object} pool - pg Pool instance
 * @param {number|string} itemId
 * @returns {Array} rows
 */
async function list(pool, itemId) {
  const r = await pool.query(
    `SELECT c.id, c.item_id, c.user_id, c.body, c.created_at, u.email
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.item_id = $1 ORDER BY c.created_at ASC, c.id ASC`,
    [itemId]
  );
  return r.rows;
}

/**
 * Insert a new comment and return the created row with the author's email.
 *
 * @param {object} pool - pg Pool instance
 * @param {{ itemId, userId, body }} opts
 * @returns {object} comment row with email field
 */
async function create(pool, { itemId, userId, body }) {
  const insertResult = await pool.query(
    `INSERT INTO comments (item_id, user_id, body) VALUES ($1,$2,$3)
     RETURNING id, item_id, user_id, body, created_at`,
    [itemId, userId, body]
  );
  const inserted = insertResult.rows[0];

  const userResult = await pool.query(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  );
  const email = userResult.rows[0].email;

  return { ...inserted, email };
}

/**
 * Delete a comment by id.
 *
 * @param {object} pool - pg Pool instance
 * @param {number|string} commentId
 */
async function remove(pool, commentId) {
  await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
}

/**
 * Fetch the user_id and item_id for a comment (for authorization checks).
 *
 * @param {object} pool - pg Pool instance
 * @param {number|string} commentId
 * @returns {{ user_id, item_id }|null}
 */
async function getOwnerAndItem(pool, commentId) {
  const r = await pool.query(
    'SELECT user_id, item_id FROM comments WHERE id = $1',
    [commentId]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0];
}

/**
 * Extract unique, lowercased mention handles from a comment body.
 *
 * A mention is @ followed by [A-Za-z0-9._%+-]+ optionally followed by
 * @[A-Za-z0-9.-]+ (to support @user@host.com Mastodon-style handles).
 *
 * @param {string|null|undefined} body
 * @returns {string[]}
 */
function parseMentions(body) {
  if (!body) return [];

  const pattern = /@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+)?)/g;
  const seen = new Set();
  const results = [];
  let match;

  while ((match = pattern.exec(body)) !== null) {
    const handle = match[1].toLowerCase();
    if (!seen.has(handle)) {
      seen.add(handle);
      results.push(handle);
    }
  }

  return results;
}

module.exports = { list, create, remove, getOwnerAndItem, parseMentions };
