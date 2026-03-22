# Application Flow Documentation

## 1. Entry Points
### Primary Entry Points
- **Direct URL**: Lands on the Lobby screen (`index.html`).

## 2. Core User Flows

### Flow 1: Joining a Battle Room
**Goal**: Connect with an opponent to start a match.
**Entry Point**: `index.html` (Lobby Modal)

#### Happy Path
1. **Page: Lobby Modal**
   - Elements: [Player Name Input, Room Code Input, Connect Button]
   - User Action: Enters "Ash", Enters "123456", Clicks Connect.
   - Trigger: Firebase RTDB checks room status.
2. **System Action**: Creates or joins room at `/rooms/123456`.
3. **Page: Main Game UI**
   - Elements: [Team Management, Battle Log, Player Cards]
   - Success State: UI overlays clear, game elements become interactive.

#### Error States
- **Room Full**
   - Display: Alert dialog "Room is full (max 6 players)".
   - Action: User must select another room code.

### Flow 2: Form Change / Evolution
**Goal**: Change a Pokémon to an alternate form (e.g., Alolan) or evolve it.
**Entry Point**: Management Controls Panel.

#### Happy Path
1. **Page: Main Game UI**
   - User Action: Selects "Ash - Diglett" from Management dropdown.
   - System Action: Enables FORM and EVO buttons if available.
2. **Page: Management Controls**
   - User Action: Clicks "FORM".
   - Trigger: Opens Form Selection Modal.
3. **Page: Form Selection Modal**
   - Elements: [Grid of Diglett and Dugtrio form variants].
   - User Action: Clicks "Alolan Diglett".
   - System Action: Confirms change, updates HP proportionally, updates Sprite, syncs to Firebase.

## 3. Navigation Map
```text
Lobby (Modal)
└── Main Battle Interface
    ├── Player Cards (Visual state)
    ├── Attack Command Panel (Moves, Targeting)
    ├── Status & Stats Panel (Weather, Ailments)
    ├── Utility Panel (RNG Roll, Player Add)
    ├── Management Panel (Form, Evo, Team Selection)
    └── Battle Log / History Panel (Undo/Redo)
```

## 4. Screen Inventory

### Screen: Lobby Overlay
- **Access**: Public (Default entry)
- **Purpose**: Identity and room assignment.
- **Key Elements**: Username, Room ID, Join button.

### Screen: Main Battle Interface
- **Access**: Authenticated/Joined
- **Purpose**: Core game execution.
- **Key Elements**: Active Pokémon cards, Control panels.
- **State Variants**: Team Selection (pre-battle), Combat (active battle).

## 5. Decision Points

### Decision: Action Resolution Order
```markdown
IF multiple players submit moves
THEN sort moves by Move Priority
ELSE IF Move Priority is tie
THEN sort by Pokémon Speed stat
ELSE apply RNG speed tiebreaker
```

## 6. Error Handling Flows
- **Network Offline**: Firebase automatically handles offline persistence. App UI may freeze until reconnect.
- **Invalid Data**: Falls back to `?` placeholder sprite if Pokémon definition fails to parse.

## 7. Animations & Transitions
- **Sprite Updates**: Flash white pixel shader effect during evolution or damage.
- **Modals**: Standard retro CSS fade-in with sharp pixel borders.
- **HP Bar**: CSS transition on width property for smooth health depletion.
