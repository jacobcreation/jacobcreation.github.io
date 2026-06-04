import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, PerspectiveCamera } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import * as THREE from 'three';
import Sun from './Sun';
import Planet from './Planet';
import CameraHandler from './CameraHandler';
import { planets, type PlanetData } from '../data/planets';

interface SolarSystemProps {
  simulationSpeed: number;
  showOrbits: boolean;
  showLabels: boolean;
  focusedPlanet: PlanetData | null;
  onSelectPlanet: (planet: PlanetData | null) => void;
}

const SceneContent = ({
  simulationSpeed,
  showOrbits,
  showLabels,
  focusedPlanet,
  onSelectPlanet
}: SolarSystemProps) => {
  const simTimeRef = useRef(0);

  useFrame((_, delta) => {
    simTimeRef.current += delta * simulationSpeed;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[30, 30, 30]} fov={50} />
      
      <color attach="background" args={['#000000']} />
      
      <ambientLight intensity={0.5} />
      <Stars radius={300} depth={60} count={20000} factor={7} saturation={0} fade speed={1} />
      
      <Sun />
      
      {planets.map((planet) => (
        <Planet
          key={planet.name}
          data={planet}
          simTimeRef={simTimeRef}
          simulationSpeed={simulationSpeed}
          showOrbits={showOrbits}
          showLabels={showLabels}
          onSelect={onSelectPlanet}
          isFocused={focusedPlanet?.name === planet.name}
        />
      ))}

      <CameraHandler 
        focusedPlanet={focusedPlanet} 
        simTimeRef={simTimeRef}
      />
    </>
  );
};

const SolarSystem = (props: SolarSystemProps) => {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Suspense fallback={null}>
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
      
      {/* Loading Indicator */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-medium animate-pulse tracking-widest uppercase text-xs">Loading Universe...</p>
          </div>
        </div>
      }>
        <div />
      </Suspense>
    </div>
  );
};

export default SolarSystem;
