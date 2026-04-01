import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Clock, Settings, Trash2, PanelLeftClose, PanelLeft, X } from 'lucide-react'

function formatRelativeDate(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const day = 86400000
  if (diff < day) return 'Today'
  if (diff < day * 2) return 'Yesterday'
  if (diff < day * 7) return 'Last 7 days'
  return 'Older'
}

function groupByDate(items: { id: string; prompt: string; timestamp: number }[]) {
  const groups: Record<string, typeof items> = {}
  for (const item of items) {
    const label = formatRelativeDate(item.timestamp)
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return groups
}

export function Sidebar() {
  const history = useStore((s) => s.history)
  const activeHistoryId = useStore((s) => s.activeHistoryId)
  const loadHistory = useStore((s) => s.loadHistory)
  const clearHistory = useStore((s) => s.clearHistory)
  const deleteHistoryItem = useStore((s) => s.deleteHistoryItem)
  const newSession = useStore((s) => s.newSession)
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleSidebar)

  const grouped = groupByDate(history)

  return (
    <motion.aside
      className="sidebar"
      animate={{ width: collapsed ? 0 : 260 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <div className="sidebar-inner" style={{ width: 260 }}>
        {/* Header */}
        <div className="sidebar-header">
          <span className="sidebar-logo">CitySketch</span>
          <div className="sidebar-header-actions">
            <button onClick={newSession} className="sidebar-icon-btn" title="New layout">
              <Plus size={16} strokeWidth={1.5} />
            </button>
            <button onClick={toggleSidebar} className="sidebar-icon-btn" title="Collapse sidebar">
              <PanelLeftClose size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* History */}
        <nav className="sidebar-history">
          {history.length === 0 ? (
            <div className="sidebar-empty">
              <Clock size={16} strokeWidth={1.5} />
              <span>No history yet</span>
            </div>
          ) : (
            Object.entries(grouped).map(([label, items]) => (
              <div key={label} className="history-group">
                <div className="history-group-label">{label}</div>
                <AnimatePresence mode="popLayout">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className={`sidebar-history-item ${activeHistoryId === item.id ? 'active' : ''}`}
                      onClick={() => loadHistory(item.id)}
                    >
                      <span className="history-text">{item.prompt}</span>
                      <button
                        className="history-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteHistoryItem(item.id)
                        }}
                        title="Delete"
                      >
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {history.length > 0 && (
            <button className="sidebar-footer-btn" onClick={clearHistory}>
              <Trash2 size={15} strokeWidth={1.5} />
              <span>Clear history</span>
            </button>
          )}
          <button className="sidebar-footer-btn">
            <Settings size={15} strokeWidth={1.5} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

/* Expand button — rendered in App when sidebar is collapsed */
export function SidebarExpandBtn() {
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  if (!collapsed) return null
  return (
    <button className="sidebar-expand-btn" onClick={toggleSidebar} title="Expand sidebar">
      <PanelLeft size={18} strokeWidth={1.5} />
    </button>
  )
}
