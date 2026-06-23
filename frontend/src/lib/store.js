import { create } from 'zustand'

/**
 * Zustand store for EPHEMERAL UI and real-time state.
 * Server data lives in React Query; this store holds only UI-driven state.
 */
export const useStore = create((set) => ({
  // ---------------------------------------------------------------------------
  // Navigation / selection
  // ---------------------------------------------------------------------------
  currentWorkspaceId: null,
  currentProjectId: null,

  setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),
  setCurrentProject: (id) => set({ currentProjectId: id }),

  // ---------------------------------------------------------------------------
  // Detail sheet — which item's detail panel is open
  // ---------------------------------------------------------------------------
  detailItemId: null,

  openDetail: (id) => set({ detailItemId: id }),
  closeDetail: () => set({ detailItemId: null }),

  // ---------------------------------------------------------------------------
  // Presence — populated by Phase 3 socket handlers
  // { [userId]: { name, color, cursor, ... } }
  // ---------------------------------------------------------------------------
  presence: {},

  setPresence: (map) => set({ presence: map }),

  // ---------------------------------------------------------------------------
  // Typing — { [listId]: { [userId]: email } }
  // ---------------------------------------------------------------------------
  typing: {},

  setTyping: ({ listId, userId, email, isTyping }) =>
    set((state) => {
      const prev = state.typing
      if (isTyping) {
        return {
          typing: {
            ...prev,
            [listId]: {
              ...(prev[listId] ?? {}),
              [userId]: email,
            },
          },
        }
      }
      // isTyping === false: remove the userId entry
      const listMap = prev[listId]
      if (!listMap || !(userId in listMap)) {
        // Nothing to remove
        return {}
      }
      const { [userId]: _removed, ...restList } = listMap
      if (Object.keys(restList).length === 0) {
        // Drop the listId key entirely when empty
        const { [listId]: _dropped, ...restTyping } = prev
        return { typing: restTyping }
      }
      return {
        typing: {
          ...prev,
          [listId]: restList,
        },
      }
    }),

  // ---------------------------------------------------------------------------
  // Socket — the active socket.io instance; set by providers.jsx
  // ---------------------------------------------------------------------------
  socket: null,

  setSocket: (socket) => set({ socket }),

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  theme: 'light',

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}))
