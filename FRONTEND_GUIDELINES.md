# Frontend & Design Guidelines

## 1. Design System Overview
The Pokémon Battle Arena uses a strict "Retro Pixel Art" aesthetic meant to emulate the Generation 5 (Black/White) style of games. Everything from typography to borders and animations should adhere to this.

## 2. Typography
- **Primary Font**: 'Press Start 2P', or similar pixel-perfect TTF font.
- **Rules**:
  - Avoid antialiasing (use `text-rendering: optimizeSpeed; -webkit-font-smoothing: none;`).
  - Text must always be perfectly sharp, avoiding fractional font sizes.
  - Line height must accommodate blocky characters cleanly.

## 3. Colors & Theme
### Base Palette
- **Background**: Deep Navy (`#0f172a`) with grid overlays.
- **Accents**: Neon Blue (`#3b82f6`), Neon Pink (`#ec4899`).
- **Text**: Off-White (`#f8fafc`).
- **Success**: Green (`#22c55e`).
- **Warning**: Amber (`#f59e0b`).
- **Danger**: Red (`#ef4444`).

### Type Colors
Every Pokémon type has a specific standardized color pill (e.g., FIRE is orange/red, WATER is blue). See `style.css` for the hardcoded mapping (`.type-fire`, `.type-water`, etc.).

## 4. Layout Constraints
### Mobile vs Desktop
- **Desktop Primary**: 16:9 aspect ratio target. Modals center screen. 6-Pokémon grid spans horizontally across the management panel.
- **Scaling**: UI logic uses responsive `vmin`/`vw` scaling to ensure the entire arena fits on one screen without scrolling during active combat. No scrollbars allowed in the main view.

## 5. UI Components

### 5.1 Player Cards
- **Structure**: Pokémon Sprite (center), Name/Form (top), Type Badges (below name), HP Gauge (circular layout), Stat bar (bottom).
- **Behavior**: Shakes on damage. Flashes white on form change. Drops opacity when fainted.

### 5.2 HP Gauge
- **Style**: Circular SVGs calculating dash-array strokes to represent percentage.
- **Feedback**: Green (>50%), Yellow (20%-50%), Red (<20%).

### 5.3 Battle Log
- **Typography**: Terminal-style output.
- **Behavior**: Auto-scrolls to the bottom on new entry. Messages fade in.

## 6. Interaction Patterns
- **Buttons**: All interactive buttons must have a distinct `:hover` state (brightness scale) and `:active` state (downward translation / scaling 95%) for tactile feedback.
- **Disabled State**: Opacity 0.5, `cursor: not-allowed`. Should never react to hover.

## 7. Animation Rules
- Keep animations snappy.
- Evolution/Form Change: `flash` animation (overlay brightness to 100% and back over 300ms).
- Damage: `shake` animation (rapid X-axis translation).

## 8. Asset Handling
- Sprites: `image-rendering: pixelated` must be applied globally to all `img` tags holding game assets to prevent blurry scaling artifacting.
