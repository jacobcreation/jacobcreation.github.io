import { X, Info } from 'lucide-react';
import type { PlanetData } from '../../data/planets';

interface InfoPanelProps {
  planet: PlanetData | null;
  systemName: string;
  onClose: () => void;
}

const InfoPanel = ({ planet, systemName, onClose }: InfoPanelProps) => {
  if (!planet) return null;

  return (
    <div className="fixed top-6 right-6 w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl text-white overflow-hidden z-50 animate-in fade-in slide-in-from-right-4 duration-300">
      <div
        className="h-32 w-full relative"
        style={{ backgroundColor: planet.color + '33' }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center text-6xl opacity-20 pointer-events-none"
        >
          {planet.name[0]}
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
        <div className="absolute bottom-4 left-6">
          <h2 className="text-3xl font-bold tracking-tight">{planet.name}</h2>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">System</p>
            <p className="text-white/80 text-sm">{systemName}</p>
          </div>
          {planet.category && (
            <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/60">
              {planet.category}
            </div>
          )}
        </div>

        <p className="text-white/70 text-sm leading-relaxed">
          {planet.description}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Orbit</p>
            <p className="text-white text-sm font-semibold">{planet.distance.toFixed(1)} units</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Speed</p>
            <p className="text-white text-sm font-semibold">{planet.speed.toFixed(3)} angular</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <Info size={14} />
            Key Facts
          </h3>
          <ul className="space-y-3">
            {planet.facts.map((fact, i) => (
              <li key={i} className="text-sm flex gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span className="text-white/80">{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;
