'use strict';

const DEFAULT_PREFS = {
  assignments: true,
  mentions: true,
  comments: false,
  reminders: true,
  muteProjects: [],
  quietHours: null,
};

const BOOL_KEYS = ['assignments', 'mentions', 'comments', 'reminders'];

function sanitize(partial) {
  const out = {};
  for (const k of BOOL_KEYS) {
    if (typeof partial[k] === 'boolean') out[k] = partial[k];
  }
  if (Array.isArray(partial.muteProjects)) {
    out.muteProjects = partial.muteProjects.map(Number).filter((n) => Number.isInteger(n));
  }
  if (partial.quietHours === null) {
    out.quietHours = null;
  } else if (partial.quietHours && typeof partial.quietHours === 'object') {
    const { start, end } = partial.quietHours;
    if (Number.isInteger(start) && Number.isInteger(end)) {
      out.quietHours = { start, end };
    }
  }
  return out;
}

async function getPrefs(pool, userId) {
  const result = await pool.query('SELECT prefs FROM notification_prefs WHERE user_id = $1', [userId]);
  const stored = result.rows[0] ? result.rows[0].prefs : {};
  return { ...DEFAULT_PREFS, ...stored };
}

async function setPrefs(pool, userId, partial) {
  const current = await getPrefs(pool, userId);
  const merged = { ...current, ...sanitize(partial) };
  await pool.query(
    `INSERT INTO notification_prefs (user_id, prefs)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs`,
    [userId, merged]
  );
  return merged;
}

module.exports = { DEFAULT_PREFS, getPrefs, setPrefs };
