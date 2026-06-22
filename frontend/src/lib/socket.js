import { io } from 'socket.io-client'

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
    // payload: { workspaceId?, list } — invalidate broadly so any mounted
    // useProjects hook refetches.
    if (payload?.workspaceId) {
      queryClient.invalidateQueries({ queryKey: ['projects', payload.workspaceId] })
    } else {
      // Broadcast to all project queries when workspace context is unknown
      queryClient.invalidateQueries({ queryKey: ['projects'] })
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
  }
}
