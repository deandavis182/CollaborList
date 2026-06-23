'use strict';

const presence = require('../realtime/presence');

describe('realtime/presence', () => {
  beforeEach(() => {
    presence.clear();
  });

  // ---------------------------------------------------------------------------
  // setOnline
  // ---------------------------------------------------------------------------
  describe('setOnline', () => {
    test('adds an entry with the correct fields', () => {
      const entry = presence.setOnline(1, 'alice@example.com');
      expect(entry).toMatchObject({
        userId: 1,
        email: 'alice@example.com',
        currentListId: null,
      });
      expect(typeof entry.lastSeen).toBe('number');
    });

    test('calling setOnline again for the same user preserves currentListId set in between', () => {
      presence.setOnline(1, 'alice@example.com');
      presence.setCurrentList(1, 42);

      const entry = presence.setOnline(1, 'alice@example.com');
      expect(entry.currentListId).toBe(42);
    });

    test('updates lastSeen on subsequent setOnline call', () => {
      const first = presence.setOnline(1, 'alice@example.com');
      const firstSeen = first.lastSeen;
      // Advance time by patching Date.now
      const originalNow = Date.now;
      Date.now = () => firstSeen + 1000;
      const second = presence.setOnline(1, 'alice@example.com');
      Date.now = originalNow;
      expect(second.lastSeen).toBeGreaterThan(firstSeen);
    });
  });

  // ---------------------------------------------------------------------------
  // setCurrentList
  // ---------------------------------------------------------------------------
  describe('setCurrentList', () => {
    test('sets currentListId (numeric)', () => {
      presence.setOnline(1, 'alice@example.com');
      const entry = presence.setCurrentList(1, 7);
      expect(entry.currentListId).toBe(7);
    });

    test('coerces string listId to Number', () => {
      presence.setOnline(1, 'alice@example.com');
      const entry = presence.setCurrentList(1, '99');
      expect(entry.currentListId).toBe(99);
      expect(typeof entry.currentListId).toBe('number');
    });

    test('coerces null to null', () => {
      presence.setOnline(1, 'alice@example.com');
      presence.setCurrentList(1, 5);
      const entry = presence.setCurrentList(1, null);
      expect(entry.currentListId).toBeNull();
    });

    test('bumps lastSeen', () => {
      presence.setOnline(1, 'alice@example.com');
      const before = Date.now();
      const originalNow = Date.now;
      Date.now = () => before + 500;
      const entry = presence.setCurrentList(1, 3);
      Date.now = originalNow;
      expect(entry.lastSeen).toBe(before + 500);
    });

    test('is a no-op and returns null for an offline user', () => {
      const result = presence.setCurrentList(99, 5);
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // setOffline
  // ---------------------------------------------------------------------------
  describe('setOffline', () => {
    test('removes the entry; snapshot no longer contains the user', () => {
      presence.setOnline(1, 'alice@example.com');
      const removed = presence.setOffline(1);
      expect(removed).toBe(true);
      const snap = presence.snapshot();
      expect(snap.some((e) => e.userId === 1)).toBe(false);
    });

    test('returns false when removing a user who is not present', () => {
      const result = presence.setOffline(999);
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // snapshot
  // ---------------------------------------------------------------------------
  describe('snapshot', () => {
    test('returns an empty array when no users are online', () => {
      expect(presence.snapshot()).toEqual([]);
    });

    test('returns an array of all current entries with the expected shape', () => {
      presence.setOnline(1, 'alice@example.com');
      presence.setOnline(2, 'bob@example.com');
      presence.setCurrentList(2, 10);

      const snap = presence.snapshot();
      expect(snap).toHaveLength(2);

      const alice = snap.find((e) => e.userId === 1);
      expect(alice).toMatchObject({
        userId: 1,
        email: 'alice@example.com',
        currentListId: null,
      });
      expect(typeof alice.lastSeen).toBe('number');

      const bob = snap.find((e) => e.userId === 2);
      expect(bob).toMatchObject({
        userId: 2,
        email: 'bob@example.com',
        currentListId: 10,
      });
    });

    test('returns plain objects (not Map entries)', () => {
      presence.setOnline(1, 'alice@example.com');
      const snap = presence.snapshot();
      expect(Array.isArray(snap)).toBe(true);
      expect(snap[0]).toEqual(expect.objectContaining({ userId: 1 }));
    });
  });

  // ---------------------------------------------------------------------------
  // clear (test helper)
  // ---------------------------------------------------------------------------
  describe('clear', () => {
    test('empties the map so snapshot returns []', () => {
      presence.setOnline(1, 'a@b.com');
      presence.setOnline(2, 'c@d.com');
      presence.clear();
      expect(presence.snapshot()).toEqual([]);
    });
  });
});
