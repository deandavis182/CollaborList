import { create } from 'zustand'

/**
 * Zustand store for EPHEMERAL UI and real-time state.
 * Server data lives in React Query; this store holds only UI-driven state.
 */

function initialTheme() {
  if (typeof localStorage !== 'undefined') {
    const t = localStorage.getItem('theme')
    if (t === 'light' || t === 'dark') return t
  }
  return 'light'
}

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
  detailContext: null,

  openDetail: (id) => set({ detailItemId: id }),
  openItem: (id, ctx = null) => set({ detailItemId: id, detailContext: ctx }),
  closeDetail: () => set({ detailItemId: null, detailContext: null }),

  // ---------------------------------------------------------------------------
  // Search (Lists screen, mobile)
  // ---------------------------------------------------------------------------
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // ---------------------------------------------------------------------------
  // Quick-add sheet (mobile FAB)
  // ---------------------------------------------------------------------------
  quickAddOpen: false,
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),

  // ---------------------------------------------------------------------------
  // Global toast — store-backed so a mounted host (AppLayout mobile branch)
  // can render it even after the originating component unmounts.
  // ---------------------------------------------------------------------------
  toast: null,
  showToast: (message, variant = 'success') => set({ toast: { message, variant } }),
  dismissToast: () => set({ toast: null }),

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
  socketConnected: false,

  setSocket: (socket) => set({ socket }),
  setSocketConnected: (v) => set({ socketConnected: v }),

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  theme: initialTheme(),

  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light'
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme)
      return { theme }
    }),
}))
