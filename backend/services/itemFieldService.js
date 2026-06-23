// backend/services/itemFieldService.js
'use strict';

/**
 * Upsert or remove a field value on a list item.
 *
 * If value is null, undefined, or empty string, the value is removed and null is returned.
 * Otherwise, performs an UPSERT on item_fields and returns the upserted row.
 *
 * @param {object} pool
 * @param {number|string} itemId
 * @param {{ key: string, type: string, value: * }} param
 * @returns {object|null} The upserted row, or null if removed.
 */
async function setValue(pool, itemId, { key, type, value }) {
  if (value === null || value === undefined || value === '') {
    await removeValue(pool, itemId, key);
    return null;
  }

  // node-pg does not automatically serialize JS scalars to JSONB.
  // Wrap the value in JSON.stringify so pg can cast it to jsonb correctly.
  const result = await pool.query(
    `INSERT INTO item_fields (item_id, key, type, value)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (item_id, key) DO UPDATE
       SET type=EXCLUDED.type, value=EXCLUDED.value
     RETURNING *`,
    [itemId, key, type, JSON.stringify(value)]
  );
  return result.rows[0];
}

/**
 * Remove a field value from an item.
 *
 * @param {object} pool
 * @param {number|string} itemId
 * @param {string} key
 */
async function removeValue(pool, itemId, key) {
  await pool.query(
    'DELETE FROM item_fields WHERE item_id=$1 AND key=$2',
    [itemId, key]
  );
}

/**
 * Returns a key→value map of all fields set on an item.
 *
 * @param {object} pool
 * @param {number|string} itemId
 * @returns {{ [key: string]: * }}
 */
async function fieldsForItem(pool, itemId) {
  const result = await pool.query(
    'SELECT key, value FROM item_fields WHERE item_id=$1',
    [itemId]
  );
  const map = {};
  for (const row of result.rows) {
    map[row.key] = row.value;
  }
  return map;
}

module.exports = { setValue, removeValue, fieldsForItem };
