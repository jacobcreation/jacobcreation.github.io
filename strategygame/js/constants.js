export const GRID_SIZE = 8;
export const TICK_RATE = 500; // ms per tick

export const UNIT_TYPES = {
    TANK: {
        name: 'Tank',
        hp: 150,
        damage: 10,
        range: 1,
        speed: 1,
        cost: 3,
        color: '#00f3ff',
        icon: '🛡️'
    },
    ASSASSIN: {
        name: 'Assassin',
        hp: 60,
        damage: 25,
        range: 1,
        speed: 1,
        cost: 4,
        color: '#ff00ff',
        icon: '🗡️'
    },
    RANGER: {
        name: 'Ranger',
        hp: 80,
        damage: 15,
        range: 3,
        speed: 1,
        cost: 3,
        color: '#39ff14',
        icon: '🏹'
    }
};

export const INITIAL_GOLD = 20;       // More starting gold
export const ROUND_INCOME = 5;        // Gold per round
export const WIN_GOLD = 6;
export const LOSS_GOLD = 3;
export const REROLL_COST = 2;
export const SHOP_SIZE = 4;           // One extra shop slot
export const SCOUT_DURATION = 3000;   // ms to view enemy before placing
