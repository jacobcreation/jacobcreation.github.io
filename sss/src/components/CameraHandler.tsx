import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import type { PlanetData } from '../data/planets';

interface CameraHandlerProps {
  focusedPlanet: PlanetData | null;
  simTimeRef: React.MutableRefObject<number>;
}

const CameraHandler = ({ focusedPlanet, simTimeRef }: CameraHandlerProps) => {
  const controlsRef = useRef<any>(null);

  useFrame(({ camera }) => {
    if (focusedPlanet && controlsRef.current) {
      // Calculate planet's current position using the shared simulation clock
      const t = simTimeRef.current * focusedPlanet.speed;
      const x = Math.cos(t) * focusedPlanet.distance;
      const z = Math.sin(t) * focusedPlanet.distance;
      const targetPosition = new THREE.Vector3(x, 0, z);

      // Smoothly move the controls target to the planet
      controlsRef.current.target.lerp(targetPosition, 0.05);
      
      // If we are very far away, zoom in slightly
      const dist = camera.position.distanceTo(targetPosition);
      if (dist > 15) {
        camera.position.lerp(targetPosition.clone().add(new THREE.Vector3(5, 5, 5)), 0.01);
      }
      
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={100}
    />
  );
};

export default CameraHandler;
