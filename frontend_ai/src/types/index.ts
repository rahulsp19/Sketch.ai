export type ViewMode = '2D' | '3D' | 'CODE'

export interface GridCell {
  x: number
  y: number
  type: 'road' | 'residential' | 'commercial' | 'park' | 'industrial' | 'water' | 'empty'
  label?: string
}

export interface HistoryItem {
  id: string
  prompt: string
  timestamp: number
  layoutData: GridCell[][] | null
}
