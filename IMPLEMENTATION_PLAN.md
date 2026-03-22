# Implementation Plan

## Overview
This document outlines the high-level roadmap, sequencing, and feature milestones for building and maintaining the Pokémon Battle Arena project.

## Phase 1: MVP Layout & Database Init (Status: COMPLETED)
- [x] Configure Firebase RTDB.
- [x] Integrate raw raw datasets `Pokemon_NewDataset.js`, `moves_data.js`.
- [x] Design raw HTML/CSS shell with retro font loading.
- [x] Implement Basic Data Loader and trie searching for 1000+ Pokémon.

## Phase 2: Core Combat & Multiplayer Sync (Status: COMPLETED)
- [x] Build Firebase `socketClient` wrapper.
- [x] Synchronize player join, leave, and ready states.
- [x] Implement damage formula (Base Power, Level, Attack/Defense stat scaling, STAB, Type Effectiveness).
- [x] Sync HP reduction visually via CSS transforms.
- [x] Sync Battle Log strings.

## Phase 3: Advanced Mechanics & Polish (Status: COMPLETED / ONGOING)
- [x] Engine: Add status ailment calculations (Burn halves attack, Paralysis quarters speed).
- [x] Engine: Weather turns logic (Hail, Sandstorm end-of-turn damage).
- [x] UI: Evolve button parsing evolution chains.
- [x] Bugfix: Form changes (Alolan, Galarian) failing due to case-sensitivity indexing. (Fixed v1.0.1)
- [x] UI: Circular SVG HP gauges guarding against 0-division.
- [x] Tooling: Undo/Redo RingBuffer functionality.

## Phase 4: Production Harden & UX Scaling (Status: IN PROGRESS)
- [ ] Responsive Layout: Enforce relative scaling `vmin`/`vh` across all panels so it fits perfectly on 2K displays without manual zoom manipulation.
- [ ] Sub-UI: Stop long Pokémon names (e.g., Tauros-Paldea-Aqua) from overflowing their player cards.
- [ ] Sub-UI: Prevent multi-digit stat values from crashing into adjacent text labels on the combat dashboard.
- [ ] Add explicit disabled styling to grey-out buttons that are not interactable.
- [ ] Keyboard Shortcuts mapping overlay helper.

## Phase 5: Future Roadmap
- Implement Firebase Cloud Functions for competitive security checks.
- Add Held Item framework (`Leftovers`, `Life Orb`).
- AI Battle mode for offline testing.
