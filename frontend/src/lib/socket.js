import { io } from 'socket.io-client'
import { EVENTS } from './events.js'
import { useStore } from './store.js'

/**
 * Create and return a socket.io connection authenticated with the given JWT.
 * Uses the default URL (same origin) so the nginx proxy handles /socket.io.
 *
 * No side effects at import time — call this explicitly when the app mounts.
 *
 * @param {string} token  JWT from localStorage
 * @returns {import('socket.io-client').Socket}
 */
export function createSocket(token) {
  return io({ auth: { token } })
}

/**
 * Register event handlers that patch the React Query cache when the server
 * emits real-time events.  Invalidation is the default strategy; where a
 * simple, correct setQueryData patch is possible it is used instead.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {() => void}  Cleanup function that removes all registered listeners
 */
export function registerSocketHandlers(socket, queryClient) {
  // ------------------------------------------------------------------
  // Workspace-level events — invalidate the workspaces list so it
  // refetches with the latest membership/metadata.
  // ------------------------------------------------------------------

  const onWorkspaceUpdated = (_payload) => {
    queryClient.invalidateQueries({ queryKey: ['workspaces'] })
  }

  const onMemberAdded = (_payload) => {
    queryClient.invalidateQueries({ queryKey: ['workspaces'] })
  }

  const onMemberRemoved = (_payload) => {
    queryClient.invalidateQueries({ queryKey: ['workspaces'] })
  }

  // ------------------------------------------------------------------
  // List events — a list belongs to a project; invalidate the projects
  // query for the affected workspace so the project's list count etc.
  // stays accurate.  We also keep a `['lists', listId]` key pattern for
  // Phase 3 which will introduce per-list queries.
  // ------------------------------------------------------------------

  const onListCreated = (payload) => {
    // payload: { workspaceId?, list } or the list row itself — invalidate broadly so any mounted
    // useProjects hook refetches.
    if (payload?.workspaceId) {
      queryClient.invalidateQueries({ queryKey: ['projects', payload.workspaceId] })
    } else {
      // Broadcast to all project queries when workspace context is unknown
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
    // Also invalidate the per-project lists cache so ProjectView stays in sync.
    // payload may be the list row directly (has project_id) or wrapped ({ list }).
    try {
      const projectId = payload?.project_id ?? payload?.list?.project_id
      if (projectId != null) {
        queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['projectLists'] })
      }
    } catch (_e) {
      // Guard against malformed payloads
    }
  }

  const onListUpdated = (payload) => {
    if (payload?.workspaceId) {
      queryClient.invalidateQueries({ queryKey: ['projects', payload.workspaceId] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
    // Also invalidate a targeted list key if callers cache individual lists
    if (payload?.list?.id) {
      queryClient.invalidateQueries({ queryKey: ['lists', payload.list.id] })
    }
    // Invalidate per-project lists cache.
    try {
      const projectId = payload?.project_id ?? payload?.list?.project_id
      if (projectId != null) {
        queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['projectLists'] })
      }
    } catch (_e) {
      // Guard against malformed payloads
    }
  }

  const onListDeleted = (payload) => {
    if (payload?.workspaceId) {
      queryClient.invalidateQueries({ queryKey: ['projects', payload.workspaceId] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
    if (payload?.id) {
      queryClient.invalidateQueries({ queryKey: ['lists', payload.id] })
    }
    // Invalidate per-project lists cache.
    // list-deleted payload may not carry project_id, so fall back to broad invalidation.
    try {
      const projectId = payload?.project_id ?? payload?.list?.project_id
      if (projectId != null) {
        queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['projectLists'] })
      }
    } catch (_e) {
      // Guard against malformed payloads
    }
  }

  // ------------------------------------------------------------------
  // Item events — invalidate the items cache for the affected list
  // ------------------------------------------------------------------

  const onItemCreated = (payload) => {
    if (payload?.listId == null) return
    queryClient.invalidateQueries({ queryKey: ['items', payload.listId] })
  }

  const onItemUpdated = (payload) => {
    if (payload?.listId == null) return
    queryClient.invalidateQueries({ queryKey: ['items', payload.listId] })
  }

  const onItemDeleted = (payload) => {
    if (payload?.listId == null) return
    queryClient.invalidateQueries({ queryKey: ['items', payload.listId] })
  }

  // ------------------------------------------------------------------
  // Comment events — invalidate comments for the affected item
  // ------------------------------------------------------------------

  const onCommentCreated = (payload) => {
    if (payload?.itemId == null) return
    queryClient.invalidateQueries({ queryKey: ['comments', payload.itemId] })
  }

  const onCommentDeleted = (payload) => {
    if (payload?.itemId == null) return
    queryClient.invalidateQueries({ queryKey: ['comments', payload.itemId] })
  }

  // ------------------------------------------------------------------
  // Activity events — invalidate workspace activity feed, and
  // additionally invalidate myTasks when the verb is 'assigned'.
  // ------------------------------------------------------------------

  const onActivityCreated = (payload) => {
    if (payload?.workspace_id == null) return
    queryClient.invalidateQueries({ queryKey: ['activity', payload.workspace_id] })
    if (payload.verb === 'assigned') {
      queryClient.invalidateQueries({ queryKey: ['myTasks'] })
    }
  }

  // ------------------------------------------------------------------
  // Presence events — convert array snapshot to map and update store
  // ------------------------------------------------------------------

  const onPresenceUpdate = (payload) => {
    if (!Array.isArray(payload)) return
    const map = Object.fromEntries(payload.map((entry) => [entry.userId, entry]))
    useStore.getState().setPresence(map)
  }

  // ------------------------------------------------------------------
  // Typing events — delegate to store's setTyping reducer
  // ------------------------------------------------------------------

  const onTyping = (payload) => {
    if (payload == null) return
    useStore.getState().setTyping({
      listId: payload.listId,
      userId: payload.userId,
      email: payload.email,
      isTyping: payload.isTyping,
    })
  }

  // ------------------------------------------------------------------
  // Register listeners
  // ------------------------------------------------------------------
  socket.on('workspace-updated', onWorkspaceUpdated)
  socket.on('member-added', onMemberAdded)
  socket.on('member-removed', onMemberRemoved)
  socket.on('list-created', onListCreated)
  socket.on('list-updated', onListUpdated)
  socket.on('list-deleted', onListDeleted)
  socket.on(EVENTS.ITEM_CREATED, onItemCreated)
  socket.on(EVENTS.ITEM_UPDATED, onItemUpdated)
  socket.on(EVENTS.ITEM_DELETED, onItemDeleted)
  socket.on(EVENTS.COMMENT_CREATED, onCommentCreated)
  socket.on(EVENTS.COMMENT_DELETED, onCommentDeleted)
  socket.on(EVENTS.ACTIVITY_CREATED, onActivityCreated)
  socket.on(EVENTS.PRESENCE_UPDATE, onPresenceUpdate)
  socket.on(EVENTS.TYPING, onTyping)

  // ------------------------------------------------------------------
  // Return cleanup — removes only the handlers this function added
  // ------------------------------------------------------------------
  return () => {
    socket.off('workspace-updated', onWorkspaceUpdated)
    socket.off('member-added', onMemberAdded)
    socket.off('member-removed', onMemberRemoved)
    socket.off('list-created', onListCreated)
    socket.off('list-updated', onListUpdated)
    socket.off('list-deleted', onListDeleted)
    socket.off(EVENTS.ITEM_CREATED, onItemCreated)
    socket.off(EVENTS.ITEM_UPDATED, onItemUpdated)
    socket.off(EVENTS.ITEM_DELETED, onItemDeleted)
    socket.off(EVENTS.COMMENT_CREATED, onCommentCreated)
    socket.off(EVENTS.COMMENT_DELETED, onCommentDeleted)
    socket.off(EVENTS.ACTIVITY_CREATED, onActivityCreated)
    socket.off(EVENTS.PRESENCE_UPDATE, onPresenceUpdate)
    socket.off(EVENTS.TYPING, onTyping)
  }
}
