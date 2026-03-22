# Backend Structure & Data Contracts

## 1. Overview
The application uses Firebase Realtime Database (RTDB) exclusively. There is no traditional standard server (e.g., Node.js/Express). Business logic and synchronization are handled purely by manipulating JSON structures stored in Firebase.

## 2. Firebase Database Schema

The entire state is stored under the `/rooms` node. Every active session has a unique 6-digit alphanumerical ID.

```json
{
  "rooms": {
    "1A2B3C": {
      "status": "waiting | battling",
      "hostId": "player_uuid_1",
      "players": {
        "player_uuid_1": {
          "id": "player_uuid_1",
          "name": "Ash",
          "activePokemonIndex": 0,
          "team": [
            {
              "baseSpecies": "Pikachu",
              "fullName": "Pikachu",
              "hp": 211,
              "maxHp": 211,
              "status": "none"
            }
          ]
        }
      },
      "weather": {
        "type": "none",
        "turnsRemaining": 0
      },
      "turnData": {
        "turnNumber": 1,
        "actions": []
      },
      "logs": [
        "Battle started!"
      ]
    }
  }
}
```

## 3. Data Flow & Synchronization

### 3.1 Initial Connection
- When a user enters a room code, the client attempts to read `/rooms/$roomId`.
- If it exists, it joins (pushes to `/rooms/$roomId/players`).
- If it doesn't, it creates a new room with `status: waiting`.

### 3.2 Action Publishing
When a user executes a move (e.g., Attack):
1. The DOM fires a local event.
2. `BattleEngine` calculates the RNG, damage, and stat changes synchronously in memory.
3. The modified `Player` and `Pokemon` objects are passed to `socketClient.js`.
4. `socketClient` patches the `/rooms/$roomId/players/$playerId` node using `.update()`.

### 3.3 State Listening
- Every client maintains an `.onValue()` listener on `/rooms/$roomId`.
- When changes occur anywhere in the room (e.g., Opponent updates their HP), the callback fires.
- `state = snapshot.val()` updates the local JS memory.
- `UIRenderer.renderAll(state)` redraws the DOM to match the new truth.

## 4. Security Philosophy
**Current Phase**: Trust-based Client.
- The platform assumes friends trust each other. Since clients run their own calculations and sync state, there is no authoritative dedicated server checking if damage formulas were mathematically hacked before submission.
- **Future Milestone**: Implement Firebase Security Rules and Cloud Functions to validate state transitions securely.

## 5. Dataset Architecture
The raw data for game mechanics resides in `Pokemon_NewDataset.js`.
- Contains base stats, types, weight, abilities.
- Alternate forms are nested inside `forms: { "FormName": {} }`.
- Crucially: **All game indexing systems normalize keys** (e.g., `Name` and `name` fallbacks) to process the raw node robustly during load.
