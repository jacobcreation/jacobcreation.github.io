import { starSystems, type PlanetData } from '../../data/planets';

interface PlanetListProps {
  activeSystemId: string;
  onSelectSystem: (systemId: string) => void;
  onSelect: (planet: PlanetData) => void;
  focusedPlanet: PlanetData | null;
}

const PlanetList = ({ activeSystemId, onSelectSystem, onSelect, focusedPlanet }: PlanetListProps) => {
  const activeSystem = starSystems.find((system) => system.id === activeSystemId) ?? starSystems[0];

  return (
    <div className="fixed top-6 left-6 z-50 w-[19rem] space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-3 shadow-2xl shadow-black/30">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Star Systems</p>
        <div className="space-y-2">
          {starSystems.map((system) => (
            <button
              key={system.id}
              onClick={() => onSelectSystem(system.id)}
              className={`w-full px-3 py-3 rounded-xl text-left transition-all border ${
                activeSystemId === system.id
                  ? 'bg-white text-black border-white'
                  : 'bg-white/0 text-white/75 border-white/10 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{system.name}</div>
                  <div className={`text-[11px] ${activeSystemId === system.id ? 'text-black/60' : 'text-white/40'}`}>
                    {system.tagline}
                  </div>
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: system.accent }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-3 shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Current System</p>
            <h2 className="text-white text-base font-semibold">{activeSystem.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Bodies</p>
            <p className="text-white text-sm font-semibold">{activeSystem.bodies.length}</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
          {activeSystem.bodies.map((planet) => (
            <button
              key={planet.name}
              onClick={() => onSelect(planet)}
              className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left flex items-center gap-3 border ${
                focusedPlanet?.name === planet.name
                  ? 'bg-white text-black border-white'
                  : 'bg-white/0 text-white/70 border-white/10 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: planet.color }}
              />
              <span className="flex-1">{planet.name}</span>
              {planet.category && (
                <span className={`text-[10px] uppercase tracking-[0.18em] ${focusedPlanet?.name === planet.name ? 'text-black/50' : 'text-white/35'}`}>
                  {planet.category}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlanetList;
