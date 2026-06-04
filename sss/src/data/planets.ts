export interface PlanetData {
  name: string;
  color: string;
  radius: number;
  distance: number;
  speed: number;
  textureUrl: string;
  description: string;
  facts: string[];
  ring?: {
    innerRadius: number;
    outerRadius: number;
    textureUrl: string;
  };
}

const TEXTURE_BASE = `${import.meta.env.BASE_URL}textures`;

export const planets: PlanetData[] = [
  {
    name: "Mercury",
    color: "#A5A5A5",
    radius: 0.4,
    distance: 5,
    speed: 0.04,
    textureUrl: `${TEXTURE_BASE}/2k_mercury.jpg`,
    description: "The smallest and innermost planet in the Solar System.",
    facts: [
      "Mercury is the closest planet to the Sun.",
      "A year on Mercury is only 88 Earth days long.",
      "It has no atmosphere and no moons."
    ]
  },
  {
    name: "Venus",
    color: "#E3BB76",
    radius: 0.9,
    distance: 8,
    speed: 0.015,
    textureUrl: `${TEXTURE_BASE}/2k_venus_atmosphere.jpg`,
    description: "Often called Earth's twin because of its similar size and mass.",
    facts: [
      "Venus is the hottest planet in our solar system.",
      "It rotates in the opposite direction to most planets.",
      "One day on Venus is longer than one year."
    ]
  },
  {
    name: "Earth",
    color: "#2271B3",
    radius: 1,
    distance: 12,
    speed: 0.01,
    textureUrl: `${TEXTURE_BASE}/2k_earth_daymap.jpg`,
    description: "Our home planet and the only known world to harbor life.",
    facts: [
      "Earth is the only planet not named after a god.",
      "About 71% of Earth's surface is water.",
      "It has one moon and a powerful magnetic field."
    ]
  },
  {
    name: "Mars",
    color: "#E27B58",
    radius: 0.5,
    distance: 16,
    speed: 0.008,
    textureUrl: `${TEXTURE_BASE}/2k_mars.jpg`,
    description: "The Red Planet, home to the largest volcano in the solar system.",
    facts: [
      "Mars is home to Olympus Mons, the tallest mountain in the solar system.",
      "It has two moons, Phobos and Deimos.",
      "Iron oxide (rust) gives the planet its red color."
    ]
  },
  {
    name: "Jupiter",
    color: "#D39C7E",
    radius: 2.5,
    distance: 24,
    speed: 0.004,
    textureUrl: `${TEXTURE_BASE}/2k_jupiter.jpg`,
    description: "The largest planet in the Solar System, a gas giant.",
    facts: [
      "Jupiter is more than twice as massive as all other planets combined.",
      "It has a Great Red Spot, a storm that has lasted for centuries.",
      "Jupiter has at least 79 known moons."
    ]
  },
  {
    name: "Saturn",
    color: "#C5AB6E",
    radius: 2.1,
    distance: 32,
    speed: 0.003,
    textureUrl: `${TEXTURE_BASE}/2k_saturn.jpg`,
    description: "Famous for its extensive and complex ring system.",
    facts: [
      "Saturn's rings are made of ice, dust, and rocks.",
      "It is the least dense planet in the solar system.",
      "Saturn has 82 moons, more than any other planet."
    ],
    ring: {
      innerRadius: 2.5,
      outerRadius: 5,
      textureUrl: `${TEXTURE_BASE}/2k_saturn_ring_alpha.png`
    }
  },
  {
    name: "Uranus",
    color: "#B5E3E3",
    radius: 1.5,
    distance: 40,
    speed: 0.002,
    textureUrl: `${TEXTURE_BASE}/2k_uranus.jpg`,
    description: "An ice giant that rotates on its side.",
    facts: [
      "Uranus was the first planet discovered with a telescope.",
      "It rotates on an axis that is tilted nearly 90 degrees.",
      "Uranus has 27 known moons."
    ]
  },
  {
    name: "Neptune",
    color: "#6081FF",
    radius: 1.5,
    distance: 46,
    speed: 0.001,
    textureUrl: `${TEXTURE_BASE}/2k_neptune.jpg`,
    description: "The most distant major planet orbiting our Sun.",
    facts: [
      "Neptune is the windiest planet in the solar system.",
      "It is nearly 4.5 billion kilometers from the Sun.",
      "Neptune has 14 known moons."
    ]
  }
];
