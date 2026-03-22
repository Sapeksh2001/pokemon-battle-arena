# Pokémon Battle Arena

A real-time multiplayer Pokémon battle simulator built with vanilla JavaScript and Firebase. It allows trainers to build teams, join rooms with simple 6-digit codes, and battle friends in a faithful recreation of the core combat mechanics.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features
- Real-time multiplayer synchronization via Firebase
- Full core combat mechanics: type effectiveness, stat modifiers, STAB, critical hits, and RNG variance
- Status conditions (burn, paralysis, poison) and weather effects (sandstorm, hail, etc.)
- In-battle form changes (e.g., Alolan forms, Megas) and mid-battle evolution
- Custom undo/redo system powered by a RingBuffer
- Authentic retro pixel-art aesthetic and UI with custom CSS
- Tone.js-powered original sound effects and Pokémon cries

---

## Tech Stack
- **Frontend**: Vanilla HTML / JS / CSS (Tailwind used for some utility but largely custom CSS for retro feel)
- **Backend**: Serverless (Firebase Realtime Database)
- **Database**: Firebase Realtime Database
- **Hosting**: Firebase Hosting

See [TECH_STACK.md](./TECH_STACK.md) for complete dependency list.

---

## Project Structure

```text
pokemon-battle-arena/
├── assets/               # Images, hero banners, icons
├── js/                   # Main application code
│   ├── api/              # Real-time networking wrapper (socketClient.js)
│   ├── models/           # Domain definitions (Player.js, Pokemon.js)
│   ├── services/         # Game engines (BattleEngine.js, PokemonDatabase.js, DataLoader.js, etc.)
│   ├── ui/               # UI orchestration (UIRenderer.js, ModalManager.js)
│   └── utils/            # Data structures and helpers (RingBuffer.js, Trie.js, etc.)
├── .env.example          # Environment variable template
├── index.html            # Entry point, loader, modals, lobby
├── Pokemon_NewDataset.js # Core Pokémon statistics and moves dataset
├── script.js             # Core UI glue and orchestrator setup
├── style.css             # Animations, colors, retro pixel-art styling
├── README.md             # This file
├── PRD.md                # Product Requirements Document
├── APP_FLOW.md           # Application flow and navigation
├── TECH_STACK.md         # Technology stack and versions
├── FRONTEND_GUIDELINES.md # Design system and component library
├── BACKEND_STRUCTURE.md  # Database schema and API contracts
└── IMPLEMENTATION_PLAN.md # Step-by-step build sequence
```

---

## Getting Started

### Prerequisites
- Node.js 18 or higher (for local server)
- Firebase CLI (if deploying)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Sapeksh2001/pokemon-battle-arena.git
cd pokemon-battle-arena

# 2. Start a local server (no build step required)
npx http-server -p 3000
```

Visit `http://localhost:3000` to view the app. Multiplayer works out of the box using the configured Firebase project in `js/api/socketClient.js`.

---

## Environment Variables

Since this is a client-side serverless application, Firebase configuration is injected directly.

| Variable              | Required | Description                        |
|-----------------------|----------|------------------------------------|
| `FIREBASE_API_KEY`    | Yes      | API Key for Firebase project       |
| `FIREBASE_AUTH_DOMAIN`| Yes      | Firebase Authentication Domain     |
| `FIREBASE_DATABASE_URL`| Yes | Realtime Database URL              |
| `FIREBASE_PROJECT_ID` | Yes      | Project Identifier                 |
| `FIREBASE_STORAGE_BUCKET`| Yes    | Default Storage Bucket             |
| `FIREBASE_MESSAGING_ID`| Yes    | Messaging Sender ID                |
| `FIREBASE_APP_ID`     | Yes      | Web App Identifier                 |

*Note: In the current setup, these values are hardcoded in `js/api/socketClient.js` for quick development, but should ideally be passed through a build process for production environments.*

---

## Documentation

| Document                   | Description                                  |
|----------------------------|----------------------------------------------|
| [PRD.md](./PRD.md)         | Product requirements and success metrics      |
| [APP_FLOW.md](./APP_FLOW.md) | User flows, navigation map, screen inventory |
| [TECH_STACK.md](./TECH_STACK.md) | All dependencies with exact versions    |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | Design system, tokens, components |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) | DB schema, API endpoints, auth   |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Build phases and milestones    |

---

## Contributing

### Branch Naming
- `feature/[short-description]` — New features
- `fix/[short-description]` — Bug fixes
- `hotfix/[short-description]` — Urgent production fixes
- `docs/[short-description]` — Documentation updates

### Commit Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add held items support
fix: resolve form change button disabling issue
docs: update README with environment variables
```

### Pull Request Process
1. Create a branch from `main`
2. Implement your changes
3. Open a Pull Request with a clear description of the modifications
4. Request a review from the repository owner

---

## License
MIT License — see [LICENSE](./LICENSE) for details. Pokémon sprites and audio assets belong to Nintendo and Game Freak.
