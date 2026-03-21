# Pokémon Battle Arena

This is a real-time multiplayer Pokémon battle simulator built with vanilla JavaScript, Node.js, and WebSockets.

![Status](https://img.shields.io/badge/status-production--ready-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Node Version](https://img.shields.io/badge/node-v18%2B-brightgreen)

<div align="center">
  <img src="./assets/hero-placeholder.png" alt="Pokémon Battle Arena Gameplay" width="800">
</div>

## What it is

You can build a team of six Pokémon, join a room using a simple 6-digit code, and battle your friends in real-time.

The battle engine handles the core mechanics you'd expect from the actual games: type effectiveness, stat modifiers, status conditions (burn, paralysis, poison), and weather effects like sandstorms and hail. Up to six players can connect to the same room. I built the UI using a retro pixel-art style, complete with original sound effects powered by Tone.js.

There's also an undo/redo system that lets you rewind turns during testing—I built this using a custom RingBuffer so it doesn't leak memory if a battle goes on forever.

## Architecture

The stack is split into a static frontend (Vercel) and a WebSocket backend (Render). I stuck to vanilla JS and Tailwind CSS for the client rather than reaching for React or Vue. 

### Frontend and Backend

```mermaid
graph TD
    subgraph Frontend ["Pokémon Battle Arena"]
        A[index.html<br/>App Shell]
        B[js/services/DataLoader.js<br/>Async Assets]
        C[script.js<br/>Entry & Init]
        D[js/main.js<br/>Game Orchestrator]
        E[js/* Modules<br/>Game Domain]
    end

    subgraph Backend ["WebSocket Backend"]
        F[server.js<br/>Express + Socket.IO]
    end

    Frontend <-->|Socket.IO<br/>Multiplayer Sync| Backend
```

### Class Hierarchy

The monolithic code has been refactored into a modular ES6 architecture. The game uses a HashMap for O(1) Pokémon lookups and a Trie to search strings quickly. 

```mermaid
graph TD
    classDef domain fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#fff;
    classDef service fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;
    classDef infra fill:#701a75,stroke:#f472b6,stroke-width:2px,color:#fff;
    classDef multi fill:#78350f,stroke:#fbbf24,stroke-width:2px,color:#fff;

    subgraph Infrastructure
        PokemonBattleArena[PokemonBattleArena<br/>Main Orchestrator]:::infra
    end

    subgraph Domain Models
        Pokemon[Pokemon<br/>State: HP, stats, types]:::domain
        Player[Player<br/>Trainer data: team]:::domain
        PokemonDatabase[PokemonDatabase<br/>Index + Trie]:::domain
    end

    subgraph Services
        BattleEngine[BattleEngine<br/>Damage Calculation]:::service
        AudioManager[AudioManager<br/>Tone.js wrapper]:::service
        BattleLog[BattleLog<br/>RingBuffer + DOM]:::service
        HistoryManager[HistoryManager<br/>Undo & Redo]:::service
        ModalManager[ModalManager<br/>UI Overlay]:::service
    end

    subgraph Multiplayer
        MultiplayerManager[MultiplayerManager<br/>Socket.IO client]:::multi
    end

    PokemonBattleArena --> Domain Models
    PokemonBattleArena --> Services
    PokemonBattleArena --> Multiplayer
```

## Setup

You'll need Node.js v18+ and npm.

1. Clone and install dependencies:
```bash
git clone https://github.com/Sapeksh2001/pokemon-battle-arena.git
cd pokemon-battle-arena
npm install
```

2. Start the backend:
```bash
npm start
```

3. Open a new terminal and start the frontend:
```bash
npx http-server -p 3000
```

Load `http://localhost:3000` in your browser. If you want to test multiplayer locally, just open a second tab.

## Development Details

The backend uses basic Socket.IO events. 
- Clients emit `room:create` or `room:join`. 
- The host emits `game:start`. 
- Clients emit `game:action` to attack or switch, and the server broadcasts state updates back.

Damage calculation is mostly faithful to the original games. It factors in attacker level, stat modifiers, Same Type Attack Bonus (STAB), type effectiveness multipliers, and a slight RNG variance.

```javascript
// Example Damage Calculation
const effectiveness = typeChart[attackType][defendType];
const baseDamage = (2 * attackerLevel / 5 + 2) * power * attackerStat / defenderStat / 50 + 2;
const stab = attackerType == defendType ? 1.5 : 1;
const variance = Math.random() * 0.15 + 0.85;

const finalDamage = baseDamage * stab * effectiveness * variance;
```

## Deployment

Deploying the hybrid stack takes about 10 minutes. 

1. Push your code to GitHub.
2. Go to Render, create a new Web Service, and select your repository. Set the Start Command to `npm start` and `NODE_ENV` to `production`.
3. Go to Vercel, create a new project, and deploy the exact same repository.
4. Update the `SOCKET_URL` variable in `multiplayer-integration.js` to point to your new Render URL, then commit and push.

## Testing

I've included two basic test scripts to catch obvious regressions:
- `npm test` runs a Socket.IO integration test to ensure rooms can be created, joined, and torn down correctly.
- `npm run test:e2e` spins up Playwright to navigate to the local lobby and verify the UI loads without throwing an exception.

## File Breakdown

If you are poking around the source, here is where everything lives:

| Directory/File | Purpose |
|------|---------|
| `/js/models/` | Domain definitions (`Player.js`, `Pokemon.js`) |
| `/js/services/` | Game engines (`BattleEngine.js`, `PokemonDatabase.js`, `DataLoader.js`, etc.) |
| `/js/ui/` | UI and views (`UIRenderer.js`, `ModalManager.js`) |
| `/js/api/` | Real-time networking wrapper (`socketClient.js`) |
| `/js/utils/` | Data structures (`RingBuffer.js`, `Trie.js`) |
| `script.js` | Core UI glue and orchestrator setup |
| `js/main.js` | The `PokemonBattleArena` bootstrap class |
| `server.js` | Socket.IO room management backend |
| `style.css` | Animations, colors, retro pixel-art styling |
| `index.html` | Entry point, loader, modals, lobby |

## Roadmap

A few things I might add later:
- Competitive Ranked Mode (Elo/Glicko matchmaking).
- Held items like Leftovers and Choice Band.
- A basic Minimax AI so you can practice offline without juggling tabs.

## License

This project is open-source under the MIT License. Pokémon sprites and audio assets belong to Nintendo and Game Freak.

