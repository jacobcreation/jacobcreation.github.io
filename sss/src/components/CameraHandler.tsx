import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { PlanetData, StarSystemData } from '../data/planets';

interface CameraHandlerProps {
  focusedPlanet: PlanetData | null;
  simTimeRef: React.MutableRefObject<number>;
  activeSystem: StarSystemData;
  cameraResetTick: number;
}

const CameraHandler = ({ focusedPlanet, simTimeRef, activeSystem, cameraResetTick }: CameraHandlerProps) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    if (!controlsRef.current) {
      return;
    }

    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.object.position.set(...activeSystem.camera.position);
    controlsRef.current.update();
  }, [activeSystem, cameraResetTick]);

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
      minDistance={activeSystem.camera.minDistance}
      maxDistance={activeSystem.camera.maxDistance}
    />
  );
};

export default CameraHandler;
