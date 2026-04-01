import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { Activity, Users, Leaf, Navigation } from 'lucide-react'

// Helper to format large numbers
const compactNum = (num: number) => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num)
}

export function CityMetricsSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const layoutData = useStore((s) => s.layoutData)

  const metrics = useMemo(() => {
    if (!layoutData) return null

    let totalBlocks = 0
    const counts = {
      residential: 0,
      commercial: 0,
      industrial: 0,
      park: 0,
      road: 0,
      water: 0
    }

    // Traverse the 2D array
    layoutData.forEach((row) => {
      row.forEach((cell) => {
        totalBlocks++
        const type = cell.type.toLowerCase() as keyof typeof counts
        if (counts[type] !== undefined) counts[type]++
      })
    })

    if (totalBlocks === 0) return null

    // Heuristics Engine
    const hectarePerBlock = 1 // Assume 1 hectare per city block
    const resHectares = counts.residential * hectarePerBlock
    const popDensity = resHectares > 0 ? 150 : 0 // 150 people per hectare of residential
    const population = resHectares * popDensity

    // Walkability Score: Ratio of amenities (park + commercial) to residential
    // Base 40, up to +60 based on ratio
    const amenityRatio = counts.residential > 0 
      ? (counts.park + counts.commercial) / counts.residential 
      : 1
    const walkabilityRaw = 40 + (Math.min(amenityRatio, 1.5) / 1.5) * 60
    const walkability = Math.round(Math.max(0, Math.min(100, walkabilityRaw)))

    // CO2 Efficiency: Starts at 100, drops with Industry/Roads, goes up slightly with Parks
    const co2Raw = 100 
      - (counts.industrial / totalBlocks) * 100 * 1.5 
      - (counts.road / totalBlocks) * 100 * 0.5 
      + (counts.park / totalBlocks) * 100 * 0.5
    const co2Efficiency = Math.round(Math.max(0, Math.min(100, co2Raw)))

    return {
      totalBlocks,
      counts,
      population,
      walkability,
      co2Efficiency
    }
  }, [layoutData])

  if (!metrics) return null

  const getBarColor = (type: string) => {
    switch(type) {
      case 'residential': return 'bg-blue-500'
      case 'commercial': return 'bg-amber-500'
      case 'industrial': return 'bg-purple-500'
      case 'park': return 'bg-emerald-500'
      case 'road': return 'bg-zinc-500'
      case 'water': return 'bg-cyan-500'
      default: return 'bg-zinc-700'
    }
  }

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Toggle Button */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 shadow-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors pointer-events-auto"
        title="Toggle Data Density"
      >
        <Activity size={18} className={isOpen ? "text-blue-400" : ""} />
      </motion.button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-72 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5 shadow-2xl flex flex-col gap-6 origin-top-right pointer-events-auto"
          >
            <div className="flex items-center gap-2 pb-4 border-b border-zinc-800/80">
              <Activity size={14} className="text-zinc-400" />
              <h3 className="text-zinc-200 text-xs font-semibold tracking-wider uppercase">
                City Metrics
              </h3>
            </div>

        {/* Top-Level KPIs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Users size={12} />
              <span className="text-[10px] uppercase font-medium tracking-wide">Est. Pop</span>
            </div>
            <span className="text-2xl font-semibold text-zinc-100 tracking-tight">
              {compactNum(metrics.population)}
            </span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Navigation size={12} />
              <span className="text-[10px] uppercase font-medium tracking-wide">Walkability</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-semibold text-zinc-100 tracking-tight">
                {metrics.walkability}
              </span>
              <span className="text-zinc-500 text-xs mb-1">/100</span>
            </div>
          </div>
        </div>

        {/* CO2 Efficiency Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Leaf size={12} />
              <span className="text-[10px] uppercase font-medium tracking-wide">CO2 Efficiency</span>
            </div>
            <span className="text-xs font-medium text-emerald-400">{metrics.co2Efficiency}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${metrics.co2Efficiency}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className="h-full bg-emerald-500 rounded-full"
            />
          </div>
        </div>

        {/* Zoning Distribution */}
        <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800/50">
          <span className="text-zinc-400 text-[10px] uppercase font-medium tracking-wide mb-1">
            Zoning Distribution
          </span>
          
          {Object.entries(metrics.counts)
            .sort(([,a], [,b]) => b - a)
            .map(([type, count]) => {
              if (count === 0) return null
              const percentage = (count / metrics.totalBlocks) * 100
              
              return (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-300 capitalize">{type}</span>
                    <span className="text-zinc-500 font-mono text-[10px]">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800/80 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded-full ${getBarColor(type)}`}
                    />
                  </div>
                </div>
              )
          })}
        </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
