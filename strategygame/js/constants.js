export const GRID_SIZE = 8;
export const PLAYER_ZONE_START = GRID_SIZE / 2;
export const BASE_TICK_RATE = 500;
export const BATTLE_SPEED_OPTIONS = [1, 2, 3];
export const LOG_LIMIT = 28;

export const UNIT_TYPES = {
    BULWARK: {
        name: 'Bulwark',
        role: 'Tank',
        description: 'Massive frontline anchor that soaks pressure and locks lanes.',
        hp: 190,
        damage: 11,
        range: 1,
        speed: 2,
        cost: 4,
        color: '#7df9ff',
        icon: '🛡️',
        preferredBand: 'front'
    },
    ASSASSIN: {
        name: 'Assassin',
        role: 'Duelist',
        description: 'Fast melee finisher that erases fragile targets.',
        hp: 70,
        damage: 26,
        range: 1,
        speed: 1,
        cost: 4,
        color: '#ff9d6c',
        icon: '🗡️',
        preferredBand: 'front'
    },
    RANGER: {
        name: 'Ranger',
        role: 'Marksman',
        description: 'Reliable backline damage with safe reach.',
        hp: 90,
        damage: 16,
        range: 3,
        speed: 1,
        cost: 3,
        color: '#9eff7a',
        icon: '🏹',
        preferredBand: 'back'
    },
    BRUISER: {
        name: 'Bruiser',
        role: 'Juggernaut',
        description: 'Heavy brawler that turns open space into a damage race.',
        hp: 125,
        damage: 20,
        range: 1,
        speed: 1,
        cost: 4,
        color: '#ffc857',
        icon: '🔨',
        preferredBand: 'front'
    },
    SNIPER: {
        name: 'Sniper',
        role: 'Artillery',
        description: 'Long-range pick unit that punishes exposed backliners.',
        hp: 60,
        damage: 31,
        range: 4,
        speed: 2,
        cost: 5,
        color: '#f7f4a5',
        icon: '🎯',
        preferredBand: 'back'
    },
    SENTINEL: {
        name: 'Sentinel',
        role: 'Controller',
        description: 'Midline defender with balanced health, reach, and pressure.',
        hp: 110,
        damage: 14,
        range: 2,
        speed: 1,
        cost: 3,
        color: '#7cf0d4',
        icon: '⚙️',
        preferredBand: 'mid'
    }
};

export const INITIAL_GOLD = 20;
export const ROUND_INCOME = 5;
export const WIN_GOLD = 6;
export const LOSS_GOLD = 3;
export const REROLL_COST = 2;
export const SHOP_SIZE = 5;
export const SCOUT_DURATION = 5000;
