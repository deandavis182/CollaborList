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
  // Theme
  // ---------------------------------------------------------------------------
  theme: 'light',

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}))
