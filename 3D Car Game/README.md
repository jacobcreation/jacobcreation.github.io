# Dustline Driver

A lightweight 3D car simulator built with Three.js. It includes:

- Arcade driving with acceleration, braking, steering, and boost
- Endless chunked city generation with roads, buildings, parks, benches, and trees
- Civilian traffic cars that drive around the city grid
- Walking pedestrians on sidewalks and through parks
- Wanted-level gameplay with police cars that chase and bust you if they catch up
- Collision damage, refueling, pickups, score combos, and local best-score persistence
- Pause and respawn flow for longer free-roam sessions
- Destination search for nearby parks, gas stations, malls, plazas, and more

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
- `Space`: handbrake drift
- `P`: pause / resume
- `R`: reset car
- Search box in the HUD: type a place like `park` or `gas station`, then use `Guide Me`

## Notes

- Roll into a gas station forecourt and slow down to refuel.
- Hitting traffic or pedestrians raises your wanted level and brings in police.
- Pickups can restore health, reduce heat, or increase scoring momentum.
- Submit an empty destination search to clear the current route.
