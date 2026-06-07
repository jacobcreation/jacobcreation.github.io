import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { StarData } from '../data/planets';

interface SunProps {
  star: StarData;
}

const Sun = ({ star }: SunProps) => {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const texture = useTexture(star.textureUrl);

  useFrame(({ clock }) => {
    if (sunRef.current) {
      sunRef.current.rotation.y = clock.getElapsedTime() * 0.1;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 2) * 0.05);
    }
  });

  return (
    <group>
      {/* Main Sun Body */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[star.radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          color={star.color}
          emissive={star.emissiveColor}
          emissiveIntensity={1.5}
        />
        <pointLight intensity={star.lightIntensity} distance={star.lightDistance} decay={1} color={star.color} />
      </mesh>

      {/* Atmospheric Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[star.radius * 1.06, 64, 64]} />
        <meshBasicMaterial
          color={star.color}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
};

export default Sun;
