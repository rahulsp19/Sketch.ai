import { useRef, useState, useMemo } from 'react'
import { Canvas as R3FCanvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei'
import { useStore } from '../store/useStore'
import type { GridCell } from '../types'
import * as THREE from 'three'
import { easing } from 'maath'

const CELL_SIZE = 1.2
const GAP = 0.15

/* ═══════ Palette: Minimalist Scale Model ═══════ */
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

const ParkTree = ({ x, z, scale }: { x: number, z: number, scale: number }) => (
  <group position={[x, 0, z]} scale={scale}>
    {/* Trunk */}
    <mesh position={[0, 0.1, 0]} castShadow>
      <cylinderGeometry args={[0.03, 0.04, 0.2, 5]} />
      <meshStandardMaterial color={ZONE_PALETTE.park.trunk} roughness={0.9} />
    </mesh>
    {/* Foliage */}
    <mesh position={[0, 0.3, 0]} castShadow>
      <dodecahedronGeometry args={[0.15, 0]} />
      <meshStandardMaterial color={ZONE_PALETTE.park.foliage} roughness={0.8} />
    </mesh>
  </group>
)

const ResidentialHouse = ({ x, z, scale, seed }: { x: number, z: number, scale: number, seed: number }) => {
  const height = 0.2 + seededRandom(seed) * 0.15
  return (
    <group position={[x, 0, z]} scale={scale}>
      {/* Base */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, height, 0.4]} />
        <meshStandardMaterial color={ZONE_PALETTE.residential.base} roughness={0.8} />
      </mesh>
      {/* Pitched Roof */}
      <mesh position={[0, height + 0.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.35, 0.2, 4]} />
        <meshStandardMaterial color={ZONE_PALETTE.residential.roof} roughness={0.9} />
      </mesh>
    </group>
  )
}

const CommercialSkyscraper = ({ x, z, seed }: { x: number, z: number, seed: number }) => {
  const tier1Height = 0.8 + seededRandom(seed) * 0.6
  const tier2Height = 0.4 + seededRandom(seed * 2) * 0.4
  const tier3Height = 0.2 + seededRandom(seed * 3) * 0.2
  const hasTier3 = seededRandom(seed * 4) > 0.5

  const material = new THREE.MeshStandardMaterial({
    color: ZONE_PALETTE.commercial.base,
    roughness: 0.1,
    metalness: 0.8,
  })

  return (
    <group position={[x, 0, z]}>
      {/* Base Tier */}
      <mesh position={[0, tier1Height / 2, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.7, tier1Height, 0.7]} />
      </mesh>
      {/* Mid Tier */}
      <mesh position={[0, tier1Height + tier2Height / 2, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.5, tier2Height, 0.5]} />
      </mesh>
      {/* Top Spire Tier */}
      {hasTier3 && (
        <mesh position={[0, tier1Height + tier2Height + tier3Height / 2, 0]} castShadow material={material}>
          <cylinderGeometry args={[0.1, 0.15, tier3Height, 4]} />
        </mesh>
      )}
    </group>
  )
}

const IndustrialFactory = ({ x, z, seed }: { x: number, z: number, seed: number }) => {
  return (
    <group position={[x, 0, z]}>
      {/* Main Warehouse */}
      <mesh position={[-0.1, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.4, 0.7]} />
        <meshStandardMaterial color={ZONE_PALETTE.industrial.base} roughness={0.7} />
      </mesh>
      {/* Silo 1 */}
      <mesh position={[0.3, 0.5, -0.15]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1.0, 12]} />
        <meshStandardMaterial color={ZONE_PALETTE.industrial.smokestack} roughness={0.6} />
      </mesh>
      {/* Silo 2 */}
      <mesh position={[0.3, 0.4, 0.2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 12]} />
        <meshStandardMaterial color={ZONE_PALETTE.industrial.smokestack} roughness={0.6} />
      </mesh>
    </group>
  )
}

const RoadTile = () => (
  <mesh position={[0, 0.01, 0]} receiveShadow>
    <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
    <meshStandardMaterial color={ZONE_PALETTE.road.base} roughness={0.9} />
  </mesh>
)

const WaterTile = () => (
  <mesh position={[0, 0.02, 0]} receiveShadow>
    <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
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

  const groupRef = useRef<THREE.Group>(null)

  // Smooth hover floating
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const targetY = isHovered ? 0.2 : 0
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
            <mesh position={[0, 0.02, 0]} receiveShadow rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[CELL_SIZE - 0.1, CELL_SIZE - 0.1]} />
              <meshStandardMaterial color={ZONE_PALETTE.park.base} roughness={1} />
            </mesh>
            <ParkTree x={-0.3} z={-0.3} scale={1} />
            <ParkTree x={0.2} z={-0.2} scale={1.5} />
            <ParkTree x={-0.1} z={0.4} scale={1.2} />
            <ParkTree x={0.3} z={0.3} scale={0.8} />
          </>
        )
      case 'road':
        return <RoadTile />
      case 'water':
        return <WaterTile />
      default:
        return null
    }
  }

  // Base tile
  const getBaseColor = () => {
    if (isSelected) return '#ffffff'
    if (cell.type === 'park' || cell.type === 'road' || cell.type === 'water') return ZONE_PALETTE.empty.base // Don't over-saturate bases
    return '#2d3748'
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
        {/* Specific Geometry */}
        {renderGeometry()}

        {/* Foundation Base Tile (for all structurally elevated cells) */}
        {cell.type !== 'road' && cell.type !== 'water' && cell.type !== 'park' && (
          <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
            <boxGeometry args={[CELL_SIZE - 0.1, 0.1, CELL_SIZE - 0.1]} />
            <meshStandardMaterial color={getBaseColor()} roughness={0.9} />
          </mesh>
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
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>

      {/* Grid Lines over the base */}
      <Grid 
        position={[centerX, 0.01, centerZ]}
        args={[width + 2, depth + 2]} 
        cellSize={CELL_SIZE}
        cellThickness={0.5}
        cellColor="#e2e8f0"
        sectionSize={CELL_SIZE * 4}
        sectionThickness={1}
        sectionColor="#cbd5e1"
        fadeDistance={40}
        fadeStrength={1}
      />

      <ContactShadows 
        position={[centerX, 0.02, centerZ]} 
        scale={width * 1.5} 
        resolution={1024} 
        far={5} 
        blur={1.5} 
        opacity={0.8} 
        color="#000000"
      />

      {layoutData.flat().map((cell) => (
        <CityCell
          key={`${cell.x}-${cell.y}`}
          cell={cell}
          offsetX={cell.x * CELL_SIZE}
          offsetZ={cell.y * CELL_SIZE}
        />
      ))}
    </group>
  )
}

export function Scene3D() {
  const layoutData = useStore((s) => s.layoutData)
  if (!layoutData) return null

  const maxDim = Math.max(layoutData.length, layoutData[0]?.length || 0)
  const camDist = maxDim * 1.3

  return (
    <div className="scene-3d-wrapper relative w-full h-full bg-zinc-100">
      <R3FCanvas
        camera={{ position: [camDist * 0.7, camDist * 0.6, camDist * 0.7], fov: 35 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#f8fafc']} /> {/* Bright, clean background */}
        <fog attach="fog" args={['#f8fafc', maxDim * 1.5, maxDim * 3]} />

        {/* Studio Diorama Lighting */}
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight
          position={[15, 25, -10]}
          intensity={1.5}
          color="#fdfbf7"
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-far={80}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-bias={-0.0001}
        />
        <pointLight position={[-15, 10, 15]} intensity={0.4} color="#e0f2fe" />
        
        {/* Soft studio environment */}
        <Environment preset="studio" environmentIntensity={0.8} />

        <CityScene />
        <AutoRotate />
      </R3FCanvas>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-zinc-500 font-medium tracking-wide pointer-events-none uppercase bg-white/80 px-4 py-1.5 rounded-full backdrop-blur-sm border border-zinc-200 shadow-sm">
        Drag to pan • Scroll to zoom
      </div>
    </div>
  )
}
