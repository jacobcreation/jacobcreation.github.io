import { useState } from 'react';
import SolarSystem from './components/SolarSystem';
import Controls from './components/UI/Controls';
import InfoPanel from './components/UI/InfoPanel';
import PlanetList from './components/UI/PlanetList';
import ErrorBoundary from './components/ErrorBoundary';
import type { PlanetData } from './data/planets';

function App() {
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [focusedPlanet, setFocusedPlanet] = useState<PlanetData | null>(null);

  const handleResetCamera = () => {
    setFocusedPlanet(null);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      {/* 3D Scene */}
      <ErrorBoundary>
        <SolarSystem
          simulationSpeed={simulationSpeed}
          showOrbits={showOrbits}
          showLabels={showLabels}
          focusedPlanet={focusedPlanet}
          onSelectPlanet={setFocusedPlanet}
        />
      </ErrorBoundary>

      {/* UI Overlay */}
      <PlanetList 
        onSelect={setFocusedPlanet} 
        focusedPlanet={focusedPlanet} 
      />

      <InfoPanel 
        planet={focusedPlanet} 
        onClose={() => setFocusedPlanet(null)} 
      />

      <Controls
        simulationSpeed={simulationSpeed}
        setSimulationSpeed={setSimulationSpeed}
        showOrbits={showOrbits}
        setShowOrbits={setShowOrbits}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        onResetCamera={handleResetCamera}
      />

      {/* Title / Watermark */}
      <div className="fixed bottom-6 right-8 text-right pointer-events-none z-50">
        <h1 className="text-white font-bold text-2xl tracking-tighter uppercase opacity-80">
          Solar <span className="text-blue-500">System</span>
        </h1>
        <p className="text-white/40 text-xs font-medium tracking-[0.2em]">
          Interactive Simulator
        </p>
      </div>
    </div>
  );
}

export default App;
