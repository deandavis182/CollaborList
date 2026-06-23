'use strict';
// backend/__tests__/itemActivity.test.js
// Unit tests for the pure itemActivityEvents helper.
// No pool, no DB — pure logic only.

const { itemActivityEvents } = require('../services/activityService');

describe('itemActivityEvents', () => {
  const actorId = 99;

  // -------------------------------------------------------------------------
  // assignee changes
  // -------------------------------------------------------------------------

  test('assignee newly set (null → number) emits assigned event', () => {
    const before = { assignee_id: null, completed: false };
    const after  = { id: 1, assignee_id: 5, completed: false };
    const events = itemActivityEvents(before, after, actorId);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      verb: 'assigned',
      target: { itemId: 1 },
      meta: { assigneeId: 5 },
    });
  });

  test('assignee unchanged → no events', () => {
    const before = { assignee_id: 5, completed: false };
    const after  = { id: 1, assignee_id: 5, completed: false };
    expect(itemActivityEvents(before, after, actorId)).toHaveLength(0);
  });

  test('assignee cleared (number → null) → no assigned event', () => {
    const before = { assignee_id: 5, completed: false };
    const after  = { id: 1, assignee_id: null, completed: false };
    expect(itemActivityEvents(before, after, actorId)).toHaveLength(0);
  });

  test('assignee changed from one user to another emits assigned event with new assignee', () => {
    const before = { assignee_id: 5, completed: false };
    const after  = { id: 2, assignee_id: 7, completed: false };
    const events = itemActivityEvents(before, after, actorId);
    expect(events).toHaveLength(1);
    expect(events[0].verb).toBe('assigned');
    expect(events[0].meta.assigneeId).toBe(7);
  });

  // -------------------------------------------------------------------------
  // completed changes
  // -------------------------------------------------------------------------

  test('completed false → true emits completed event', () => {
    const before = { assignee_id: null, completed: false };
    const after  = { id: 3, assignee_id: null, completed: true };
    const events = itemActivityEvents(before, after, actorId);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      verb: 'completed',
      target: { itemId: 3 },
      meta: {},
    });
  });

  test('completed already true → no completed event', () => {
    const before = { assignee_id: null, completed: true };
    const after  = { id: 4, assignee_id: null, completed: true };
    expect(itemActivityEvents(before, after, actorId)).toHaveLength(0);
  });

  test('completed true → false → no completed event', () => {
    const before = { assignee_id: null, completed: true };
    const after  = { id: 5, assignee_id: null, completed: false };
    expect(itemActivityEvents(before, after, actorId)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // both assignee change and newly completed in one update
  // -------------------------------------------------------------------------

  test('assignee newly set AND newly completed → [assigned, completed] in that order', () => {
    const before = { assignee_id: null, completed: false };
    const after  = { id: 6, assignee_id: 10, completed: true };
    const events = itemActivityEvents(before, after, actorId);
    expect(events).toHaveLength(2);
    expect(events[0].verb).toBe('assigned');
    expect(events[1].verb).toBe('completed');
  });

  // -------------------------------------------------------------------------
  // string/number coercion edge cases (pg returns numbers; body may send strings)
  // -------------------------------------------------------------------------

  test('assignee_id string "5" vs number 5 treated as same → no event', () => {
    const before = { assignee_id: 5, completed: false };
    const after  = { id: 7, assignee_id: '5', completed: false };
    // After normalisation, '5' == 5, so no change
    expect(itemActivityEvents(before, after, actorId)).toHaveLength(0);
  });

  test('assignee_id null vs undefined treated as no assignee → no event when both absent', () => {
    const before = { assignee_id: null, completed: false };
    const after  = { id: 8, assignee_id: undefined, completed: false };
    // Both normalise to null → no change
    expect(itemActivityEvents(before, after, actorId)).toHaveLength(0);
  });
});
