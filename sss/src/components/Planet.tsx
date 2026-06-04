import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { PlanetData } from '../data/planets';

interface PlanetProps {
  data: PlanetData;
  simTimeRef: React.MutableRefObject<number>;
  simulationSpeed: number;
  showOrbits: boolean;
  showLabels: boolean;
  onSelect: (planet: PlanetData) => void;
  isFocused: boolean;
}

const Planet = ({
  data,
  simTimeRef,
  simulationSpeed,
  showOrbits,
  showLabels,
  onSelect,
  isFocused
}: PlanetProps) => {
  const planetRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Load textures
  const texture = useTexture(data.textureUrl);
  const ringTexture = data.ring ? useTexture(data.ring.textureUrl) : null;

  // Orbital points for the path
  const points = useMemo(() => 
    new Array(128).fill(0).map((_, i) => {
      const angle = (i / 127) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(angle) * data.distance,
        0,
        Math.sin(angle) * data.distance
      );
    }),
    [data.distance]
  );

  useFrame((_, delta) => {
    const t = simTimeRef.current * data.speed;
    const x = Math.cos(t) * data.distance;
    const z = Math.sin(t) * data.distance;

    if (planetRef.current) {
      planetRef.current.position.set(x, 0, z);
      // Spin speed increases with simulation speed, stops when paused
      planetRef.current.rotation.y += delta * (simulationSpeed > 0 ? (0.5 + simulationSpeed * 0.1) : 0);
    }
  });

  return (
    <group>
      {/* Orbital Path */}
      {showOrbits && (
        <Line
          points={points}
          color="#ffffff"
          opacity={0.15}
          transparent
          lineWidth={1}
        />
      )}

      {/* Planet Mesh */}
      <mesh
        ref={planetRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data);
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[data.radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.8}
          metalness={0.2}
          emissive={data.color}
          emissiveIntensity={hovered ? 0.4 : isFocused ? 0.2 : 0.05}
        />

        {/* Saturn's Rings */}
        {data.ring && ringTexture && (
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[data.ring.innerRadius, data.ring.outerRadius, 64]} />
            <meshStandardMaterial 
              map={ringTexture} 
              transparent 
              opacity={0.8} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        )}

        {/* Planet Label */}
        {showLabels && (
          <Html distanceFactor={15} position={[0, data.radius + 0.5, 0]}>
            <div className={`pointer-events-none select-none transition-opacity duration-300 ${
              hovered || isFocused ? 'opacity-100' : 'opacity-60'
            }`}>
              <span className="bg-black/80 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap border border-white/20 uppercase tracking-widest font-bold">
                {data.name}
              </span>
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
};

export default Planet;
