import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Grid2D } from './Grid2D'
import { Scene3D } from './Scene3D'
import { CodeView } from './CodeView'
import { Sparkles } from 'lucide-react'

function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="loading-skeleton"
    >
      <div className="skeleton-grid">
        {Array.from({ length: 48 }, (_, i) => (
          <div key={i} className="skeleton-cell" style={{ animationDelay: `${i * 30}ms` }} />
        ))}
      </div>
      <span className="loading-text">Generating layout…</span>
    </motion.div>
  )
}

export function Canvas() {
  const viewMode = useStore((s) => s.viewMode)
  const layoutData = useStore((s) => s.layoutData)
  const isLoading = useStore((s) => s.isLoading)

  return (
    <div className="canvas">
      {/* Loading skeleton */}
      <AnimatePresence>
        {isLoading && <LoadingSkeleton />}
      </AnimatePresence>

      {/* Empty state */}
      {!layoutData && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="canvas-empty"
        >
          <div className="empty-icon">
            <Sparkles size={28} strokeWidth={1.2} />
          </div>
          <h2 className="empty-title">Describe a city layout</h2>
          <p className="empty-desc">
            Type a prompt below to generate a 2D city grid.<br />
            Try: "A coastal city with a central park and commercial district"
          </p>
        </motion.div>
      )}

      {/* Content */}
      {layoutData && !isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="canvas-content"
          >
            {viewMode === '2D' && <Grid2D />}
            {viewMode === '3D' && <Scene3D />}
            {viewMode === 'CODE' && <CodeView />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
