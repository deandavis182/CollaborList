/**
 * Frontend mirror of backend/realtime/events.js.
 * Never hard-code socket event strings — always use this catalog.
 */
export const EVENTS = Object.freeze({
  COMMENT_CREATED: 'comment-created',
  COMMENT_DELETED: 'comment-deleted',
  ACTIVITY_CREATED: 'activity-created',
  PRESENCE_UPDATE: 'presence-update',
  TYPING: 'typing',
  ITEM_CREATED: 'item-created',
  ITEM_UPDATED: 'item-updated',
  ITEM_DELETED: 'item-deleted',
  FIELD_UPDATED: 'field-updated',
})
