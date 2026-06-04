export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player extends Entity {
  health: number;
  maxHealth: number;
  speed: number;
}

export interface Monster extends Entity {
  health: number;
  maxHealth: number;
  speed: number;
  direction: 1 | -1;
  lastShotTime: number;
}

export interface Projectile extends Entity {
  speed: number;
  owner: 'player' | 'monster';
  damage: number;
  createdAt?: number;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface GameState {
  player: Player;
  monster: Monster;
  projectiles: Projectile[];
  status: GameStatus;
  score: number;
}
