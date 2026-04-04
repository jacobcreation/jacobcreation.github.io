# Dustline Driver

A lightweight 3D car simulator built with Three.js. It includes:

- Arcade driving with acceleration, braking, steering, and boost
- Endless chunked city generation with roads, buildings, parks, benches, and trees
- Civilian traffic cars that drive around the city grid
- Walking pedestrians on sidewalks and through parks
- Wanted-level gameplay with police cars that chase and bust you if they catch up
- Collision damage, score tracking, and local best-score persistence

## Run it

Serve the folder with any static web server, then open the local URL in your browser.

Example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- `W` or `Up Arrow`: accelerate
- `S` or `Down Arrow`: brake / reverse
- `A` / `D` or `Left` / `Right`: steer
- `Shift`: boost
- `R`: reset car
