# JacobCreation

> A collection of games, tools, and AI projects built by Jacob.

**Live Site:** [jacobcreation.github.io](https://jacobcreation.github.io)

## What's Inside

- **Games** – Chess, Snake, Flappy Bird, Tetris, Minesweeper, Tanks, PvZ, and many more
- **AI Projects** – Chatbot with multi-provider LLM support, AI Civilization simulation
- **Tools** – Calculator, Translator, OCR, Unit Converter, and more
- **Libraries** – Custom game engines, Canvas utilities, and reusable components

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, TypeScript
- **Build Tools:** Vite (for select projects)
- **Deployment:** GitHub Pages
- **Package Manager:** npm

## Project Structure

```
Root
├── index.html              # Main landing page
├── global-header.js        # Shared navigation header (injected via JS)
├── mobile-friendly.css     # Global mobile optimization styles
├── chatbot/                # Multi-provider AI chatbot
├── aiciv/                  # AI Civilization simulation
├── tanks/                  # 3D tank battle game (Vite + Three.js)
├── sss/                    # Vite project
├── shootthemonster/        # Vite project
├── Wordscapes/             # Vite project
├── vendor/                 # Shared 3rd-party libraries
└── [60+ other subprojects]
```

## Development

### Prerequisites

- Node.js 22+
- npm

### Local Development

```bash
# For plain HTML/JS projects, simply open in browser:
# e.g., open chess/index.html

# For Vite projects:
cd <project-name>
npm install
npm run dev
```

### Deployment

The site auto-deploys to GitHub Pages via the workflow in `.github/workflows/pages.yml`.

## License

Copyright (c) Jacob. All rights reserved.
