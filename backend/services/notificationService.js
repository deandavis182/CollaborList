'use strict';
const pushService = require('./pushService');
const prefsService = require('./prefsService');

function deepLink({ workspaceId, projectId, listId, itemId }) {
  if (workspaceId && projectId && listId) {
    const q = itemId ? `?item=${itemId}` : '';
    return `/w/${workspaceId}/p/${projectId}/l/${listId}${q}`;
  }
  return '/';
}

function inQuietHours(quietHours, now) {
  if (!quietHours) return false;
  const { start, end } = quietHours;
  const h = now.getHours();
  if (start === end) return false;
  if (start < end) return h >= start && h < end;     // non-wrapping
  return h >= start || h < end;                      // wraps midnight
}

function isAllowed(prefs, category, projectId, now) {
  if (!prefs[category]) return false;
  if (projectId != null && Array.isArray(prefs.muteProjects) && prefs.muteProjects.includes(Number(projectId))) return false;
  if (inQuietHours(prefs.quietHours, now)) return false;
  return true;
}

async function gateAndSend(pool, { recipientId, category, projectId, payload, now = new Date() }) {
  if (recipientId == null) return;
  const prefs = await prefsService.getPrefs(pool, recipientId);
  if (!isAllowed(prefs, category, projectId, now)) return;
  await pushService.sendToUser(pool, recipientId, payload);
}

async function notifyAssignment(pool, { assigneeId, actorId, item, projectId, listId, workspaceId }) {
  if (assigneeId == null || assigneeId === actorId) return;
  await gateAndSend(pool, {
    recipientId: assigneeId, category: 'assignments', projectId,
    payload: {
      title: 'You were assigned an item',
      body: item.text,
      url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
      tag: `assign-${item.id}`,
    },
  });
}

async function notifyMention(pool, { mentionedUserId, actorId, item, projectId, listId, workspaceId, commentId }) {
  if (mentionedUserId == null || mentionedUserId === actorId) return;
  await gateAndSend(pool, {
    recipientId: mentionedUserId, category: 'mentions', projectId,
    payload: {
      title: 'You were mentioned',
      body: item.text,
      url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
      tag: `mention-${commentId}`,
    },
  });
}

async function notifyComment(pool, { watcherIds = [], actorId, item, projectId, listId, workspaceId, commentId }) {
  for (const wid of watcherIds) {
    if (wid === actorId) continue;
    await gateAndSend(pool, {
      recipientId: wid, category: 'comments', projectId,
      payload: {
        title: 'New comment',
        body: item.text,
        url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
        tag: `comment-${commentId}`,
      },
    });
  }
}

async function notifyDueReminder(pool, { assigneeId, item, projectId, listId, workspaceId, kind }) {
  const prefix = kind === 'overdue' ? 'Overdue' : kind === 'soon' ? 'Due soon' : 'Due today';
  await gateAndSend(pool, {
    recipientId: assigneeId, category: 'reminders', projectId,
    payload: {
      title: `${prefix}: ${item.text}`,
      body: item.text,
      url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
      tag: `reminder-${item.id}`,
    },
  });
}

module.exports = { deepLink, inQuietHours, isAllowed, notifyAssignment, notifyMention, notifyComment, notifyDueReminder };
