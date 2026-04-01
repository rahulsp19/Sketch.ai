import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Building2, Home, Trees, Waves, Factory, Route } from 'lucide-react'
import type { GridCell } from '../types'

const CELL_STYLES: Record<GridCell['type'], { color: string, icon: any, label: string }> = {
  road: { color: '#52525b', icon: Route, label: 'RD' },
  residential: { color: '#3b82f6', icon: Home, label: 'RES' },
  commercial: { color: '#f59e0b', icon: Building2, label: 'COM' },
  park: { color: '#22c55e', icon: Trees, label: 'PRK' },
  industrial: { color: '#a855f7', icon: Factory, label: 'IND' },
  water: { color: '#06b6d4', icon: Waves, label: 'H2O' },
  empty: { color: '#27272a', icon: null, label: '' },
}

export function Grid2D() {
  const layoutData = useStore((s) => s.layoutData)
  const selectedCell = useStore((s) => s.selectedCell)
  const setSelectedCell = useStore((s) => s.setSelectedCell)
  const hoveredCell = useStore((s) => s.hoveredCell)
  const setHoveredCell = useStore((s) => s.setHoveredCell)

  if (!layoutData) return null

  const rows = layoutData.length
  const cols = layoutData[0]?.length || 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="grid-2d-wrapper w-full h-full relative"
    >
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        centerOnInit
        wheel={{ step: 0.1 }}
      >
        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
          <div
            className="grid-2d-blueprint"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 80px)`,
              gridTemplateRows: `repeat(${rows}, 80px)`,
              gap: '4px',
              padding: '40px',
            }}
          >
            {layoutData.flat().map((cell, i) => {
              const isSelected = selectedCell?.x === cell.x && selectedCell?.y === cell.y
              const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y
              const style = CELL_STYLES[cell.type]
              const Icon = style.icon

              return (
                <motion.div
                  key={`${cell.x}-${cell.y}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.002 }}
                  onClick={() => setSelectedCell(isSelected ? null : cell)}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  className={`blueprint-cell ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderColor: isSelected ? style.color : 'var(--color-border)',
                    backgroundColor: isSelected ? `${style.color}15` : 'transparent',
                    boxShadow: isSelected ? `0 0 15px ${style.color}30` : 'none',
                  }}
                >
                  {/* Subtle top indicator bar */}
                  {cell.type !== 'empty' && (
                     <div 
                       className="cell-indicator" 
                       style={{ backgroundColor: style.color, opacity: isSelected ? 1 : 0.6 }} 
                     />
                  )}
                  
                  {/* Icon & Label */}
                  <div className="cell-content" style={{ color: isHovered || isSelected ? style.color : '#52525b' }}>
                    {Icon && <Icon size={18} strokeWidth={1.5} />}
                    {cell.type !== 'empty' && <span className="cell-label">{style.label}</span>}
                  </div>

                  {/* Coordinates minimal overlay */}
                  <div className="cell-coords">
                    {cell.x},{cell.y}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Blueprint Legend Floating */}
      <div className="blueprint-legend">
        {Object.entries(CELL_STYLES)
          .filter(([type]) => type !== 'empty')
          .map(([type, style]) => {
            const Icon = style.icon
            return (
               <div key={type} className="legend-item-bp">
                 {Icon && <Icon size={14} color={style.color} strokeWidth={2} />}
                 <span className="legend-label-bp">{type}</span>
               </div>
            )
          })}
      </div>
    </motion.div>
  )
}
