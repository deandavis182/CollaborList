import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: '/api',
})

// Attach JWT from localStorage on every request when present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
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
