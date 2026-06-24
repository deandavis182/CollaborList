import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: '/api',
})

// Client-generated CSRF token (double-submit pattern). The backend's CSRF
// middleware rejects every authenticated non-GET request that lacks a non-empty
// X-CSRF-Token header with 403; it accepts any non-empty value. Generated once
// per app load (mirrors the legacy app's approach).
export const CSRF_TOKEN = Math.random().toString(36).slice(2)

// Attach JWT from localStorage + CSRF token on every request.
apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {}
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  // Required by the backend CSRF middleware for non-GET; harmless on GET.
  config.headers['X-CSRF-Token'] = CSRF_TOKEN
  return config
})

// ---------------------------------------------------------------------------
// Workspace hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all workspaces the current user belongs to.
 * Each workspace includes a `role` field.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await apiClient.get('/workspaces')
      return data
    },
  })
}

/**
 * Create a new workspace with optimistic update.
 *
 * onMutate:   cancel in-flight queries, snapshot state, append a temp entry.
 * onError:    roll back to the snapshot.
 * onSettled:  always invalidate so the real server data takes over.
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name }) => {
      const { data } = await apiClient.post('/workspaces', { name })
      return data
    },

    onMutate: async ({ name }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['workspaces'] })

      // Snapshot previous value for rollback
      const previousWorkspaces = queryClient.getQueryData(['workspaces'])

      // Optimistically append a temp workspace
      const tempWorkspace = {
        id: `temp-${Date.now()}`,
        name,
        role: 'owner',
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData(['workspaces'], (old) => {
        const list = old ?? []
        return [...list, tempWorkspace]
      })

      return { previousWorkspaces }
    },

    onError: (_err, _variables, context) => {
      // Roll back to the snapshot
      if (context?.previousWorkspaces !== undefined) {
        queryClient.setQueryData(['workspaces'], context.previousWorkspaces)
      }
    },

    onSettled: () => {
      // Always reconcile with server
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Project hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all projects in a workspace.
 * Only enabled when workspaceId is truthy.
 */
export function useProjects(workspaceId) {
  return useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/workspaces/${workspaceId}/projects`)
      return data
    },
    enabled: Boolean(workspaceId),
  })
}

/**
 * Update an existing project.
 * mutationFn receives { id, ...fields } where fields may include
 * name, color, wedding_date, archived, position.
 * onSuccess invalidates ['projects', workspaceId].
 */
export function useUpdateProject(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { data } = await apiClient.put(`/projects/${id}`, fields)
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] })
    },
  })
}

/**
 * Delete a project by id.
 * mutationFn receives the project id.
 * onSuccess invalidates ['projects', workspaceId].
 */
export function useDeleteProject(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/projects/${id}`)
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] })
    },
  })
}

/**
 * Fetch all lists belonging to a project.
 * Only enabled when projectId is truthy.
 */
export function useProjectLists(projectId) {
  return useQuery({
    queryKey: ['projectLists', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/lists`)
      return data
    },
    enabled: Boolean(projectId),
  })
}

// ---------------------------------------------------------------------------
// Workspace management hooks
// ---------------------------------------------------------------------------

/**
 * Rename an existing workspace.
 * mutationFn receives { id, name }.
 * onSuccess invalidates ['workspaces'].
 */
export function useRenameWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }) => {
      const { data } = await apiClient.put(`/workspaces/${id}`, { name })
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

/**
 * Delete a workspace by id.
 * mutationFn receives the workspace id.
 * onSuccess invalidates ['workspaces'].
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/workspaces/${id}`)
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Tag hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all tags in a workspace.
 * Only enabled when workspaceId is truthy.
 */
export function useTags(workspaceId) {
  return useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/workspaces/${workspaceId}/tags`)
      return data
    },
    enabled: Boolean(workspaceId),
  })
}

/**
 * Create a new tag in a workspace.
 * mutationFn receives { name, color? }.
 * onSuccess invalidates ['tags', workspaceId].
 */
export function useCreateTag(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, color }) => {
      const { data } = await apiClient.post(`/workspaces/${workspaceId}/tags`, {
        name,
        ...(color !== undefined && { color }),
      })
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] })
    },
  })
}

/**
 * Delete a tag by id from a workspace.
 * mutationFn receives the tagId.
 * onSuccess invalidates ['tags', workspaceId].
 */
export function useDeleteTag(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tagId) => {
      const { data } = await apiClient.delete(`/workspaces/${workspaceId}/tags/${tagId}`)
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] })
    },
  })
}

// ---------------------------------------------------------------------------
// Member hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all members in a workspace.
 * Only enabled when workspaceId is truthy.
 */
export function useWorkspaceMembers(workspaceId) {
  return useQuery({
    queryKey: ['members', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/workspaces/${workspaceId}/members`)
      return data
    },
    enabled: Boolean(workspaceId),
  })
}

/**
 * Add a member to a workspace.
 * mutationFn receives { email, role }.
 * Errors propagate so the UI can show the 404 "no such user" message.
 * onSuccess invalidates ['members', workspaceId].
 */
export function useAddMember(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, role }) => {
      const { data } = await apiClient.post(`/workspaces/${workspaceId}/members`, { email, role })
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] })
    },
  })
}

/**
 * Remove a member from a workspace.
 * mutationFn receives the userId.
 * onSuccess invalidates ['members', workspaceId].
 */
export function useRemoveMember(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId) => {
      const { data } = await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`)
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] })
    },
  })
}

// ---------------------------------------------------------------------------
// Item hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all items for a list.
 * Only enabled when listId is truthy.
 */
export function useListItems(listId) {
  return useQuery({
    queryKey: ['items', listId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lists/${listId}/items`)
      return data
    },
    enabled: Boolean(listId),
  })
}

/**
 * Create a new item in a list with optimistic update.
 * mutationFn receives { text, parent_id?, status?, assignee_id?, due_date? }.
 * Optimistic: appends a temp item to ['items', listId] cache.
 * Rollback on error; onSettled invalidates ['items', listId].
 */
export function useCreateItem(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ text, parent_id, status, assignee_id, due_date }) => {
      const { data } = await apiClient.post(`/lists/${listId}/items`, {
        text,
        ...(parent_id !== undefined && { parent_id }),
        ...(status !== undefined && { status }),
        ...(assignee_id !== undefined && { assignee_id }),
        ...(due_date !== undefined && { due_date }),
      })
      return data
    },

    onMutate: async ({ text, parent_id, status, assignee_id, due_date }) => {
      const queryKey = ['items', listId]

      await queryClient.cancelQueries({ queryKey })

      const previousItems = queryClient.getQueryData(queryKey)

      const tempItem = {
        id: `temp-${Date.now()}`,
        list_id: listId,
        text,
        completed: false,
        status: status ?? 'To do',
        ...(parent_id !== undefined && { parent_id }),
        ...(assignee_id !== undefined && { assignee_id }),
        ...(due_date !== undefined && { due_date }),
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData(queryKey, (old) => {
        const list = old ?? []
        return [...list, tempItem]
      })

      return { previousItems }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousItems !== undefined) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
    },
  })
}

/**
 * Update an existing item with optimistic update.
 * mutationFn receives { id, ...fields } where fields may include
 * text, completed, status, assignee_id, due_date, notes, position, parent_id.
 * Optimistic: merges fields into the matching cached item using String(id) coercion.
 * Rollback on error; onSettled invalidates ['items', listId].
 */
export function useUpdateItem(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { data } = await apiClient.put(`/items/${id}`, fields)
      return data
    },

    onMutate: async ({ id, ...fields }) => {
      const queryKey = ['items', listId]

      await queryClient.cancelQueries({ queryKey })

      const previousItems = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return old.map((item) =>
          String(item.id) === String(id) ? { ...item, ...fields } : item
        )
      })

      return { previousItems }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousItems !== undefined) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
    },
  })
}

/**
 * Delete an item with optimistic removal.
 * mutationFn receives the item id.
 * Optimistic: removes the item from ['items', listId] cache using String(id) coercion.
 * Rollback on error; onSettled invalidates ['items', listId].
 */
export function useDeleteItem(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/items/${id}`)
      return data
    },

    onMutate: async (id) => {
      const queryKey = ['items', listId]

      await queryClient.cancelQueries({ queryKey })

      const previousItems = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return old.filter((item) => String(item.id) !== String(id))
      })

      return { previousItems }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousItems !== undefined) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
    },
  })
}

// ---------------------------------------------------------------------------
// Comment hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all comments for an item.
 * Only enabled when itemId is truthy.
 */
export function useItemComments(itemId) {
  return useQuery({
    queryKey: ['comments', itemId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/items/${itemId}/comments`)
      return data
    },
    enabled: Boolean(itemId),
  })
}

/**
 * Create a comment on an item.
 * mutationFn receives { body }.
 * onSettled invalidates ['comments', itemId].
 */
export function useCreateComment(itemId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ body }) => {
      const { data } = await apiClient.post(`/items/${itemId}/comments`, { body })
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', itemId] })
    },
  })
}

/**
 * Delete a comment by id.
 * mutationFn receives the commentId.
 * onSettled invalidates ['comments', itemId].
 */
export function useDeleteComment(itemId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (commentId) => {
      const { data } = await apiClient.delete(`/comments/${commentId}`)
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', itemId] })
    },
  })
}

// ---------------------------------------------------------------------------
// Item tag hooks
// ---------------------------------------------------------------------------

/**
 * Add a tag to an item.
 * mutationFn receives { itemId, tag_id }.
 * onSettled invalidates ['items', listId] so the item's tags refresh.
 */
export function useAddItemTag(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, tag_id }) => {
      const { data } = await apiClient.post(`/items/${String(itemId)}/tags`, { tag_id })
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
    },
  })
}

/**
 * Remove a tag from an item.
 * mutationFn receives { itemId, tagId }.
 * onSettled invalidates ['items', listId] so the item's tags refresh.
 */
export function useRemoveItemTag(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, tagId }) => {
      const { data } = await apiClient.delete(`/items/${String(itemId)}/tags/${String(tagId)}`)
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
    },
  })
}

// ---------------------------------------------------------------------------
// Lists hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all lists accessible to the current user (owned + shared).
 * Each list includes project_name, workspace_id, total_items, completed_items,
 * is_owner, and user_permission — enriched by the GET /api/lists endpoint.
 */
export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lists')
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// My Tasks hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all items assigned to the current user across all accessible lists.
 * Always fetches when mounted — no enabled guard.
 */
export function useMyTasks() {
  return useQuery({
    queryKey: ['myTasks'],
    queryFn: async () => {
      const { data } = await apiClient.get('/me/tasks')
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Activity hooks
// ---------------------------------------------------------------------------

/**
 * Fetch workspace activity feed.
 * Returns { items, unread } shape from the API.
 * Only enabled when workspaceId is truthy.
 */
export function useWorkspaceActivity(workspaceId) {
  return useQuery({
    queryKey: ['activity', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/activity/workspace/${workspaceId}`)
      return data
    },
    enabled: Boolean(workspaceId),
  })
}

/**
 * Mark all activity in a workspace as read.
 * mutationFn takes no args.
 * onSuccess invalidates ['activity', workspaceId].
 */
export function useMarkActivityRead(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/activity/workspace/${workspaceId}/read`)
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', workspaceId] })
    },
  })
}

// ---------------------------------------------------------------------------
// List management hooks
// ---------------------------------------------------------------------------

/**
 * Create a new list in a project with optimistic update.
 * mutationFn receives { name }.
 * Optimistic: appends a temp list to ['projectLists', projectId].
 * Rollback on error; onSettled invalidates ['projectLists', projectId].
 */
export function useCreateList(projectId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name }) => {
      const { data } = await apiClient.post('/lists', { name, project_id: projectId })
      return data
    },

    onMutate: async ({ name }) => {
      const queryKey = ['projectLists', projectId]

      await queryClient.cancelQueries({ queryKey })

      const previousLists = queryClient.getQueryData(queryKey)

      const tempList = {
        id: `temp-${Date.now()}`,
        name,
        project_id: projectId,
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData(queryKey, (old) => {
        const list = old ?? []
        return [...list, tempList]
      })

      return { previousLists }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousLists !== undefined) {
        queryClient.setQueryData(['projectLists', projectId], context.previousLists)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
      // Also refresh the flat all-lists query used by the mobile Lists tab + quick-add.
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

/**
 * Rename an existing list.
 * mutationFn receives { id, name }.
 * onSuccess/onSettled invalidates ['projectLists', projectId].
 */
export function useRenameList(projectId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }) => {
      const { data } = await apiClient.put(`/lists/${id}`, { name })
      return data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
      // Also refresh the flat all-lists query used by the mobile Lists tab + quick-add.
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

/**
 * Delete a list by id with optimistic removal.
 * mutationFn receives the list id.
 * Optimistic: removes the list from ['projectLists', projectId] cache using String(id) coercion.
 * Rollback on error; onSettled invalidates ['projectLists', projectId].
 */
export function useDeleteList(projectId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/lists/${id}`)
      return data
    },

    onMutate: async (id) => {
      const queryKey = ['projectLists', projectId]

      await queryClient.cancelQueries({ queryKey })

      const previousLists = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return old.filter((list) => String(list.id) !== String(id))
      })

      return { previousLists }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousLists !== undefined) {
        queryClient.setQueryData(['projectLists', projectId], context.previousLists)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projectLists', projectId] })
      // Also refresh the flat all-lists query used by the mobile Lists tab + quick-add.
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Cross-scope item hooks
// ---------------------------------------------------------------------------

/**
 * Update any item regardless of which list it belongs to.
 * mutationFn receives { id, list_id, ...changes }.
 * onSettled invalidates:
 *   - ['items', list_id] when list_id is present
 *   - ['projectItems'] (broad — all project roll-ups)
 *   - ['myTasks']
 */
export function useUpdateAnyItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, list_id: _list_id, ...changes }) => {
      const { data } = await apiClient.put(`/items/${id}`, changes)
      return data
    },

    onSettled: (_data, _err, variables) => {
      const { list_id } = variables ?? {}
      if (list_id != null) {
        queryClient.invalidateQueries({ queryKey: ['items', list_id] })
      }
      queryClient.invalidateQueries({ queryKey: ['projectItems'] })
      queryClient.invalidateQueries({ queryKey: ['myTasks'] })
    },
  })
}

/**
 * Fetch all items that belong to a project (roll-up across all its lists).
 * Only enabled when projectId is truthy.
 * Key: ['projectItems', projectId]
 */
export function useProjectItems(projectId) {
  return useQuery({
    queryKey: ['projectItems', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/items`)
      return data
    },
    enabled: Boolean(projectId),
  })
}

// ---------------------------------------------------------------------------
// Field definition hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all field definitions for a list.
 * Only enabled when listId is truthy.
 * Key: ['fieldDefs', listId]
 */
export function useFieldDefs(listId) {
  return useQuery({
    queryKey: ['fieldDefs', listId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lists/${String(listId)}/field-defs`)
      return data
    },
    enabled: Boolean(listId),
  })
}

/**
 * Create a new field definition in a list.
 * mutationFn receives { key, type, label, config, position }.
 * onSettled invalidates ['fieldDefs', listId].
 */
export function useCreateFieldDef(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ key, type, label, config, position }) => {
      const { data } = await apiClient.post(`/lists/${String(listId)}/field-defs`, {
        key,
        type,
        label,
        config,
        position,
      })
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefs', listId] })
    },
  })
}

/**
 * Update an existing field definition.
 * mutationFn receives { id, ...fields }.
 * onSettled invalidates ['fieldDefs', listId].
 */
export function useUpdateFieldDef(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { data } = await apiClient.put(`/field-defs/${String(id)}`, fields)
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefs', listId] })
    },
  })
}

/**
 * Delete a field definition by id.
 * mutationFn receives the field def id.
 * onSettled invalidates ['fieldDefs', listId].
 */
export function useDeleteFieldDef(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/field-defs/${String(id)}`)
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefs', listId] })
    },
  })
}

/**
 * Apply a field preset to a list.
 * mutationFn receives the preset name string.
 * onSettled invalidates ['fieldDefs', listId].
 */
export function useApplyFieldPreset(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (preset) => {
      const { data } = await apiClient.post(`/lists/${String(listId)}/field-presets`, { preset })
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefs', listId] })
    },
  })
}

/**
 * Set a field value on an item.
 * mutationFn receives { itemId, key, type, value }.
 * onSettled invalidates ['items', listId] AND ['projectItems'] since field
 * values live on the item payload.
 */
export function useSetItemField(listId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, key, type, value }) => {
      const { data } = await apiClient.put(`/items/${String(itemId)}/fields`, { key, type, value })
      return data
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['projectItems'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Attachment hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all attachments for an item.
 * Only enabled when itemId is truthy.
 * Key: ['attachments', itemId]
 */
export function useAttachments(itemId) {
  return useQuery({
    queryKey: ['attachments', itemId],
    queryFn: async () => (await apiClient.get(`/items/${itemId}/attachments`)).data,
    enabled: Boolean(itemId),
  })
}

/**
 * Upload a file attachment to an item.
 * mutationFn receives a File object.
 * Builds FormData and POSTs to /items/:itemId/attachments.
 * Do NOT set Content-Type — axios sets the multipart boundary automatically.
 * onSettled invalidates ['attachments', itemId].
 */
export function useUploadAttachment(itemId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/items/${itemId}/attachments`, fd)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['attachments', itemId] }),
  })
}

/**
 * Delete an attachment by id.
 * mutationFn receives the attachmentId.
 * onSettled invalidates ['attachments', itemId].
 */
export function useDeleteAttachment(itemId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId) => apiClient.delete(`/attachments/${attachmentId}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['attachments', itemId] }),
  })
}

// ---------------------------------------------------------------------------
// Push notification hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the VAPID public key for push subscription.
 * Key: ['vapidKey']; staleTime Infinity (key never changes at runtime).
 */
export function useVapidKey() {
  return useQuery({
    queryKey: ['vapidKey'],
    queryFn: async () => (await apiClient.get('/push/vapid-public-key')).data.publicKey,
    staleTime: Infinity,
  })
}

/**
 * Subscribe the current browser to push notifications.
 * mutationFn receives a PushSubscription-shaped object { endpoint, keys }.
 */
export function usePushSubscribe() {
  return useMutation({
    mutationFn: (subscription) => apiClient.post('/push/subscribe', { subscription }),
  })
}

/**
 * Unsubscribe the current browser from push notifications.
 * mutationFn receives the subscription endpoint string.
 */
export function usePushUnsubscribe() {
  return useMutation({
    mutationFn: (endpoint) => apiClient.post('/push/unsubscribe', { endpoint }),
  })
}

/**
 * Fetch the current user's notification preferences.
 * Key: ['notificationPrefs'].
 */
export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notificationPrefs'],
    queryFn: async () => (await apiClient.get('/notification-prefs')).data,
  })
}

/**
 * Update the current user's notification preferences.
 * mutationFn receives a partial prefs object.
 * onSuccess: writes the returned data directly into the ['notificationPrefs'] cache.
 */
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial) => apiClient.put('/notification-prefs', partial).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['notificationPrefs'], data),
  })
}

// ---------------------------------------------------------------------------
// Project hooks (continued)
// ---------------------------------------------------------------------------

/**
 * Create a new project in a workspace with optimistic update.
 */
export function useCreateProject(workspaceId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, color, wedding_date }) => {
      const { data } = await apiClient.post(`/workspaces/${workspaceId}/projects`, {
        name,
        ...(color !== undefined && { color }),
        ...(wedding_date !== undefined && { wedding_date }),
      })
      return data
    },

    onMutate: async ({ name, color, wedding_date }) => {
      const queryKey = ['projects', workspaceId]

      await queryClient.cancelQueries({ queryKey })

      const previousProjects = queryClient.getQueryData(queryKey)

      const tempProject = {
        id: `temp-${Date.now()}`,
        workspace_id: workspaceId,
        name,
        color: color ?? null,
        wedding_date: wedding_date ?? null,
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData(queryKey, (old) => {
        const list = old ?? []
        return [...list, tempProject]
      })

      return { previousProjects }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousProjects !== undefined) {
        queryClient.setQueryData(['projects', workspaceId], context.previousProjects)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] })
    },
  })
}
