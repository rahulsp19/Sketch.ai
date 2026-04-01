import { create } from 'zustand'
import type { ViewMode, GridCell, HistoryItem } from '../types'

interface Toast {
  id: string
  message: string
  type: 'success' | 'info'
}

interface AppState {
  // Prompt
  prompt: string
  setPrompt: (p: string) => void

  // Layout
  layoutData: GridCell[][] | null
  setLayoutData: (data: GridCell[][] | null) => void

  // Selection
  selectedCell: GridCell | null
  setSelectedCell: (cell: GridCell | null) => void
  hoveredCell: GridCell | null
  setHoveredCell: (cell: GridCell | null) => void

  // View
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Detail panel
  detailOpen: boolean
  setDetailOpen: (open: boolean) => void

  // Loading
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // History
  history: HistoryItem[]
  activeHistoryId: string | null
  addHistory: (item: HistoryItem) => void
  setActiveHistoryId: (id: string | null) => void
  loadHistory: (id: string) => void
  clearHistory: () => void
  deleteHistoryItem: (id: string) => void

  // Toast
  toasts: Toast[]
  addToast: (message: string, type?: 'success' | 'info') => void
  removeToast: (id: string) => void

  // Cell editing
  updateCellType: (x: number, y: number, type: GridCell['type']) => void

  // Actions
  submitPrompt: () => Promise<void>
  newSession: () => void
  fetchHistory: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  prompt: '',
  setPrompt: (p) => set({ prompt: p }),

  layoutData: null,
  setLayoutData: (data) => set({ layoutData: data }),

  selectedCell: null,
  setSelectedCell: (cell) => set({ selectedCell: cell, detailOpen: !!cell }),
  hoveredCell: null,
  setHoveredCell: (cell) => set({ hoveredCell: cell }),

  viewMode: '2D',
  setViewMode: (mode) => set({ viewMode: mode }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  detailOpen: false,
  setDetailOpen: (open) => set({ detailOpen: open, selectedCell: open ? get().selectedCell : null }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  history: [],
  activeHistoryId: null,
  addHistory: (item) =>
    set((state) => ({ history: [item, ...state.history] })),
  setActiveHistoryId: (id) => set({ activeHistoryId: id }),
  loadHistory: (id) => {
    const item = get().history.find((h) => h.id === id)
    if (item) {
      set({
        activeHistoryId: id,
        layoutData: item.layoutData,
        selectedCell: null,
        detailOpen: false,
        prompt: '',
      })
    }
  },
  clearHistory: () => {
    set({ history: [], activeHistoryId: null, layoutData: null, selectedCell: null, detailOpen: false })
    get().addToast('History cleared')
  },
  deleteHistoryItem: async (id) => {
    try {
      await fetch(`http://localhost:3001/api/history/${id}`, { method: 'DELETE' })
      const { history, activeHistoryId } = get()
      const filtered = history.filter((h) => h.id !== id)
      const updates: Partial<AppState> = { history: filtered }
      if (activeHistoryId === id) {
        updates.activeHistoryId = null
        updates.layoutData = null
        updates.selectedCell = null
        updates.detailOpen = false
      }
      set(updates as AppState)
    } catch (error) {
      console.error('Failed to delete history item', error)
      get().addToast('Draft deletion failed', 'info')
    }
  },

  toasts: [],
  addToast: (message, type = 'success') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 3000)
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  updateCellType: (x, y, type) => {
    const { layoutData, activeHistoryId, history } = get()
    if (!layoutData) return
    const newData = layoutData.map((row) =>
      row.map((cell) => (cell.x === x && cell.y === y ? { ...cell, type } : cell))
    )
    // Update history too
    const newHistory = history.map((h) =>
      h.id === activeHistoryId ? { ...h, layoutData: newData } : h
    )
    set({ layoutData: newData, history: newHistory, selectedCell: { x, y, type } })
  },

  submitPrompt: async () => {
    const { prompt, setIsLoading, addHistory, setActiveHistoryId, setLayoutData, addToast } = get()
    if (!prompt.trim()) return

    setIsLoading(true)

    try {
      const res = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        throw new Error('Failed to generate from API')
      }

      const data = await res.json()

      setLayoutData(data.layoutData)
      addHistory(data)
      setActiveHistoryId(data.id)
      set({ prompt: '', isLoading: false, selectedCell: null, detailOpen: false })
      addToast('Layout generated')
    } catch (error) {
      console.error('Generation failed:', error)
      set({ isLoading: false })
      addToast('AI Generation Failed. Try again.', 'info')
    }
  },

  newSession: () => {
    set({
      layoutData: null,
      activeHistoryId: null,
      selectedCell: null,
      detailOpen: false,
      prompt: '',
      viewMode: '2D',
    })
  },

  fetchHistory: async () => {
    try {
      const res = await fetch('http://localhost:3001/api/history')
      if (res.ok) {
        const history = await res.json()
        set({ history })
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  },
}))
