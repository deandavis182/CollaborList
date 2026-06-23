'use strict';
const svc = require('../services/prefsService');

describe('prefsService', () => {
  test('DEFAULT_PREFS matches the spec defaults', () => {
    expect(svc.DEFAULT_PREFS).toEqual({
      assignments: true, mentions: true, comments: false, reminders: true,
      muteProjects: [], quietHours: null,
    });
  });

  test('getPrefs merges stored prefs over defaults', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ prefs: { comments: true, muteProjects: [5] } }] }) };
    const out = await svc.getPrefs(pool, 1);
    expect(out).toEqual({
      assignments: true, mentions: true, comments: true, reminders: true,
      muteProjects: [5], quietHours: null,
    });
  });

  test('getPrefs returns defaults when no row exists', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    const out = await svc.getPrefs(pool, 1);
    expect(out).toEqual(svc.DEFAULT_PREFS);
  });

  test('setPrefs upserts merged prefs and ignores unknown keys', async () => {
    const pool = { query: jest.fn() };
    // getPrefs read inside setPrefs
    pool.query.mockResolvedValueOnce({ rows: [{ prefs: {} }] });
    // upsert
    pool.query.mockResolvedValueOnce({ rows: [{ prefs: { assignments: false } }] });
    const out = await svc.setPrefs(pool, 2, { assignments: false, bogus: 'x' });
    expect(out.assignments).toBe(false);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/INSERT INTO notification_prefs/);
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/);
    expect(params[0]).toBe(2);
    expect(params[1]).not.toHaveProperty('bogus');
    expect(params[1].assignments).toBe(false);
  });
});
