'use strict';
jest.mock('../services/notificationService', () => ({ notifyDueReminder: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/pushService', () => ({ isEnabled: jest.fn(() => true) }));
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');
const job = require('../jobs/reminders');

describe('reminders.runReminderSweep', () => {
  beforeEach(() => jest.clearAllMocks());

  test('queries due items, notifies assignee, marks reminder_sent', async () => {
    const now = new Date('2026-06-23T09:00:00Z');
    const due = [
      { id: 7, text: 'Pay deposit', due_date: '2026-06-23T00:00:00Z', assignee_id: 4, list_id: 3, project_id: 2, workspace_id: 1, kind: 'today' },
    ];
    const pool = { query: jest.fn() };
    pool.query.mockResolvedValueOnce({ rows: due }); // findDueItems
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE reminder_sent

    const res = await job.runReminderSweep(pool, now);

    expect(notificationService.notifyDueReminder).toHaveBeenCalledTimes(1);
    const [, arg] = notificationService.notifyDueReminder.mock.calls[0];
    expect(arg.assigneeId).toBe(4);
    expect(arg.item.id).toBe(7);
    // marked sent
    const updateCall = pool.query.mock.calls.find(c => /UPDATE list_items SET reminder_sent = TRUE/.test(c[0]));
    expect(updateCall).toBeTruthy();
    expect(updateCall[1]).toEqual([[7]]);
    expect(res).toEqual({ scanned: 1, sent: 1 });
  });

  test('no due items → no notifications, no update', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    const res = await job.runReminderSweep(pool, new Date());
    expect(notificationService.notifyDueReminder).not.toHaveBeenCalled();
    expect(res).toEqual({ scanned: 0, sent: 0 });
  });
});

describe('reminders.startReminderJob', () => {
  test('no-ops when push disabled', () => {
    pushService.isEnabled.mockReturnValueOnce(false);
    const handle = job.startReminderJob({ query: jest.fn() }, { intervalMs: 1000 });
    expect(handle).toBeNull();
  });
});
