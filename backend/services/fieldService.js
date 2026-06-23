// backend/services/fieldService.js
'use strict';

const VALID_TYPES = ['number', 'text', 'date', 'status', 'person'];

/**
 * Retrieve list-level access for a given user.
 * Mirrors getItemAccess in services/itemAccess.js but queries the list directly.
 *
 * @param {object} pool
 * @param {number|string} listId
 * @param {number|string} userId
 * @returns {{ found, listId, isOwner, canView, canEdit }}
 */
async function getListAccess(pool, listId, userId) {
  const result = await pool.query(
    `SELECT l.user_id AS owner_id, ls.permission AS permission
     FROM lists l
     LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
     WHERE l.id = $1`,
    [listId, userId]
  );

  if (result.rows.length === 0) {
    return { found: false, listId: null, isOwner: false, canView: false, canEdit: false };
  }

  const row = result.rows[0];
  const isOwner = row.owner_id === userId || row.owner_id === Number(userId);
  const canEdit = isOwner || row.permission === 'edit';
  const canView = isOwner || row.permission != null;

  return { found: true, listId: Number(listId), isOwner, canView, canEdit };
}

/**
 * List all field definitions for a list, ordered by position then id.
 */
async function listDefs(pool, listId) {
  const result = await pool.query(
    'SELECT * FROM field_defs WHERE list_id=$1 ORDER BY position, id',
    [listId]
  );
  return result.rows;
}

/**
 * Create or upsert a field definition.
 * Throws with err.code='BAD_TYPE' if type is not in the valid set.
 */
async function createDef(pool, listId, { key, type, label, config, position }) {
  if (!VALID_TYPES.includes(type)) {
    const err = new Error(`Invalid field type: ${type}. Must be one of ${VALID_TYPES.join(', ')}`);
    err.code = 'BAD_TYPE';
    throw err;
  }

  const safeConfig = (config != null && typeof config === 'object') ? config : {};
  const safePosition = (position != null) ? position : 0;

  const result = await pool.query(
    `INSERT INTO field_defs (list_id, key, type, label, config, position)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (list_id, key) DO UPDATE
       SET type=$3, label=$4, config=$5, position=$6
     RETURNING *`,
    [listId, key, type, label || '', safeConfig, safePosition]
  );
  return result.rows[0];
}

/**
 * Update an existing field definition by its id.
 * Validates type if provided.
 */
async function updateDef(pool, defId, fields) {
  if (fields.type != null && !VALID_TYPES.includes(fields.type)) {
    const err = new Error(`Invalid field type: ${fields.type}. Must be one of ${VALID_TYPES.join(', ')}`);
    err.code = 'BAD_TYPE';
    throw err;
  }

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (fields.label != null)    { setClauses.push(`label=$${idx++}`);    values.push(fields.label); }
  if (fields.config != null)   { setClauses.push(`config=$${idx++}`);   values.push(fields.config); }
  if (fields.position != null) { setClauses.push(`position=$${idx++}`); values.push(fields.position); }
  if (fields.type != null)     { setClauses.push(`type=$${idx++}`);     values.push(fields.type); }

  if (setClauses.length === 0) {
    // Nothing to update — return existing row
    const r = await pool.query('SELECT * FROM field_defs WHERE id=$1', [defId]);
    return r.rows[0] || null;
  }

  values.push(defId);
  const result = await pool.query(
    `UPDATE field_defs SET ${setClauses.join(', ')} WHERE id=$${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a field definition by its id.
 */
async function removeDef(pool, defId) {
  await pool.query('DELETE FROM field_defs WHERE id=$1', [defId]);
}

/**
 * Retrieve the list_id for a given field def (for authz on PUT/DELETE).
 * Returns null if not found.
 */
async function listIdOfDef(pool, defId) {
  const result = await pool.query(
    'SELECT list_id FROM field_defs WHERE id=$1',
    [defId]
  );
  return result.rows.length > 0 ? result.rows[0].list_id : null;
}

const PRESETS = {
  budget: [
    { key: 'cost',    type: 'number', label: 'Cost',    config: { unit: '$' },                           position: 0 },
    { key: 'payment', type: 'status', label: 'Payment', config: { options: ['Estimated', 'Booked', 'Paid'] }, position: 1 },
  ],
  guests: [
    { key: 'party_size', type: 'number', label: 'Party size', config: {},                                        position: 0 },
    { key: 'rsvp',       type: 'status', label: 'RSVP',       config: { options: ['Invited', 'Yes', 'No', 'Maybe'] }, position: 1 },
  ],
};

/**
 * Idempotently apply a named preset to a list, then return listDefs.
 * Throws with err.code='BAD_PRESET' for unknown preset names.
 */
async function applyPreset(pool, listId, preset) {
  if (!PRESETS[preset]) {
    const err = new Error(`Unknown preset: ${preset}. Must be one of ${Object.keys(PRESETS).join(', ')}`);
    err.code = 'BAD_PRESET';
    throw err;
  }

  for (const def of PRESETS[preset]) {
    await createDef(pool, listId, def);
  }

  return listDefs(pool, listId);
}

module.exports = { getListAccess, listDefs, createDef, updateDef, removeDef, listIdOfDef, applyPreset };
