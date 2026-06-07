import { useMemo, useState } from 'react';
import SolarSystem from './components/SolarSystem';
import Controls from './components/UI/Controls';
import InfoPanel from './components/UI/InfoPanel';
import PlanetList from './components/UI/PlanetList';
import ErrorBoundary from './components/ErrorBoundary';
import { starSystems, type PlanetData } from './data/planets';

function App() {
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeSystemId, setActiveSystemId] = useState(starSystems[0].id);
  const [focusedPlanet, setFocusedPlanet] = useState<PlanetData | null>(null);
  const [cameraResetTick, setCameraResetTick] = useState(0);

  const activeSystem = useMemo(
    () => starSystems.find((system) => system.id === activeSystemId) ?? starSystems[0],
    [activeSystemId]
  );

  const handleSelectSystem = (systemId: string) => {
    setActiveSystemId(systemId);
    setFocusedPlanet(null);
  };

  const handleNextSystem = () => {
    const currentIndex = starSystems.findIndex((system) => system.id === activeSystemId);
    const nextIndex = (currentIndex + 1) % starSystems.length;
    handleSelectSystem(starSystems[nextIndex].id);
  };

  const handleResetCamera = () => {
    setFocusedPlanet(null);
    setCameraResetTick((tick) => tick + 1);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(77,163,255,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,107,92,0.10),transparent_30%)]" />

      {/* 3D Scene */}
      <ErrorBoundary>
        <SolarSystem
          simulationSpeed={simulationSpeed}
          showOrbits={showOrbits}
          showLabels={showLabels}
          focusedPlanet={focusedPlanet}
          onSelectPlanet={setFocusedPlanet}
          activeSystem={activeSystem}
          cameraResetTick={cameraResetTick}
        />
      </ErrorBoundary>

      {/* UI Overlay */}
      <PlanetList
        activeSystemId={activeSystemId}
        onSelectSystem={handleSelectSystem}
        onSelect={setFocusedPlanet}
        focusedPlanet={focusedPlanet}
      />

      <InfoPanel
        planet={focusedPlanet}
        systemName={activeSystem.name}
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
        onNextSystem={handleNextSystem}
      />

      <div className="fixed bottom-6 right-8 text-right pointer-events-none z-50 max-w-sm">
        <p className="text-white/40 text-xs font-medium tracking-[0.35em] uppercase">
          Star System Explorer
        </p>
        <h1 className="text-white font-bold text-2xl tracking-tighter uppercase opacity-90">
          {activeSystem.name} <span className="text-blue-400">Tour</span>
        </h1>
        <p className="text-white/60 text-sm leading-relaxed mt-1">
          {activeSystem.description}
        </p>
      </div>
    </div>
  );
}

export default App;
