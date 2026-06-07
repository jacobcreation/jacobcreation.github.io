export interface RingData {
  innerRadius: number;
  outerRadius: number;
  textureUrl: string;
}

export interface PlanetData {
  name: string;
  color: string;
  radius: number;
  distance: number;
  speed: number;
  textureUrl: string;
  description: string;
  facts: string[];
  orbitTilt?: number;
  category?: string;
  ring?: RingData;
}

export interface StarData {
  name: string;
  color: string;
  radius: number;
  textureUrl: string;
  emissiveColor: string;
  lightIntensity: number;
  lightDistance: number;
}

export interface StarSystemData {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  background: string;
  star: StarData;
  camera: {
    position: [number, number, number];
    minDistance: number;
    maxDistance: number;
  };
  bodies: PlanetData[];
}

const TEXTURE_BASE = `${import.meta.env.BASE_URL}textures`;

const createTexture = (primary: string, secondary: string, accent: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="planet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="55%" stop-color="${secondary}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#planet)" />
      <circle cx="150" cy="140" r="80" fill="#FFFFFF" fill-opacity="0.14" />
      <path d="M0 360 C120 320, 220 430, 512 340 L512 512 L0 512 Z" fill="#000000" fill-opacity="0.18" />
      <path d="M0 200 C150 150, 300 240, 512 170" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="34" stroke-linecap="round" />
      <path d="M0 250 C120 210, 260 280, 512 220" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="18" stroke-linecap="round" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const createStarTexture = (color: string) => createTexture(color, "#FFFFFF", color);

const createPlanet = (
  name: string,
  color: string,
  radius: number,
  distance: number,
  speed: number,
  textureUrl: string,
  description: string,
  facts: string[],
  orbitTilt = 0,
  category?: string,
  ring?: RingData
): PlanetData => ({
  name,
  color,
  radius,
  distance,
  speed,
  textureUrl,
  description,
  facts,
  orbitTilt,
  category,
  ring
});

export const planets: PlanetData[] = [
  createPlanet(
    "Mercury",
    "#A5A5A5",
    0.4,
    5,
    0.04,
    `${TEXTURE_BASE}/2k_mercury.jpg`,
    "The smallest and innermost planet in the Solar System.",
    [
      "Mercury is the closest planet to the Sun.",
      "A year on Mercury is only 88 Earth days long.",
      "It has no atmosphere and no moons."
    ],
    7,
    "Rocky world"
  ),
  createPlanet(
    "Venus",
    "#E3BB76",
    0.9,
    8,
    0.015,
    `${TEXTURE_BASE}/2k_venus_atmosphere.jpg`,
    "Often called Earth's twin because of its similar size and mass.",
    [
      "Venus is the hottest planet in our solar system.",
      "It rotates in the opposite direction to most planets.",
      "One day on Venus is longer than one year."
    ],
    3,
    "Rocky world"
  ),
  createPlanet(
    "Earth",
    "#2271B3",
    1,
    12,
    0.01,
    `${TEXTURE_BASE}/2k_earth_daymap.jpg`,
    "Our home planet and the only known world to harbor life.",
    [
      "Earth is the only planet not named after a god.",
      "About 71% of Earth's surface is water.",
      "It has one moon and a powerful magnetic field."
    ],
    0,
    "Habitable world"
  ),
  createPlanet(
    "Mars",
    "#E27B58",
    0.5,
    16,
    0.008,
    `${TEXTURE_BASE}/2k_mars.jpg`,
    "The Red Planet, home to the largest volcano in the solar system.",
    [
      "Mars is home to Olympus Mons, the tallest mountain in the solar system.",
      "It has two moons, Phobos and Deimos.",
      "Iron oxide (rust) gives the planet its red color."
    ],
    1,
    "Rocky world"
  ),
  createPlanet(
    "Jupiter",
    "#D39C7E",
    2.5,
    24,
    0.004,
    `${TEXTURE_BASE}/2k_jupiter.jpg`,
    "The largest planet in the Solar System, a gas giant.",
    [
      "Jupiter is more than twice as massive as all other planets combined.",
      "It has a Great Red Spot, a storm that has lasted for centuries.",
      "Jupiter has at least 79 known moons."
    ],
    -1,
    "Gas giant"
  ),
  createPlanet(
    "Saturn",
    "#C5AB6E",
    2.1,
    32,
    0.003,
    `${TEXTURE_BASE}/2k_saturn.jpg`,
    "Famous for its extensive and complex ring system.",
    [
      "Saturn's rings are made of ice, dust, and rocks.",
      "It is the least dense planet in the solar system.",
      "Saturn has 82 moons, more than any other planet."
    ],
    2,
    "Gas giant",
    {
      innerRadius: 2.5,
      outerRadius: 5,
      textureUrl: `${TEXTURE_BASE}/2k_saturn_ring_alpha.png`
    }
  ),
  createPlanet(
    "Uranus",
    "#B5E3E3",
    1.5,
    40,
    0.002,
    `${TEXTURE_BASE}/2k_uranus.jpg`,
    "An ice giant that rotates on its side.",
    [
      "Uranus was the first planet discovered with a telescope.",
      "It rotates on an axis that is tilted nearly 90 degrees.",
      "Uranus has 27 known moons."
    ],
    0,
    "Ice giant"
  ),
  createPlanet(
    "Neptune",
    "#6081FF",
    1.5,
    46,
    0.001,
    `${TEXTURE_BASE}/2k_neptune.jpg`,
    "The most distant major planet orbiting our Sun.",
    [
      "Neptune is the windiest planet in the solar system.",
      "It is nearly 4.5 billion kilometers from the Sun.",
      "Neptune has 14 known moons."
    ],
    -2,
    "Ice giant"
  )
];

const trappistTexture = (primary: string, secondary: string, accent: string) =>
  createTexture(primary, secondary, accent);

export const starSystems: StarSystemData[] = [
  {
    id: "solar-system",
    name: "Solar System",
    tagline: "Home system",
    description: "The familiar Sun-centered system with rocky worlds, gas giants, and the ringed giants beyond the asteroid belt.",
    accent: "#4DA3FF",
    background: "#02040a",
    star: {
      name: "Sun",
      color: "#FFCC33",
      radius: 3,
      textureUrl: `${TEXTURE_BASE}/2k_sun.jpg`,
      emissiveColor: "#FFCC33",
      lightIntensity: 250,
      lightDistance: 150
    },
    camera: {
      position: [30, 30, 30],
      minDistance: 5,
      maxDistance: 100
    },
    bodies: planets
  },
  {
    id: "trappist-1",
    name: "TRAPPIST-1",
    tagline: "Compact red-dwarf system",
    description: "Seven Earth-sized worlds packed into a tiny orbital dance around an ultra-cool red dwarf star.",
    accent: "#FF6B5C",
    background: "#14070b",
    star: {
      name: "TRAPPIST-1",
      color: "#FF6B5C",
      radius: 2.2,
      textureUrl: createStarTexture("#FF6B5C"),
      emissiveColor: "#FF8A6A",
      lightIntensity: 150,
      lightDistance: 80
    },
    camera: {
      position: [18, 14, 18],
      minDistance: 2.5,
      maxDistance: 40
    },
    bodies: [
      createPlanet(
        "TRAPPIST-1 b",
        "#B5A06E",
        0.42,
        3.2,
        0.14,
        trappistTexture("#5C4B3B", "#B58B63", "#E2C7A1"),
        "A scorching rocky world that hugs the star tightly.",
        [
          "TRAPPIST-1 b orbits in less than two Earth days.",
          "Its surface is likely tidally locked to its star.",
          "It is one of the system's innermost planets."
        ],
        8,
        "Rocky world"
      ),
      createPlanet(
        "TRAPPIST-1 c",
        "#7A6AB8",
        0.46,
        4.5,
        0.11,
        trappistTexture("#43356D", "#8470D9", "#B6ABFF"),
        "A dense, hot planet with a moody violet palette.",
        [
          "TRAPPIST-1 c is slightly larger than Earth.",
          "It receives far more energy than Earth does.",
          "The system's compact spacing makes its sky feel crowded."
        ],
        -7,
        "Rocky world"
      ),
      createPlanet(
        "TRAPPIST-1 d",
        "#72C6B0",
        0.38,
        5.7,
        0.095,
        trappistTexture("#225B57", "#5DA39E", "#B7F0E4"),
        "A small, cool world near the edge of the habitable zone.",
        [
          "TRAPPIST-1 d is among the system's smallest planets.",
          "Scientists watch it closely as a possible water-bearing world.",
          "Its orbit is just a few days long."
        ],
        3,
        "Potentially temperate"
      ),
      createPlanet(
        "TRAPPIST-1 e",
        "#4E9FC9",
        0.5,
        7.2,
        0.082,
        trappistTexture("#124A6E", "#3F7FA0", "#8ED5F0"),
        "A favorite target in habitability studies.",
        [
          "TRAPPIST-1 e sits in the middle of the system's habitable zone.",
          "It may have a rocky surface and a thin atmosphere.",
          "Its daylight would be dim and red."
        ],
        0,
        "Potentially temperate"
      ),
      createPlanet(
        "TRAPPIST-1 f",
        "#D59D63",
        0.52,
        8.8,
        0.07,
        trappistTexture("#7A4C22", "#C88643", "#F3D4A8"),
        "A slightly cooler world with a desert-like tone.",
        [
          "TRAPPIST-1 f may be more icy than Earth.",
          "It completes an orbit in just over a week.",
          "Compact systems make resonant orbital chains possible."
        ],
        10,
        "Rocky world"
      ),
      createPlanet(
        "TRAPPIST-1 g",
        "#A7D96E",
        0.56,
        10.5,
        0.058,
        trappistTexture("#3E6E23", "#89B94D", "#D9F6AA"),
        "One of the largest rocky members of the family.",
        [
          "TRAPPIST-1 g is a promising candidate for atmospheric follow-up.",
          "It likely experiences very long red sunsets.",
          "The planet may retain volatile-rich layers."
        ],
        -4,
        "Rocky world"
      ),
      createPlanet(
        "TRAPPIST-1 h",
        "#9FC3E2",
        0.34,
        12.3,
        0.045,
        trappistTexture("#506E8B", "#9FC3E2", "#D9EEFF"),
        "A cold outer planet circling the dim red dwarf.",
        [
          "TRAPPIST-1 h is the outermost known planet in the system.",
          "It sits far from the star by system standards, but still very close in absolute terms.",
          "Its cold conditions may support surface ice."
        ],
        6,
        "Outer rocky world"
      )
    ]
  },
  {
    id: "kepler-90",
    name: "Kepler-90",
    tagline: "Eight-planet system",
    description: "A tightly packed star system with planets stretching from scorched inner worlds to distant icy ones.",
    accent: "#88C9FF",
    background: "#071018",
    star: {
      name: "Kepler-90",
      color: "#FFE2AA",
      radius: 2.6,
      textureUrl: createStarTexture("#FFE2AA"),
      emissiveColor: "#FFD277",
      lightIntensity: 180,
      lightDistance: 110
    },
    camera: {
      position: [24, 18, 24],
      minDistance: 4,
      maxDistance: 60
    },
    bodies: [
      createPlanet(
        "Kepler-90 b",
        "#D39A6A",
        0.45,
        4.2,
        0.12,
        createTexture("#C76B32", "#D39A6A", "#F0D0A8"),
        "A blistering inner world that skims close to its star.",
        [
          "Kepler-90 b is in one of the system's shortest orbits.",
          "The planet likely endures intense heat.",
          "Its surface is represented here with warm desert tones."
        ],
        5,
        "Hot rocky world"
      ),
      createPlanet(
        "Kepler-90 c",
        "#8FA4D8",
        0.5,
        5.8,
        0.102,
        createTexture("#405D9F", "#8FA4D8", "#D8E4FF"),
        "A cool-toned rocky world on a near-resonant orbit.",
        [
          "This planet sits in the inner compact cluster.",
          "The spacing between planets is dramatically tighter than our Solar System.",
          "Its palette leans toward blue-gray mineral tones."
        ],
        -8,
        "Rocky world"
      ),
      createPlanet(
        "Kepler-90 d",
        "#98D5C9",
        0.62,
        7.6,
        0.09,
        createTexture("#2E8C85", "#98D5C9", "#F0FFF9"),
        "A temperate-looking planet with a bright oceanic tint.",
        [
          "Kepler-90 d sits in the middle of the system's packed lineup.",
          "It may have thick clouds or a reflective atmosphere.",
          "The system's architecture is a great example of migration."
        ],
        0,
        "Potentially temperate"
      ),
      createPlanet(
        "Kepler-90 e",
        "#D0A56C",
        0.7,
        10.1,
        0.075,
        createTexture("#7D5630", "#D0A56C", "#F7DDB6"),
        "A larger body with a warm, metallic surface feel.",
        [
          "Kepler-90 e is one of the more substantial planets in the system.",
          "It likely formed farther out before moving inward.",
          "Its orbit still completes in far less than an Earth year."
        ],
        4,
        "Super-Earth"
      ),
      createPlanet(
        "Kepler-90 f",
        "#A6B0B8",
        0.78,
        13.2,
        0.06,
        createTexture("#63707A", "#A6B0B8", "#E2E7EA"),
        "A calm-looking super-Earth with a subdued mineral tone.",
        [
          "Kepler-90 f widens the orbital chain before the outer planets.",
          "Its appearance is intentionally quieter than the inner worlds.",
          "The system remains highly compact even this far out."
        ],
        -2,
        "Super-Earth"
      ),
      createPlanet(
        "Kepler-90 g",
        "#87C6A4",
        0.9,
        17.2,
        0.05,
        createTexture("#2F7A55", "#87C6A4", "#D8F6D2"),
        "A greener outer world with a gentle glow.",
        [
          "Kepler-90 g is part of the outer half of the system.",
          "Its orbit suggests a cooler environment than the inner planets.",
          "Long-period planets are easier to study for transit timing variations."
        ],
        7,
        "Sub-Neptune"
      ),
      createPlanet(
        "Kepler-90 h",
        "#D1C28A",
        1.08,
        22.5,
        0.04,
        createTexture("#8E7951", "#D1C28A", "#FFF2C3"),
        "A pale gas-rich planet at the edge of the visible cluster.",
        [
          "Kepler-90 h is one of the outermost known planets in the system.",
          "It may carry a thick gaseous envelope.",
          "The farther planets help show how tightly all eight worlds fit together."
        ],
        -5,
        "Sub-Neptune"
      ),
      createPlanet(
        "Kepler-90 i",
        "#90A8FF",
        1.12,
        28.5,
        0.032,
        createTexture("#4B61C9", "#90A8FF", "#E6ECFF"),
        "A distant blue-ice planet completing the family portrait.",
        [
          "Kepler-90 i is the system's outermost known world.",
          "It stretches the system to a surprisingly broad extent.",
          "This kind of discovery proved that compact systems can be surprisingly rich."
        ],
        2,
        "Ice giant"
      )
    ]
  }
];
