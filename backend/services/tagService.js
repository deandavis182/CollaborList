// backend/services/tagService.js
'use strict';

async function listForWorkspace(pool, wsId) {
  return (await pool.query('SELECT * FROM tags WHERE workspace_id=$1 ORDER BY name', [wsId])).rows;
}

async function create(pool, wsId, { name, color = null }) {
  return (await pool.query(
    'INSERT INTO tags (workspace_id,name,color) VALUES ($1,$2,$3) RETURNING *',
    [wsId, name, color]
  )).rows[0];
}

async function remove(pool, tagId) {
  await pool.query('DELETE FROM tags WHERE id=$1', [tagId]);
}

async function workspaceIdOfTag(pool, tagId) {
  const r = await pool.query('SELECT workspace_id FROM tags WHERE id=$1', [tagId]);
  return r.rows.length ? r.rows[0].workspace_id : null;
}

async function addToItem(pool, itemId, tagId) {
  await pool.query(
    'INSERT INTO item_tags (item_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [itemId, tagId]
  );
}

async function removeFromItem(pool, itemId, tagId) {
  await pool.query('DELETE FROM item_tags WHERE item_id=$1 AND tag_id=$2', [itemId, tagId]);
}

async function listForItem(pool, itemId) {
  return (await pool.query(
    'SELECT t.* FROM tags t JOIN item_tags it ON it.tag_id=t.id WHERE it.item_id=$1 ORDER BY t.name',
    [itemId]
  )).rows;
}

module.exports = { listForWorkspace, create, remove, workspaceIdOfTag, addToItem, removeFromItem, listForItem };
