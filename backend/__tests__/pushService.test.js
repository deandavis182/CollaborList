'use strict';
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));
const webpush = require('web-push');

describe('pushService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => { process.env = OLD_ENV; });

  function load() { return require('../services/pushService'); }

  test('isEnabled is false when VAPID keys are absent and setVapidDetails is not called', () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const svc = load();
    expect(svc.isEnabled()).toBe(false);
    expect(webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  test('isEnabled is true and configures web-push when keys present', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:a@b.com';
    const svc = load();
    expect(svc.isEnabled()).toBe(true);
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:a@b.com', 'pub', 'priv');
  });

  test('sendToUser no-ops when disabled', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const svc = load();
    const pool = { query: jest.fn() };
    const res = await svc.sendToUser(pool, 1, { title: 't', body: 'b', url: '/' });
    expect(res).toEqual({ sent: 0, pruned: 0 });
    expect(pool.query).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  test('sendToUser sends to each subscription and prunes 410/404', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:a@b.com';
    const svc = load();
    const pool = { query: jest.fn() };
    // listForUser query
    pool.query.mockResolvedValueOnce({ rows: [
      { id: 1, endpoint: 'e1', keys: { p256dh: 'x', auth: 'y' } },
      { id: 2, endpoint: 'e2', keys: { p256dh: 'x', auth: 'y' } },
    ]});
    webpush.sendNotification
      .mockResolvedValueOnce({})                       // e1 ok
      .mockRejectedValueOnce({ statusCode: 410 });     // e2 gone
    // deleteSubscription query for e2
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await svc.sendToUser(pool, 7, { title: 't', body: 'b', url: '/x' });

    expect(res).toEqual({ sent: 1, pruned: 1 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    // pruned the gone endpoint
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM push_subscriptions WHERE endpoint = $1', ['e2']
    );
  });

  test('saveSubscription upserts on endpoint conflict', async () => {
    const svc = load();
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 9 }] }) };
    await svc.saveSubscription(pool, 3, { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO push_subscriptions/);
    expect(sql).toMatch(/ON CONFLICT \(endpoint\) DO UPDATE/);
    expect(params).toEqual([3, 'e', { p256dh: 'p', auth: 'a' }]);
  });
});
