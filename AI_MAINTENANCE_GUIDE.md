# AI Developer & Maintenance Guide: BlindChess

This guide is for AI assistants working on the BlindChess project. It summarizes critical architectural decisions, state machine logic, and haptic protocols to ensure consistency during development.

---

## 1. System Architecture
- **Hardware**: ESP8266 (NodeMCU) acting as an Access Point (SSID: "BlindChess").
- **Firmware** (`blind_chess_complete.ino`): Manages WebSocket server (Port 81), LittleFS web server (Port 80), and hardware PWM for the vibration motor (GPIO14).
- **Frontend** (`data/app.js`): The brain of the system. Runs Stockfish WASM in a Web Worker, manages game state, and handles haptic encoding.

---

## 2. Core State Machine (in `app.js`)
The `gameState` variable governs how button inputs are interpreted:
- `IDLE`: Waiting for a long press to begin.
- `COLOR_SELECT`: Tap 1=White, 2=Black, 3=Manual Entry.
- `FROM_FILE` -> `FROM_RANK` -> `TO_FILE` -> `TO_RANK`: The standard coordinate entry sequence.
- `WAITING_ENGINE`: Engine is calculating.
- `ENGINE_MOVE`: Playing back the engine's move haptically.

---

## 3. Haptic Protocol & Vibration Constraints
**CRITICAL: Silent Vibration Requirement**
- **PWM Limit**: Never exceed `120` PWM for standard vibrations. Values above 120 cause audible buzzing/noise.
- **Encoding**: Coordinates are sent as a series of pulses (1-8).
- **Gaps**: Standard 250ms gap between pulses, 600ms pause between coordinate components (e.g., between Rank and File).

---

## 4. Feature-Specific Logic

### Manual Entry Mode (Option 3)
- **Purpose**: Allows setting up a board position mid-game.
- **Logic**: User enters moves for both sides sequentially.
- **Exit Condition**: When in `STATE.FROM_FILE` and `selection === 0`, the user must perform **two consecutive long presses** within 2 seconds to end manual entry.
- **Handoff**: After exit, the engine automatically calculates the move for whoever's turn it is.

### Adaptive Thinking Time
- **Boost Mode**: When enabled (default), uses higher thread counts (6) and hash (up to 1024MB).
- **Depth Target**: Uses `boostDepth` (default 22) as the primary search termination condition to avoid unnecessary compute time.
- **Recapture Detection**: If an opponent moves to a square and the engine has exactly **one** legal capture move to that square, it uses a fixed 10s think time.

---

## 5. Critical Development Pitfalls
1. **Castling Logic**: When writing functions to validate moves (like `isValidMoveWithState` or `getAllLegalMoves`), you **must** manually move the Rook in the `testBoard` clone, otherwise, the engine will believe the Rook is still in the corner.
2. **Idle Timeouts**: 
   - 2s: Reset current selection (counter).
   - 4s: Reset current move entry back to `FROM_FILE`.
3. **WASM Constraints**: Stockfish runs in a Web Worker. Use `engineWorker.postMessage` for UCI commands.

---

## 6. Development Workflow & Standard Operating Procedure (SOP)

**CRITICAL: Contextual Awareness Requirement**
1.  **Read Before Writing**: Before making *any* code changes, the AI **must** read `PROJECT_OVERVIEW.md`. This file is the canonical source of truth for features, timings, and interaction patterns.
2.  **Synchronized Updates**: Whenever a feature is added or modified in the code (e.g., changing a timeout or adding a new mode), the AI **must** simultaneously update `PROJECT_OVERVIEW.md` to reflect the new behavior.
3.  **Cross-Reference**: Always cross-reference your proposed logic with the "Key Algorithms" and "Navigation System" sections of the overview to prevent breaking existing haptic protocols.

## 7. Files to Maintain & Edit
-   **Documentation**: `PROJECT_OVERVIEW.md` (Must be kept 100% in sync with code).
-   **Logic/Engine**: `data/app.js` (The core implementation of game logic and haptics).
-   **UI/Settings**: `data/index.html` (Admin and benchmark interfaces).
-   **Firmware**: `blind_chess_complete.ino` (Hardware-level timing and PWM frequency).

---
