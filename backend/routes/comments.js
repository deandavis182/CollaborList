// backend/routes/comments.js
'use strict';

const express = require('express');
const pool = require('../db/pool');
const { getItemAccess } = require('../services/itemAccess');
const commentService = require('../services/commentService');
const activityService = require('../services/activityService');
const workspaceService = require('../services/workspaceService');
const events = require('../realtime/events');

/**
 * Factory matching the router style in routes/projects.js / routes/workspaces.js.
 *
 * @param {Function} authenticateToken - Express middleware that populates req.user
 * @param {Function} sanitize          - Input sanitizer (returns string)
 * @param {{ list: Function, workspace: Function }} emit
 *   emit.list(listId, eventName, payload)
 *   emit.workspace(workspaceId, eventName, payload)
 */
module.exports = (authenticateToken, sanitize, emit) => {
  const router = express.Router();
  router.use(authenticateToken);

  // GET /api/items/:id/comments
  router.get('/items/:id/comments', async (req, res) => {
    try {
      const access = await getItemAccess(pool, req.params.id, req.user.id);
      if (!access.found)    return res.status(404).json({ error: 'Item not found' });
      if (!access.canView)  return res.status(403).json({ error: 'Not authorized' });

      const comments = await commentService.list(pool, req.params.id);
      res.json(comments);
    } catch (e) {
      console.error('GET /items/:id/comments error:', e);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // POST /api/items/:id/comments
  router.post('/items/:id/comments', async (req, res) => {
    try {
      const access = await getItemAccess(pool, req.params.id, req.user.id);
      if (!access.found)    return res.status(404).json({ error: 'Item not found' });
      if (!access.canEdit)  return res.status(403).json({ error: 'No edit permission' });

      const body = sanitize(req.body.body);
      if (!body) return res.status(400).json({ error: 'Comment body required' });

      const comment = await commentService.create(pool, {
        itemId: req.params.id,
        userId: req.user.id,
        body,
      });

      try {
        emit.list(access.listId, events.COMMENT_CREATED, {
          listId:  access.listId,
          itemId:  Number(req.params.id),
          comment,
        });
      } catch (emitErr) {
        console.error('emit.list COMMENT_CREATED failed (non-fatal):', emitErr);
      }

      // Activity + mention recording (best-effort — must not break the response)
      try {
        const { workspaceId, projectId } = await activityService.projectContextForList(pool, access.listId);

        if (workspaceId) {
          const row = await activityService.record(pool, {
            workspaceId,
            projectId,
            actorId: req.user.id,
            verb:    'commented',
            target:  { itemId: Number(req.params.id), commentId: comment.id },
            meta:    {},
          });
          emit.workspace(workspaceId, events.ACTIVITY_CREATED, row);

          // Fetch item text + assignee for push notifications
          const itemRow = await pool.query('SELECT text, assignee_id FROM list_items WHERE id = $1', [req.params.id]);
          const itemText = itemRow.rows[0] ? itemRow.rows[0].text : '';
          const assigneeId = itemRow.rows[0] ? itemRow.rows[0].assignee_id : null;

          // Resolve @mentions
          const handles = commentService.parseMentions(body);
          const mentionedUserIds = new Set();
          if (handles.length > 0) {
            const members = await workspaceService.listMembers(pool, workspaceId);
            for (const member of members) {
              // Skip self-mentions
              if (member.user_id === req.user.id) continue;

              const emailLocal = member.email.split('@')[0].toLowerCase();
              const fullEmail  = member.email.toLowerCase();

              if (handles.includes(emailLocal) || handles.includes(fullEmail)) {
                const mentionRow = await activityService.record(pool, {
                  workspaceId,
                  projectId,
                  actorId: req.user.id,
                  verb:    'mentioned',
                  target:  { itemId: Number(req.params.id), commentId: comment.id },
                  meta:    { mentionedUserId: member.user_id },
                });
                emit.workspace(workspaceId, events.ACTIVITY_CREATED, mentionRow);
                mentionedUserIds.add(member.user_id);

                try {
                  const notificationService = require('../services/notificationService');
                  await notificationService.notifyMention(pool, {
                    mentionedUserId: member.user_id,
                    actorId: req.user.id,
                    item: { id: Number(req.params.id), text: itemText },
                    projectId, listId: access.listId, workspaceId,
                    commentId: comment.id,
                  });
                } catch (e) { console.error('Mention push failed (non-fatal):', e); }
              }
            }
          }

          // Notify item assignee as a watcher (skip if actor or already mentioned)
          try {
            const notificationService = require('../services/notificationService');
            await notificationService.notifyComment(pool, {
              watcherIds: assigneeId ? [assigneeId] : [],
              actorId: req.user.id,
              item: { id: Number(req.params.id), text: itemText },
              projectId, listId: access.listId, workspaceId,
              commentId: comment.id,
            });
          } catch (e) { console.error('Comment push failed (non-fatal):', e); }
        }
      } catch (actErr) {
        console.error('Activity/mention recording failed (non-fatal):', actErr);
      }

      res.status(201).json(comment);
    } catch (e) {
      console.error('POST /items/:id/comments error:', e);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  // DELETE /api/comments/:id
  router.delete('/comments/:id', async (req, res) => {
    try {
      const owner = await commentService.getOwnerAndItem(pool, req.params.id);
      if (!owner) return res.status(404).json({ error: 'Comment not found' });

      const access = await getItemAccess(pool, owner.item_id, req.user.id);

      const isAuthor   = req.user.id === owner.user_id;
      const isListOwner = access.isOwner;

      if (!isAuthor && !isListOwner) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await commentService.remove(pool, req.params.id);

      if (access.listId) {
        emit.list(access.listId, events.COMMENT_DELETED, {
          listId:    access.listId,
          itemId:    owner.item_id,
          commentId: Number(req.params.id),
        });
      }

      res.json({ success: true });
    } catch (e) {
      console.error('DELETE /comments/:id error:', e);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  return router;
};
