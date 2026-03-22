# Implementation Plan & Roadmap

## Overview
This document serves as the historical record of features built, bugs fixed, and the active roadmap for scaling Pokémon Battle Arena.

## Phase 1: Engine Architecture (Status: COMPLETED)
- [x] Configure Firebase RTDB.
- [x] Integrate raw raw datasets (`Pokemon_NewDataset.js`, `moves_data.js`).
- [x] Complete Damage Engine calculation (`BattleEngine`), factoring A/D multipliers, PRNG Rolls (85-100), STAB, and Type maps.
- [x] Sub-system: Status ailments affecting base stats natively (Burn/Atk, Paralysis/Speed).
- [x] Sub-system: Weather effects ticking end-of-turn damage accurately per type immunities.

## Phase 2: UI Engineering & Polish (Status: COMPLETED)
- [x] Construct Isometric Flexbox DOM matching 16:9 pixel-perfect scaling (`vmin` implementation).
- [x] Programmatically render SVG Health Indicators converting stat vectors to CSS rotation vectors.
- [x] Programmatically render player stat bars (Atk/Def/SpA/SpD/Spe) and status pills.
- [x] Add 50-stack History Manager (`RingBuffer.js`) enabling Ctrl+Z Undo actions perfectly unrolling `BattleEngine` states.
- [x] Sound logic: Trigger Tone.js oscillator logic on attacks natively without downloading MP3s.

## Phase 3: "Form Check" Debugging Milestone (Status: COMPLETED)
- **Problem Log**: Users reported the `[FORM]` button was inactive despite selecting Pokémon with known variants (Diglett, Meowth, Tauros).
- **Resolution**: Diagnosed root cause inside `PokemonDatabase.js`. Form nodes contained lowercase `name` instead of uppercase `Name`.
  - [x] `PokemonDatabase.js`: Rewrote indexing loops to consume `node.Name || node.name`.
  - [x] `UIRenderer.js`: Patched button logic state to check `f?.Name || f?.name`.
  - [x] `Pokemon.js`: Rewrote instance ingestion merging `fullName` dynamically to solve base mapping drift.
  - [x] Browser cache busting query params bumped `v=4` -> `v=5` securing rollout.

## Phase 4: Active Technical Debt & UI Refactoring (Status: IN PROGRESS)
- [ ] **Player Card Overflow**: Refactor generic `.player-card` titles to auto-size font `clamp()` to stop truncating strings like "Tauros-Paldea-Aqua".
- [ ] **Stat Number Kerning**: Move bottom numerical stats `DIVs` evenly across the width so 3-digit numbers don't collide with their neighbors.
- [ ] **Button States**: Push CSS `filter: grayscale(1)` updates to "Evolve/Form" when not valid.

## Phase 5: Advanced Gameplay Subsystems
- **Implementing "Held Items"**: Create new Data node in raw sets for items like `Leftovers` (1/16 heal end of turn) or `Choice Band` (Lock move + 1.5x Atk). Updates `BattleEngine` evaluation tree.
- **Entry Hazards**: Build map array in Firebase room for `Stealth Rocks`, calculating damage on Pokemon swap events.
- **Offline AI**: Construct minimax local algorithm predicting best STAB move vs user typing.
