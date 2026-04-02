import { useRef, useState, useMemo } from 'react'
import { Canvas as R3FCanvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, ContactShadows, Html } from '@react-three/drei'
import { useStore } from '../store/useStore'
import type { GridCell } from '../types'
import * as THREE from 'three'
import { easing } from 'maath'
const CELL_SIZE = 1.2

/* ═══════ Palette ═══════ */
const ZONE_PALETTE = {
  road:        { base: '#2d3748', highlight: '#4a5568' },
  residential: { base: '#f7fafc', roof: '#4a5568' },
  commercial:  { base: '#90cdf4', trim: '#2b6cb0' },
  park:        { base: '#48bb78', trunk: '#7b341e', foliage: '#2f855a' },
  industrial:  { base: '#a0aec0', smokestack: '#718096' },
  water:       { base: '#4299e1', wave: '#63b3ed' },
  empty:       { base: '#1a202c' }
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/* ═══════ Procedural Builders ═══════ */

const ParkTree = ({ x, z, scale, seed }: { x: number, z: number, scale: number, seed: number }) => {
  const isPond = seededRandom(seed * 4) > 0.8
  if (isPond) {
    return (
      <mesh position={[x, 0.03, z]} receiveShadow rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.2 * scale, 12]} />
        <meshStandardMaterial color={ZONE_PALETTE.water.base} roughness={0.1} metalness={0.9} />
      </mesh>
    )
  }

  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.2, 5]} />
        <meshStandardMaterial color={ZONE_PALETTE.park.trunk} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <dodecahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color={ZONE_PALETTE.park.foliage} roughness={0.8} />
      </mesh>
    </group>
  )
}

const ResidentialHouse = ({ x, z, scale, seed }: { x: number, z: number, scale: number, seed: number }) => {
  const height = 0.2 + seededRandom(seed) * 0.15
  const isNightMode = useStore(s => s.isNightMode)
  const isLightOn = seededRandom(seed * 5) > 0.5

  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, height, 0.4]} />
        <meshStandardMaterial color={ZONE_PALETTE.residential.base} roughness={0.8} />
      </mesh>
      {/* Night window glow */}
      {isNightMode && isLightOn && (
        <mesh position={[0, height / 2, 0.21]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
      )}
      <mesh position={[0, height + 0.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.35, 0.2, 4]} />
        <meshStandardMaterial color={ZONE_PALETTE.residential.roof} roughness={0.9} />
      </mesh>
    </group>
  )
}

const CommercialSkyscraper = ({ x, z, seed }: { x: number, z: number, seed: number }) => {
  const tier1Height = 0.8 + seededRandom(seed) * 1.0 // Varied sizes!
  const tier2Height = 0.4 + seededRandom(seed * 2) * 0.5
  const tier3Height = 0.2 + seededRandom(seed * 3) * 0.4
  const hasTier3 = seededRandom(seed * 4) > 0.4
  const hasAntenna = seededRandom(seed * 5) > 0.3

  const isNightMode = useStore(s => s.isNightMode)

  const material = new THREE.MeshStandardMaterial({
    color: ZONE_PALETTE.commercial.base,
    roughness: 0.1,
    metalness: 0.8,
    emissive: isNightMode ? '#fef08a' : '#000000',
    emissiveIntensity: isNightMode ? 0.2 : 0
  })

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, tier1Height / 2, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.7, tier1Height, 0.7]} />
      </mesh>
      <mesh position={[0, tier1Height + tier2Height / 2, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.5, tier2Height, 0.5]} />
      </mesh>
      {hasTier3 && (
        <mesh position={[0, tier1Height + tier2Height + tier3Height / 2, 0]} castShadow material={material}>
          <cylinderGeometry args={[0.1, 0.15, tier3Height, 4]} />
        </mesh>
      )}
      {hasAntenna && (
         <mesh position={[0, tier1Height + tier2Height + (hasTier3 ? tier3Height : 0) + 0.25, 0]}>
           <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
           <meshStandardMaterial color="#ffffff" emissive={isNightMode ? "#ef4444" : "#000"} emissiveIntensity={isNightMode ? 0.5 : 0} />
         </mesh>
      )}
    </group>
  )
}

const IndustrialFactory = ({ x, z, seed }: { x: number, z: number, seed: number }) => {
  const isNightMode = useStore(s => s.isNightMode)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[-0.1, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.4, 0.7]} />
        <meshStandardMaterial color={ZONE_PALETTE.industrial.base} roughness={0.7} />
      </mesh>
      <mesh position={[0.3, 0.5, -0.15]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1.0, 12]} />
        <meshStandardMaterial color={ZONE_PALETTE.industrial.smokestack} roughness={0.6} />
      </mesh>
      <mesh position={[0.3, 0.4, 0.2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 12]} />
        <meshStandardMaterial color={ZONE_PALETTE.industrial.smokestack} roughness={0.6} />
      </mesh>
      {isNightMode && (
         <pointLight position={[0, 0.8, 0]} intensity={2} distance={2} color="#f97316" />
      )}
    </group>
  )
}

const RoamingCar = ({ seed }: { seed: number }) => {
  const ref = useRef<THREE.Group>(null)
  const isNightMode = useStore(s => s.isNightMode)
  
  // Random speed and starting offset
  const speed = 0.5 + seededRandom(seed) * 1.5
  const offset = seededRandom(seed * 2) * Math.PI * 2
  const isXAxis = seededRandom(seed * 3) > 0.5

  useFrame(({ clock }) => {
    if (ref.current) {
      // Loop smoothly back and forth on one block tile
      const t = clock.elapsedTime * speed + offset
      const pos = Math.sin(t) * 0.4
      if (isXAxis) {
        ref.current.position.x = pos
        ref.current.rotation.y = Math.cos(t) > 0 ? Math.PI / 2 : -Math.PI / 2
      } else {
        ref.current.position.z = pos
        ref.current.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI
      }
    }
  })

  return (
    <group position={[0, 0.05, 0]} ref={ref}>
      <mesh>
        <boxGeometry args={[0.08, 0.06, 0.16]} />
        <meshStandardMaterial color={seededRandom(seed*4) > 0.5 ? '#eab308' : '#ffffff'} roughness={0.3} />
      </mesh>
      {/* Headlights */}
      {isNightMode && (
        <>
          <mesh position={[0.02, 0, 0.08]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.02, 0, 0.08]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Taillights */}
          <mesh position={[0.02, 0, -0.08]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[-0.02, 0, -0.08]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </>
      )}
    </group>
  )
}

const RoadTile = ({ seed, elevation = 0 }: { seed: number, elevation?: number }) => (
  <group>
    <mesh position={[0, -elevation / 2 + 0.01, 0]} receiveShadow castShadow>
      <boxGeometry args={[CELL_SIZE - 0.05, 0.02 + elevation, CELL_SIZE - 0.05]} />
      <meshStandardMaterial color={ZONE_PALETTE.road.base} roughness={0.9} />
    </mesh>
    {/* 40% chance to spawn a roaming car on a road */}
    {seededRandom(seed) > 0.6 && <RoamingCar seed={seed} />}
  </group>
)

const WaterTile = ({ elevation = 0 }: { elevation?: number }) => (
  <mesh position={[0, -elevation / 2 + 0.02, 0]} receiveShadow castShadow>
    <boxGeometry args={[CELL_SIZE - 0.05, 0.04 + elevation, CELL_SIZE - 0.05]} />
    <meshStandardMaterial color={ZONE_PALETTE.water.base} roughness={0.1} metalness={0.8} />
  </mesh>
)


/* ═══════ Single Cell Group ═══════ */

function CityCell({ cell, offsetX, offsetZ }: { cell: GridCell, offsetX: number, offsetZ: number }) {
  const selectedCell = useStore((s) => s.selectedCell)
  const setSelectedCell = useStore((s) => s.setSelectedCell)
  const hoveredCell = useStore((s) => s.hoveredCell)
  const setHoveredCell = useStore((s) => s.setHoveredCell)

  const isSelected = selectedCell?.x === cell.x && selectedCell?.y === cell.y
  const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y
  const seed = cell.x * 100 + cell.y * 10
  const elevation = cell.elevation || 0

  const groupRef = useRef<THREE.Group>(null)

  // Smooth hover floating
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const targetY = (isHovered ? 0.2 : 0) + elevation
    easing.damp(groupRef.current.position, 'y', targetY, 0.15, delta)
  })

  // Render logic based on type
  const renderGeometry = () => {
    switch (cell.type) {
      case 'residential':
        return (
          <>
            <ResidentialHouse x={-0.2} z={-0.2} scale={1} seed={seed} />
            <ResidentialHouse x={0.25} z={-0.2} scale={0.8} seed={seed + 1} />
            <ResidentialHouse x={-0.1} z={0.3} scale={0.9} seed={seed + 2} />
            <ResidentialHouse x={0.3} z={0.3} scale={1.1} seed={seed + 3} />
          </>
        )
      case 'commercial':
        return <CommercialSkyscraper x={0} z={0} seed={seed} />
      case 'industrial':
        return <IndustrialFactory x={0} z={0} seed={seed} />
      case 'park':
        return (
          <>
            <ParkTree x={-0.3} z={-0.3} scale={1} seed={seed} />
            <ParkTree x={0.2} z={-0.2} scale={1.5} seed={seed+1} />
            <ParkTree x={-0.1} z={0.4} scale={1.2} seed={seed+2} />
            <ParkTree x={0.3} z={0.3} scale={0.8} seed={seed+3} />
          </>
        )
      case 'road':
        return <RoadTile seed={seed} elevation={elevation} />
      case 'water':
        return <WaterTile elevation={elevation} />
      default:
        return null
    }
  }

  const getBaseColor = () => {
    if (isSelected) return '#ffffff'
    if (cell.type === 'park' || cell.type === 'road' || cell.type === 'water') return ZONE_PALETTE.empty.base
    return '#2d3748'
  }

  // Determine tooltip color map
  const tailwindColorMap: Record<string, string> = {
    commercial: 'bg-blue-500',
    residential: 'bg-zinc-300',
    industrial: 'bg-slate-500',
    park: 'bg-green-500',
    water: 'bg-blue-400',
    road: 'bg-zinc-800'
  }

  return (
    <group
      position={[offsetX, 0, offsetZ]}
      onClick={(e) => {
        e.stopPropagation()
        setSelectedCell(isSelected ? null : cell)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHoveredCell(cell)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHoveredCell(null)
        document.body.style.cursor = 'default'
      }}
    >
      <group ref={groupRef}>
        {renderGeometry()}

        {cell.type !== 'road' && cell.type !== 'water' && cell.type !== 'park' ? (
          <mesh position={[0, -elevation / 2 + 0.05, 0]} receiveShadow castShadow>
            <boxGeometry args={[CELL_SIZE - 0.05, 0.1 + elevation, CELL_SIZE - 0.05]} />
            <meshStandardMaterial color={getBaseColor()} roughness={0.9} />
          </mesh>
        ) : cell.type === 'park' ? (
          <mesh position={[0, -elevation / 2 + 0.02, 0]} receiveShadow castShadow>
            <boxGeometry args={[CELL_SIZE - 0.05, 0.04 + elevation, CELL_SIZE - 0.05]} />
            <meshStandardMaterial color={ZONE_PALETTE.park.base} roughness={1} />
          </mesh>
        ) : null}

        {/* 3D Tooltip when Hovered */}
        {isHovered && cell.type !== 'empty' && (
          <Html position={[0, cell.type === 'commercial' ? 2.5 : 1, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="bg-zinc-900/95 backdrop-blur-md text-white px-3 py-2 rounded-lg shadow-2xl border border-zinc-700/50 text-xs min-w-[130px] transform transition-all duration-200 pointer-events-none">
              <div className="font-bold mb-1 uppercase tracking-widest text-[10px] text-zinc-400">Sector {cell.x}-{cell.y}</div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${tailwindColorMap[cell.type] || 'bg-zinc-500'}`} />
                <span className="capitalize font-semibold text-sm">{cell.type} Zone</span>
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

/* ═══════ Auto-rotate ═══════ */
function AutoRotate() {
  const [active, setActive] = useState(true)
  const controlsRef = useRef<any>(null)

  useFrame(() => {
    if (active && controlsRef.current) {
      controlsRef.current.autoRotate = true
      controlsRef.current.autoRotateSpeed = 0.5
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={40}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.1}
      autoRotate={active}
      onStart={() => setActive(false)}
    />
  )
}

/* ═══════ Main Scene Assembly ═══════ */
function CityScene() {
  const layoutData = useStore((s) => s.layoutData)
  const isNightMode = useStore((s) => s.isNightMode)

  if (!layoutData) return null

  const rows = layoutData.length
  const cols = layoutData[0]?.length || 0
  const width = cols * CELL_SIZE
  const depth = rows * CELL_SIZE
  const centerX = (width - CELL_SIZE) / 2
  const centerZ = (depth - CELL_SIZE) / 2

  return (
    <group position={[-centerX, 0, -centerZ]}>
      {/* Scale Model Cutting Mat / Base */}
      <mesh position={[centerX, -0.25, centerZ]} receiveShadow>
        <boxGeometry args={[width + 2, 0.5, depth + 2]} />
        <meshStandardMaterial color={isNightMode ? '#1e293b' : '#ffffff'} roughness={1} />
      </mesh>

      {/* Grid Lines over the base */}
      <Grid 
        position={[centerX, 0.01, centerZ]}
        args={[width + 2, depth + 2]} 
        cellSize={CELL_SIZE}
        cellThickness={0.5}
        cellColor={isNightMode ? "#334155" : "#e2e8f0"}
        sectionSize={CELL_SIZE * 4}
        sectionThickness={1}
        sectionColor={isNightMode ? "#475569" : "#cbd5e1"}
        fadeDistance={40}
        fadeStrength={1}
      />

      <ContactShadows 
        position={[centerX, 0.02, centerZ]} 
        scale={width * 1.5} 
        resolution={256} 
        far={5} 
        blur={1.5} 
        opacity={isNightMode ? 0.3 : 0.8} 
        color="#000000"
      />

      {layoutData.map((row) => 
        row.map((cell) => (
          <CityCell
            key={`${cell.x}-${cell.y}`}
            cell={cell}
            offsetX={cell.x * CELL_SIZE}
            offsetZ={cell.y * CELL_SIZE}
          />
        ))
      )}
    </group>
  )
}

export function Scene3D() {
  const layoutData = useStore((s) => s.layoutData)
  const isNightMode = useStore((s) => s.isNightMode)

  if (!layoutData) return null

  const maxDim = Math.max(layoutData.length, layoutData[0]?.length || 0)
  const camDist = maxDim * 1.3

  return (
    <div className="scene-3d-wrapper relative w-full h-full bg-zinc-100 overflow-hidden">
      <R3FCanvas
        camera={{ position: [camDist * 0.7, camDist * 0.6, camDist * 0.7], fov: 35 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={[isNightMode ? '#040814' : '#f8fafc']} />
        <fog attach="fog" args={[isNightMode ? '#040814' : '#f8fafc', maxDim * 1.5, maxDim * 3]} />

        {isNightMode ? (
          <>
            <ambientLight intensity={0.1} color="#3b82f6" />
            <directionalLight
              position={[15, 25, -10]}
              intensity={0.2}
              color="#3b82f6"
              castShadow
              shadow-mapSize={[2048, 2048]}
            />
            <pointLight position={[0, 15, 0]} intensity={2} color="#8b5cf6" distance={30} />
          </>
        ) : (
          <>
            <ambientLight intensity={0.6} color="#ffffff" />
            <directionalLight
              position={[15, 25, -10]}
              intensity={1.5}
              color="#fdfbf7"
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-far={80}
              shadow-camera-left={-25}
              shadow-camera-right={25}
              shadow-camera-top={25}
              shadow-camera-bottom={-25}
              shadow-bias={-0.0001}
            />
            <pointLight position={[-15, 10, 15]} intensity={0.4} color="#e0f2fe" />
          </>
        )}
        
        {!isNightMode && <Environment preset="studio" environmentIntensity={0.8} />}

        <CityScene />
        <AutoRotate />
      </R3FCanvas>
      
      {/* HUD Overlays */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="text-xs text-zinc-500 font-medium tracking-wide pointer-events-none uppercase bg-white/80 dark:bg-zinc-900/80 px-4 py-1.5 rounded-full backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-sm">
          Drag to pan • Scroll to zoom
        </div>
      </div>

    </div>
  )
}
