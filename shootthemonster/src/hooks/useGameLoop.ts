import { useEffect, useRef } from 'react';

export const useGameLoop = (callback: (delta: number) => void, active: boolean) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = (time: number) => {
    if (previousTimeRef.current > 0) {
      const deltaTime = Math.min(time - previousTimeRef.current, 100); // Cap at 100ms
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (active) {
      previousTimeRef.current = 0; // Reset on start
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [active, callback]);
};
