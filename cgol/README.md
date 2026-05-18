# Conway's Game of Life

A minimalist, high-performance implementation of Conway's Game of Life using Vanilla JavaScript and HTML5 Canvas.

## Features
- **High Performance**: Uses Canvas rendering for smooth animation even on larger grids.
- **Interactive**: Click or drag on the grid to draw cells and create patterns.
- **Controls**:
    - **Start/Pause**: Toggle the simulation.
    - **Randomize**: Fill the grid with a random distribution of live cells.
    - **Clear**: Reset the grid.
    - **Speed Control**: Adjust the simulation speed from 1 to 60 generations per second.
- **Responsive**: The grid adapts to your screen size.
- **Minimalist Aesthetic**: Clean, monochrome design focusing on the simulation.

## Rules
1. Any live cell with fewer than two live neighbors dies (underpopulation).
2. Any live cell with two or three live neighbors lives on to the next generation.
3. Any live cell with more than three live neighbors dies (overpopulation).
4. Any dead cell with exactly three live neighbors becomes a live cell (reproduction).

## How to Run
Simply open `index.html` in any modern web browser.
