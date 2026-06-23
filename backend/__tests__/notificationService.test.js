'use strict';
jest.mock('../services/pushService', () => ({ sendToUser: jest.fn().mockResolvedValue({ sent: 1, pruned: 0 }) }));
jest.mock('../services/prefsService', () => ({
  DEFAULT_PREFS: { assignments:true, mentions:true, comments:false, reminders:true, muteProjects:[], quietHours:null },
  getPrefs: jest.fn(),
}));
const pushService = require('../services/pushService');
const prefsService = require('../services/prefsService');
const svc = require('../services/notificationService');

const D = { assignments:true, mentions:true, comments:false, reminders:true, muteProjects:[], quietHours:null };

describe('notificationService.isAllowed', () => {
  test('category toggle off → not allowed', () => {
    expect(svc.isAllowed({ ...D, comments:false }, 'comments', 10, new Date('2026-06-23T12:00:00'))).toBe(false);
    expect(svc.isAllowed({ ...D, assignments:true }, 'assignments', 10, new Date('2026-06-23T12:00:00'))).toBe(true);
  });
  test('muted project → not allowed even when category on', () => {
    expect(svc.isAllowed({ ...D, muteProjects:[10] }, 'assignments', 10, new Date('2026-06-23T12:00:00'))).toBe(false);
    expect(svc.isAllowed({ ...D, muteProjects:[10] }, 'assignments', 11, new Date('2026-06-23T12:00:00'))).toBe(true);
  });
  test('quiet hours suppress (non-wrapping window 22-7 covers 23:00)', () => {
    const now = new Date('2026-06-23T23:00:00'); // local hour 23
    expect(svc.isAllowed({ ...D, quietHours:{ start:22, end:7 } }, 'assignments', 1, now)).toBe(false);
  });
  test('quiet hours allow outside window (12:00 not in 22-7)', () => {
    const now = new Date('2026-06-23T12:00:00');
    expect(svc.isAllowed({ ...D, quietHours:{ start:22, end:7 } }, 'assignments', 1, now)).toBe(true);
  });
});

describe('notificationService.notifyAssignment', () => {
  beforeEach(() => jest.clearAllMocks());
  test('sends when allowed and recipient ≠ actor', async () => {
    prefsService.getPrefs.mockResolvedValueOnce({ ...D });
    const pool = {};
    await svc.notifyAssignment(pool, {
      assigneeId: 2, actorId: 1, projectId: 5, listId: 9,
      item: { id: 99, text: 'Book caterer' },
      workspaceId: 3,
    });
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, uid, payload] = pushService.sendToUser.mock.calls[0];
    expect(uid).toBe(2);
    expect(payload.title).toMatch(/assigned/i);
    expect(payload.body).toContain('Book caterer');
    expect(payload.url).toBe('/w/3/p/5/l/9?item=99');
  });
  test('does not send to the actor themselves', async () => {
    const pool = {};
    await svc.notifyAssignment(pool, { assigneeId: 1, actorId: 1, projectId: 5, listId: 9, item: { id: 1, text: 'x' }, workspaceId: 3 });
    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });
  test('suppressed when category off', async () => {
    prefsService.getPrefs.mockResolvedValueOnce({ ...D, assignments:false });
    await svc.notifyAssignment({}, { assigneeId: 2, actorId: 1, projectId: 5, listId: 9, item: { id: 1, text: 'x' }, workspaceId: 3 });
    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });
});

describe('notificationService.notifyDueReminder', () => {
  beforeEach(() => jest.clearAllMocks());
  test('sends reminder when allowed', async () => {
    prefsService.getPrefs.mockResolvedValueOnce({ ...D });
    await svc.notifyDueReminder({}, { assigneeId: 4, item: { id: 7, text: 'Pay deposit' }, projectId: 2, listId: 3, workspaceId: 1, kind: 'today' });
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, uid, payload] = pushService.sendToUser.mock.calls[0];
    expect(uid).toBe(4);
    expect(payload.body).toContain('Pay deposit');
  });
});
