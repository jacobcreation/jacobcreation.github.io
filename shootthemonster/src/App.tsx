import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Projectile } from './types';
import { useGameLoop } from './hooks/useGameLoop';
import './styles/game.css';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 20;
const MONSTER_WIDTH = 80;
const MONSTER_HEIGHT = 80;
const PROJECTILE_WIDTH = 6;
const PROJECTILE_HEIGHT = 15;

const getInitialState = (): GameState => ({
  player: {
    id: 'player',
    x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: GAME_HEIGHT - 50,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    health: 100,
    maxHealth: 100,
    speed: 0.4,
  },
  monster: {
    id: 'monster',
    x: GAME_WIDTH / 2 - MONSTER_WIDTH / 2,
    y: 50,
    width: MONSTER_WIDTH,
    height: MONSTER_HEIGHT,
    health: 500,
    maxHealth: 500,
    speed: 0.2,
    direction: 1,
    lastShotTime: 0,
  },
  projectiles: [],
  status: 'idle',
  score: 0,
});

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(getInitialState());
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => (keysPressed.current[e.code] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keysPressed.current[e.code] = false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const checkCollision = (a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }) => {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  };

  const update = useCallback((delta: number) => {
    setGameState((prev) => {
      if (prev.status !== 'playing') return prev;

      const newState = { ...prev };
      const currentTime = Date.now();

      // Update Player Position
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
        newState.player.x = Math.max(0, newState.player.x - prev.player.speed * delta);
      }
      if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
        newState.player.x = Math.min(GAME_WIDTH - PLAYER_WIDTH, newState.player.x + prev.player.speed * delta);
      }

      // Player Shooting
      if (keysPressed.current['Space'] || keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) {
        const lastPlayerShot = prev.projectiles.filter(p => p.owner === 'player').pop();
        if (!lastPlayerShot || (currentTime - (lastPlayerShot.createdAt || 0) > 250)) {
          newState.projectiles.push({
            id: `p-${currentTime}`,
            x: newState.player.x + PLAYER_WIDTH / 2 - PROJECTILE_WIDTH / 2,
            y: newState.player.y - PROJECTILE_HEIGHT,
            width: PROJECTILE_WIDTH,
            height: PROJECTILE_HEIGHT,
            speed: -0.6,
            owner: 'player',
            damage: 20,
            createdAt: currentTime,
          });
        }
      }

      // Update Monster
      newState.monster.x += prev.monster.speed * prev.monster.direction * delta;
      if (newState.monster.x <= 0) {
        newState.monster.x = 0;
        newState.monster.direction = 1;
      } else if (newState.monster.x >= GAME_WIDTH - MONSTER_WIDTH) {
        newState.monster.x = GAME_WIDTH - MONSTER_WIDTH;
        newState.monster.direction = -1;
      }

      // Monster Shooting
      if (currentTime - prev.monster.lastShotTime > 1500) {
        newState.monster.lastShotTime = currentTime;
        newState.projectiles.push({
          id: `m-${currentTime}`,
          x: newState.monster.x + MONSTER_WIDTH / 2 - PROJECTILE_WIDTH / 2,
          y: newState.monster.y + MONSTER_HEIGHT,
          width: PROJECTILE_WIDTH,
          height: PROJECTILE_HEIGHT,
          speed: 0.3,
          owner: 'monster',
          damage: 10,
        });
      }

      // Update Projectiles & Collision
      newState.projectiles = prev.projectiles
        .map(p => ({ ...p, y: p.y + p.speed * delta }))
        .filter(p => p.y > -50 && p.y < GAME_HEIGHT + 50);

      const remainingProjectiles: Projectile[] = [];
      
      for (const p of newState.projectiles) {
        let hit = false;
        if (p.owner === 'player' && checkCollision(p, newState.monster)) {
          newState.monster.health -= p.damage;
          newState.score += 10;
          hit = true;
        } else if (p.owner === 'monster' && checkCollision(p, newState.player)) {
          newState.player.health -= p.damage;
          hit = true;
        }
        
        if (!hit) {
          remainingProjectiles.push(p);
        }
      }
      newState.projectiles = remainingProjectiles;

      // Win/Loss check
      if (newState.monster.health <= 0) {
        newState.status = 'won';
        newState.monster.health = 0;
      } else if (newState.player.health <= 0) {
        newState.status = 'lost';
        newState.player.health = 0;
      }

      return newState;
    });
  }, []);

  useGameLoop(update, gameState.status === 'playing');

  const startGame = () => setGameState({ ...getInitialState(), status: 'playing' });

  return (
    <div className="game-container">
      <div className="hud">
        <div className="player-health">
          <div className="health-bar-container">
            <div className="health-bar" style={{ width: `${(gameState.player.health / gameState.player.maxHealth) * 100}%` }}></div>
          </div>
          <div>PLAYER HP</div>
        </div>
        <div className="score">SCORE: {gameState.score}</div>
        <div className="monster-health">
          <div className="health-bar-container">
            <div className="health-bar" style={{ width: `${(gameState.monster.health / gameState.monster.maxHealth) * 100}%` }}></div>
          </div>
          <div>MONSTER HP</div>
        </div>
      </div>

      <div 
        className="player" 
        style={{ 
          left: gameState.player.x, 
          top: gameState.player.y, 
          width: gameState.player.width, 
          height: gameState.player.height 
        }}
      ></div>

      <div 
        className="monster" 
        style={{ 
          left: gameState.monster.x, 
          top: gameState.monster.y, 
          width: gameState.monster.width, 
          height: gameState.monster.height 
        }}
      ></div>

      {gameState.projectiles.map(p => (
        <div 
          key={p.id} 
          className={`projectile ${p.owner}`} 
          style={{ 
            left: p.x, 
            top: p.y, 
            width: p.width, 
            height: p.height 
          }}
        ></div>
      ))}

      {gameState.status !== 'playing' && (
        <div className="overlay">
          <h1>{gameState.status === 'idle' ? 'Shadow Duel' : gameState.status === 'won' ? 'Victory!' : 'Game Over'}</h1>
          {gameState.status !== 'idle' && <p>Final Score: {gameState.score}</p>}
          <button className="btn-start" onClick={startGame}>
            {gameState.status === 'idle' ? 'Start Mission' : 'Replay'}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
