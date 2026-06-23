'use strict';

/**
 * In-memory presence store.
 * Ephemeral: never persisted — same single-instance tradeoff as the existing
 * in-memory rate limiting.
 *
 * Map key: userId (Number)
 * Map value: { userId, email, currentListId, lastSeen }
 */
const _map = new Map();

/**
 * Mark a user online (upsert).
 * Preserves the existing currentListId if the user was already present.
 * @param {number} userId
 * @param {string} email
 * @returns {{ userId, email, currentListId, lastSeen }}
 */
function setOnline(userId, email) {
  const existing = _map.get(userId);
  const entry = {
    userId,
    email,
    currentListId: existing ? existing.currentListId : null,
    lastSeen: Date.now(),
  };
  _map.set(userId, entry);
  return entry;
}

/**
 * Update the list a user is currently viewing.
 * Coerces listId to Number (or null). Bumps lastSeen.
 * No-op and returns null if the user is not online.
 * @param {number} userId
 * @param {number|string|null} listId
 * @returns {{ userId, email, currentListId, lastSeen }|null}
 */
function setCurrentList(userId, listId) {
  const entry = _map.get(userId);
  if (!entry) return null;

  entry.currentListId = listId === null || listId === undefined ? null : Number(listId);
  entry.lastSeen = Date.now();
  return entry;
}

/**
 * Mark a user offline (remove from map).
 * @param {number} userId
 * @returns {boolean} true if the user was present and removed, false otherwise
 */
function setOffline(userId) {
  return _map.delete(userId);
}

/**
 * Return a snapshot of all currently online users as plain objects.
 * @returns {Array<{ userId, email, currentListId, lastSeen }>}
 */
function snapshot() {
  return Array.from(_map.values()).map((entry) => ({ ...entry }));
}

/**
 * Empty the map. Used in tests.
 */
function clear() {
  _map.clear();
}

module.exports = { setOnline, setCurrentList, setOffline, snapshot, clear };
