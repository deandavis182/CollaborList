// backend/__tests__/events.test.js
'use strict';

const events = require('../realtime/events');

describe('realtime/events catalog', () => {
  test('exports all expected event name constants', () => {
    expect(events.COMMENT_CREATED).toBe('comment-created');
    expect(events.COMMENT_DELETED).toBe('comment-deleted');
    expect(events.ACTIVITY_CREATED).toBe('activity-created');
    expect(events.PRESENCE_UPDATE).toBe('presence-update');
    expect(events.TYPING).toBe('typing');
    expect(events.ITEM_CREATED).toBe('item-created');
    expect(events.ITEM_UPDATED).toBe('item-updated');
    expect(events.ITEM_DELETED).toBe('item-deleted');
  });

  test('object is frozen (immutable catalog)', () => {
    expect(Object.isFrozen(events)).toBe(true);
  });

  test('no extra unexpected keys are exported', () => {
    const keys = Object.keys(events);
    expect(keys).toHaveLength(8);
    expect(keys.sort()).toEqual([
      'ACTIVITY_CREATED',
      'COMMENT_CREATED',
      'COMMENT_DELETED',
      'ITEM_CREATED',
      'ITEM_DELETED',
      'ITEM_UPDATED',
      'PRESENCE_UPDATE',
      'TYPING',
    ]);
  });
});
