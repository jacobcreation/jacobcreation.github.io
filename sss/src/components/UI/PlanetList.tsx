import { planets, type PlanetData } from '../../data/planets';

interface PlanetListProps {
  onSelect: (planet: PlanetData) => void;
  focusedPlanet: PlanetData | null;
}

const PlanetList = ({ onSelect, focusedPlanet }: PlanetListProps) => {
  return (
    <div className="fixed top-6 left-6 flex flex-col gap-2 z-50">
      {planets.map((planet) => (
        <button
          key={planet.name}
          onClick={() => onSelect(planet)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-3 border ${
            focusedPlanet?.name === planet.name
              ? 'bg-white text-black border-white'
              : 'bg-black/40 text-white/60 border-white/10 hover:bg-black/60 hover:text-white'
          }`}
        >
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: planet.color }}
          />
          {planet.name}
        </button>
      ))}
    </div>
  );
};

export default PlanetList;
