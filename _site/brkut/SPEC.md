# Breakout Game Specification

## Project Overview
- **Project name**: Neon Breakout
- **Type**: Browser-based arcade game (single HTML file)
- **Core functionality**: Classic brick-breaking game with colorful neon aesthetics and particle effects
- **Target users**: Casual gamers

## UI/UX Specification

### Layout Structure
- Full viewport game canvas centered on screen
- Canvas size: 800x600 pixels
- Dark background with subtle gradient

### Visual Design

**Color Palette**
- Background: `#0a0a1a` (deep navy)
- Paddle: `#00ffff` (cyan) with glow
- Ball: `#ffffff` (white) with trail
- Brick colors (by row):
  - Row 1: `#ff006e` (hot pink)
  - Row 2: `#ff8500` (orange)
  - Row 3: `#ffdd00` (yellow)
  - Row 4: `#00ff88` (mint green)
  - Row 5: `#00a8ff` (electric blue)
  - Row 6: `#aa00ff` (purple)

**Typography**
- Font: "Orbitron" (Google Fonts) - futuristic display font
- Score/Lives: 24px
- Game Over/Start: 48px

**Visual Effects**
- Glowing borders on paddle and ball
- Particle explosions when bricks break
- Ball trail effect
- Screen shake on life lost
- Pulsing glow on bricks

### Components
- Paddle: Rectangular, controllable, glowing edge
- Ball: Circular, bounces realistically
- Bricks: Rectangular grid, 10 columns x 6 rows
- Score display: Top-left corner
- Lives display: Top-right corner

## Functionality Specification

### Core Features
1. **Paddle Control**: Mouse movement controls paddle horizontal position
2. **Ball Physics**: Bounces off walls, paddle, and bricks with angle based on paddle hit position
3. **Brick Destruction**: Bricks disappear on ball contact, score increases
4. **Lives System**: 3 lives, game over at 0
5. **Level Completion**: All bricks destroyed = win, show celebration
6. **Particle Effects**: 10-15 particles burst from destroyed bricks
7. **Sound Effects**: Optional (visual feedback preferred)

### User Interactions
- Click to start game
- Mouse to move paddle
- Ball launches from paddle on start

### Edge Cases
- Ball stuck in horizontal loop: add slight random angle
- Paddle at screen edge: clamp position

## Acceptance Criteria
- [x] Game loads without errors
- [x] Paddle follows mouse smoothly
- [x] Ball bounces correctly off all surfaces
- [x] Bricks break with particle effect
- [x] Score updates on brick hit
- [x] Lives decrease when ball falls
- [x] Game over screen when lives = 0
- [x] Win screen when all bricks destroyed
- [x] Click to restart after game over/win