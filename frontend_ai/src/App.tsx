import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Sidebar, SidebarExpandBtn } from './components/Sidebar'
import { WorkspaceHeader } from './components/WorkspaceHeader'
import { Canvas } from './components/Canvas'
import { ChatInput } from './components/ChatInput'
import { CellDetail } from './components/CellDetail'
import { Toasts } from './components/Toast'
import './index.css'

export default function App() {
  const setViewMode = useStore((s) => s.setViewMode)
  const newSession = useStore((s) => s.newSession)
  const setSelectedCell = useStore((s) => s.setSelectedCell)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const fetchHistory = useStore((s) => s.fetchHistory)

  // Initial load
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle when typing in input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === '1') setViewMode('2D')
      if (e.key === '2') setViewMode('3D')
      if (e.key === '3') setViewMode('CODE')
      if (e.key === 'Escape') setSelectedCell(null)

      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        newSession()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setViewMode, newSession, setSelectedCell, toggleSidebar])

  return (
    <div className="app">
      <Sidebar />
      <SidebarExpandBtn />
      <main className="workspace">
        <WorkspaceHeader />
        <div className="workspace-body">
          <Canvas />
          <CellDetail />
        </div>
        <ChatInput />
      </main>
      <Toasts />
    </div>
  )
}
