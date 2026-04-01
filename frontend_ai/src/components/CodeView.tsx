import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'

export function CodeView() {
  const layoutData = useStore((s) => s.layoutData)

  if (!layoutData) return null

  const json = JSON.stringify(layoutData, null, 2)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="code-view"
    >
      <pre className="code-block">
        <code>{json}</code>
      </pre>
    </motion.div>
  )
}
