import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const Sun = () => {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const texture = useTexture(`${import.meta.env.BASE_URL}textures/2k_sun.jpg`);

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
        <sphereGeometry args={[3, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          emissive="#FFCC33"
          emissiveIntensity={1.5}
        />
        <pointLight intensity={250} distance={150} decay={1} color="#FFCC33" />
      </mesh>

      {/* Atmospheric Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[3.2, 64, 64]} />
        <meshBasicMaterial
          color="#FFCC33"
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
};

export default Sun;
