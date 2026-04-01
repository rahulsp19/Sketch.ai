import { useStore } from '../store/useStore'
import { Grid3X3, Box, Code, Maximize2, Copy, Download } from 'lucide-react'
import type { ViewMode } from '../types'

const viewOptions: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: '2D', label: '2D', icon: <Grid3X3 size={14} strokeWidth={1.5} /> },
  { id: '3D', label: '3D', icon: <Box size={14} strokeWidth={1.5} /> },
  { id: 'CODE', label: 'Code', icon: <Code size={14} strokeWidth={1.5} /> },
]

export function WorkspaceHeader() {
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const layoutData = useStore((s) => s.layoutData)
  const activeHistoryId = useStore((s) => s.activeHistoryId)
  const history = useStore((s) => s.history)
  const addToast = useStore((s) => s.addToast)

  const activeItem = history.find((h) => h.id === activeHistoryId)
  const title = activeItem
    ? activeItem.prompt.length > 50
      ? activeItem.prompt.slice(0, 50) + '…'
      : activeItem.prompt
    : 'CitySketch'

  const handleCopyJSON = () => {
    if (!layoutData) return
    navigator.clipboard.writeText(JSON.stringify(layoutData, null, 2))
    addToast('JSON copied to clipboard')
  }

  const handleExportJSON = () => {
    if (!layoutData) return
    const blob = new Blob([JSON.stringify(layoutData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citysketch-layout-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast('Layout exported as JSON')
  }

  return (
    <header className="workspace-header">
      <div className="workspace-title-area">
        <h1 className="workspace-title">{title}</h1>
      </div>

      <div className="workspace-controls">
        {/* View toggles */}
        <div className="view-toggle-group">
          {viewOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setViewMode(opt.id)}
              className={`view-toggle ${viewMode === opt.id ? 'active' : ''}`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Utility buttons */}
        {layoutData && (
          <div className="workspace-utils">
            <button className="util-btn" onClick={handleCopyJSON} title="Copy JSON">
              <Copy size={15} strokeWidth={1.5} />
            </button>
            <button className="util-btn" onClick={handleExportJSON} title="Export JSON">
              <Download size={15} strokeWidth={1.5} />
            </button>
            <button
              className="util-btn"
              title="Fullscreen"
              onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen()
                else document.exitFullscreen()
              }}
            >
              <Maximize2 size={15} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
