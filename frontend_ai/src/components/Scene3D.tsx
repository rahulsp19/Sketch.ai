import { useRef, useState } from 'react'
import { Canvas as R3FCanvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  RoundedBox,
  Edges,
  Float,
  Text,
  Grid,
  ContactShadows
} from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  Vignette,
} from '@react-three/postprocessing'
import { useStore } from '../store/useStore'
import type { GridCell } from '../types'
import * as THREE from 'three'
import { easing } from 'maath'

/* ═══════ Digital Twin Holographic Palette ═══════ */
const ZONE_CONFIG: Record<
  GridCell['type'],
  { color: string; emissive: string; baseHeight: number; variance: number; subBlocks: number }
> = {
  road:        { color: '#18181b', emissive: '#000000', baseHeight: 0.02, variance: 0,   subBlocks: 1 },
  residential: { color: '#3b82f6', emissive: '#1d4ed8', baseHeight: 0.8,  variance: 0.4, subBlocks: 4 }, // 4 small houses
  commercial:  { color: '#f59e0b', emissive: '#b45309', baseHeight: 1.8,  variance: 0.8, subBlocks: 2 }, // 2 overlapping towers
  park:        { color: '#22c55e', emissive: '#15803d', baseHeight: 0.06, variance: 0.1, subBlocks: 3 }, // trees
  industrial:  { color: '#a855f7', emissive: '#7e22ce', baseHeight: 0.7,  variance: 0.3, subBlocks: 2 }, // wide factories
  water:       { color: '#06b6d4', emissive: '#0891b2', baseHeight: 0.01, variance: 0,   subBlocks: 1 },
  empty:       { color: '#09090b', emissive: '#000000', baseHeight: 0.01, variance: 0,   subBlocks: 1 },
}

const CELL_SIZE = 1.2
const GAP = 0.15

/* ═══════ Seeded random ═══════ */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/* ═══════ Sub-Block (The actual 3D meshes) ═══════ */
function SubBlock({
  cell,
  config,
  seed,
  isSelected,
  isHovered,
  offsetX,
  offsetZ,
  index
}: {
  cell: GridCell, config: any, seed: number, isSelected: boolean, isHovered: boolean, offsetX: number, offsetZ: number, index: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Specific geometry based on type and seed
  const h = config.baseHeight + seededRandom(seed * 1.1) * config.variance
  
  // Sub-block positioning
  let subX = 0
  let subZ = 0
  let subSizeX = CELL_SIZE - GAP
  let subSizeZ = CELL_SIZE - GAP
  
  if (config.subBlocks === 4) {
    // 2x2 grid for residential
    subSizeX = (CELL_SIZE - GAP) / 2 - 0.05
    subSizeZ = (CELL_SIZE - GAP) / 2 - 0.05
    subX = (index % 2 === 0 ? -1 : 1) * (subSizeX / 2 + 0.05)
    subZ = (index < 2 ? -1 : 1) * (subSizeZ / 2 + 0.05)
  } else if (config.subBlocks === 2 && cell.type === 'commercial') {
    // Overlapping towers
    subSizeX = (CELL_SIZE - GAP) * (0.6 + seededRandom(seed*2)*0.4)
    subSizeZ = (CELL_SIZE - GAP) * (0.6 + seededRandom(seed*3)*0.4)
    subX = (seededRandom(seed*4) - 0.5) * 0.4
    subZ = (seededRandom(seed*5) - 0.5) * 0.4
  } else if (config.subBlocks === 3 && cell.type === 'park') {
    subSizeX = 0.15 + seededRandom(seed*1)*0.15
    subSizeZ = subSizeX
    subX = (seededRandom(seed*2) - 0.5) * (CELL_SIZE - GAP - subSizeX)
    subZ = (seededRandom(seed*3) - 0.5) * (CELL_SIZE - GAP - subSizeZ)
  }

  // Materials
  const baseColor = new THREE.Color(isSelected ? '#ffffff' : config.color)
  const emissiveColor = new THREE.Color(config.emissive)
  
  const isFlat = h < 0.1
  const isWater = cell.type === 'water'

  useFrame((_, delta) => {
    if (!meshRef.current) return
    // Smooth hover animation: slight float up and scale
    const targetY = isHovered && !isFlat ? h / 2 + 0.1 : h / 2
    easing.damp(meshRef.current.position, 'y', targetY, 0.15, delta)
    
    // Smooth emissive glow
    const mat = meshRef.current.material as THREE.MeshPhysicalMaterial
    const targetIntensity = isHovered || isSelected ? 1.5 : (isWater ? 0.4 : 0.1)
    easing.damp(mat, 'emissiveIntensity', targetIntensity, 0.2, delta)
  })

  return (
    <RoundedBox
      ref={meshRef}
      args={[subSizeX, Math.max(h, 0.02), subSizeZ]}
      radius={isFlat ? 0.005 : 0.04}
      smoothness={3}
      position={[offsetX + subX, h / 2, offsetZ + subZ]}
      castShadow={!isFlat}
      receiveShadow
    >
      {/* Premium Glassmorphism Material */}
      <meshPhysicalMaterial
        color={baseColor}
        emissive={emissiveColor}
        emissiveIntensity={0.1}
        roughness={isWater ? 0 : 0.2}
        metalness={0.1}
        transmission={isFlat ? 0 : 0.8} // Glass effect
        thickness={0.5} // Refraction volume
        ior={1.5}
        clearcoat={1}
        clearcoatRoughness={0.1}
        envMapIntensity={2.0}
      />
      {/* High-tech edges */}
      {!isFlat && cell.type !== 'park' && (
        <Edges
          threshold={15}
          color={isSelected ? '#ffffff' : config.color}
          lineWidth={1}
          opacity={isHovered ? 0.8 : 0.3}
          transparent
        />
      )}
    </RoundedBox>
  )
}

/* ═══════ Single Cell Group ═══════ */
function CityCell({ cell, offsetX, offsetZ }: { cell: GridCell, offsetX: number, offsetZ: number }) {
  const selectedCell = useStore((s) => s.selectedCell)
  const setSelectedCell = useStore((s) => s.setSelectedCell)
  const hoveredCell = useStore((s) => s.hoveredCell)
  const setHoveredCell = useStore((s) => s.setHoveredCell)

  const isSelected = selectedCell?.x === cell.x && selectedCell?.y === cell.y
  const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y
  const config = ZONE_CONFIG[cell.type]

  // Base tile
  const tileColor = new THREE.Color(config.color).multiplyScalar(0.3)

  return (
    <group
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
      {/* Hidden hit box for reliable interaction */}
      <mesh position={[offsetX, 0.1, offsetZ]} visible={false}>
        <boxGeometry args={[CELL_SIZE, 0.2, CELL_SIZE]} />
      </mesh>

      {/* Sub-buildings */}
      {Array.from({ length: config.subBlocks }).map((_, i) => (
        <SubBlock
          key={i}
          cell={cell}
          config={config}
          seed={cell.x * 100 + cell.y * 10 + i}
          isSelected={isSelected}
          isHovered={isHovered}
          offsetX={offsetX}
          offsetZ={offsetZ}
          index={i}
        />
      ))}

      {/* Under-tile base for structure */}
      <mesh position={[offsetX, 0.005, offsetZ]} receiveShadow>
        <planeGeometry args={[CELL_SIZE - 0.02, CELL_SIZE - 0.02]} />
        <meshStandardMaterial color={isSelected ? '#ffffff' : tileColor} roughness={0.9} />
      </mesh>
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
      
      {/* Infinite Glowing Floor Grid */}
      <Grid 
        position={[centerX, -0.01, centerZ]}
        args={[100, 100]} 
        cellSize={CELL_SIZE}
        cellThickness={1}
        cellColor="#1e293b"
        sectionSize={CELL_SIZE * 4}
        sectionThickness={1.5}
        sectionColor="#334155"
        fadeDistance={40}
        fadeStrength={1}
      />

      {/* Base Pedestal for city */}
      <mesh position={[centerX, -0.25, centerZ]} receiveShadow>
        <boxGeometry args={[width + 1, 0.5, depth + 1]} />
        <meshStandardMaterial color="#09090b" roughness={1} />
      </mesh>

      {/* High-quality contact shadows */}
      <ContactShadows 
        position={[centerX, 0.01, centerZ]} 
        scale={width * 1.5} 
        resolution={512} 
        far={3} 
        blur={2} 
        opacity={0.6} 
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

/* ═══════ Floating Label ═══════ */
function ZoneHints() {
  const hoveredCell = useStore((s) => s.hoveredCell)
  if (!hoveredCell || hoveredCell.type === 'empty') return null

  const layoutData = useStore.getState().layoutData
  if (!layoutData) return null

  const centerX = (layoutData[0].length * CELL_SIZE - CELL_SIZE) / 2
  const centerZ = (layoutData.length * CELL_SIZE - CELL_SIZE) / 2
  const px = hoveredCell.x * CELL_SIZE - centerX
  const pz = hoveredCell.y * CELL_SIZE - centerZ

  return (
    <Float speed={3} floatIntensity={0.2}>
      <Text
        position={[px, ZONE_CONFIG[hoveredCell.type].baseHeight + 1.2, pz]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
      >
        {hoveredCell.type.toUpperCase()}
      </Text>
    </Float>
  )
}

export function Scene3D() {
  const layoutData = useStore((s) => s.layoutData)
  if (!layoutData) return null

  const maxDim = Math.max(layoutData.length, layoutData[0]?.length || 0)
  const camDist = maxDim * 1.5

  return (
    <div className="scene-3d-wrapper relative w-full h-full bg-zinc-950">
      <R3FCanvas
        camera={{ position: [camDist * 0.7, camDist * 0.6, camDist * 0.7], fov: 35 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#09090b']} />
        <fog attach="fog" args={['#09090b', maxDim * 1.5, maxDim * 3]} />

        {/* Studio Lighting */}
        <ambientLight intensity={0.2} color="#ffffff" />
        <directionalLight
          position={[10, 20, 10]}
          intensity={2.5}
          color="#ffffff"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <pointLight position={[-10, 5, -10]} intensity={1.5} color="#3b82f6" />
        <pointLight position={[10, 5, -10]} intensity={1.0} color="#8b5cf6" />

        {/* HDR Environment for Glass Reflections */}
        <Environment preset="city" environmentIntensity={0.5} />

        <CityScene />
        <ZoneHints />

        {/* Bloom for Hologram Glow */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} intensity={1.5} radius={0.6} />
          <Vignette eskil={false} offset={0.3} darkness={0.7} />
        </EffectComposer>

        <AutoRotate />
      </R3FCanvas>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-zinc-500 font-medium tracking-wide pointer-events-none uppercase bg-zinc-900/50 px-4 py-1.5 rounded-full backdrop-blur-sm border border-zinc-800">
        Drag to pan • Scroll to zoom
      </div>
    </div>
  )
}
