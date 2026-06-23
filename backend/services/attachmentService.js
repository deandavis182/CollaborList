'use strict';

async function create(pool, { itemId, uploaderId, filename, mimeType, sizeBytes, storageKey }) {
  const r = await pool.query(
    `INSERT INTO attachments (item_id, uploader_id, filename, mime_type, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [itemId, uploaderId, filename, mimeType, sizeBytes, storageKey]
  );
  return r.rows[0];
}

async function listForItem(pool, itemId) {
  const r = await pool.query(
    `SELECT * FROM attachments WHERE item_id = $1 ORDER BY created_at ASC, id ASC`,
    [itemId]
  );
  return r.rows;
}

async function getById(pool, id) {
  const r = await pool.query(`SELECT * FROM attachments WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function remove(pool, id) {
  const r = await pool.query(`DELETE FROM attachments WHERE id = $1 RETURNING *`, [id]);
  return r.rows[0] || null;
}

module.exports = { create, listForItem, getById, remove };
