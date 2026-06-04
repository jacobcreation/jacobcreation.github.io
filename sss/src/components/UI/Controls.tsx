import { Pause, RotateCcw, Orbit, Tag } from 'lucide-react';

interface ControlsProps {
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  showOrbits: boolean;
  setShowOrbits: (show: boolean) => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  onResetCamera: () => void;
}

const Controls = ({
  simulationSpeed,
  setSimulationSpeed,
  showOrbits,
  setShowOrbits,
  showLabels,
  setShowLabels,
  onResetCamera
}: ControlsProps) => {
  const speeds = [0, 1, 5, 10, 20];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full z-50">
      <div className="flex items-center gap-2 border-r border-white/10 pr-4">
        {speeds.map((speed) => (
          <button
            key={speed}
            onClick={() => setSimulationSpeed(speed)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              simulationSpeed === speed
                ? 'bg-white text-black font-bold'
                : 'text-white hover:bg-white/10'
            }`}
          >
            {speed === 0 ? <Pause size={18} /> : `${speed}x`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowOrbits(!showOrbits)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            showOrbits ? 'bg-blue-500 text-white' : 'text-white hover:bg-white/10'
          }`}
          title="Toggle Orbits"
        >
          <Orbit size={18} />
        </button>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            showLabels ? 'bg-blue-500 text-white' : 'text-white hover:bg-white/10'
          }`}
          title="Toggle Labels"
        >
          <Tag size={18} />
        </button>
        <button
          onClick={onResetCamera}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all"
          title="Reset Camera"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
};

export default Controls;
