export const GRID_SIZE = 8;
export const TICK_RATE = 500; // ms per tick

export const UNIT_TYPES = {
    TANK: {
        name: 'Tank',
        hp: 150,
        damage: 10,
        range: 1,
        speed: 1, // Attacks every X ticks
        cost: 3,
        color: '#00f3ff', // Cyan
        icon: '🛡️'
    },
    ASSASSIN: {
        name: 'Assassin',
        hp: 60,
        damage: 25,
        range: 1,
        speed: 1,
        cost: 4,
        color: '#ff00ff', // Magenta
        icon: '🗡️'
    },
    RANGER: {
        name: 'Ranger',
        hp: 80,
        damage: 15,
        range: 3,
        speed: 1,
        cost: 3,
        color: '#39ff14', // Lime
        icon: '🏹'
    }
};

export const INITIAL_GOLD = 10;
export const WIN_GOLD = 5;
export const LOSS_GOLD = 2;
export const REROLL_COST = 2;
export const SHOP_SIZE = 3;
