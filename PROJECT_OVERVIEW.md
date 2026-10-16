# BlindChess System Overview

## Project Summary

BlindChess is a **covert chess assistance system** that uses haptic feedback via a vibration motor controlled by an ESP8266 microcontroller. The system allows discreet chess move input and output through tactile vibrations, designed for use in a shoe with a single-button interface. It provides Stockfish engine suggestions through a clear, pulse-counting haptic protocol.

---

## Architecture Overview

The system consists of two main components:

1. **ESP8266 Firmware** (`blind_chess_complete.ino`)
2. **Web Application** (`data/app.js`, `data/index.html`, `data/style.css`)

These components communicate via WebSocket for real-time interaction.

---

## ESP8266 Firmware (`blind_chess_complete.ino`)

### Core Functionality

- **WiFi Access Point**: Creates an AP named "BlindChess" (password: "name12@@") for local device connections
- **HTTP Server**: Serves the web application files from LittleFS on port 80
- **WebSocket Server**: Handles real-time communication with the web app on port 81
- **Button Input Processing**: Implements tap/longpress/doubletap detection for navigation
- **PWM Motor Control**: Provides haptic feedback through vibration patterns

### Key Features

#### Button Handling
- **Debouncing**: 10ms debounce period to eliminate contact bounce
- **Gesture Recognition**:
  - **Tap**: Increments selection by 1 (Strong 100ms buzz)
  - **Long Press**: Confirm selection / Execute move (Very strong 250ms buzz)
  - **Panic Hold**: Hold for 15s (triggers emergency reset)
- **State Management**: Tracks button state, press duration, and gesture sequences

#### Vibration System
- **Water Tank Queue**: Stores incoming vibration patterns in `app.js` to prevent overlapping feedback; plays them sequentially with an 80ms gap.
- **PWM Control**: Uses hardware PWM for smooth, configurable frequency operation
- **Default Frequency**: 150Hz for optimal shoe resonance and tactile clarity
- **Pattern Playback**: Supports complex vibration patterns with varying durations and intensities
- **Smooth Ramping**: Gradually increases/decreases PWM for "floating" feel
- **Frequency Control**: Configurable PWM frequency via WebSocket commands (default 0.15kHz = 150Hz)

#### Communication Protocol
- **WebSocket Messages**: JSON-formatted commands and events
- **Vibration Commands**: Accepts pattern arrays, PWM values, and frequency settings
- **Button Events**: Sends tap/longpress/panic signals to the web app

### Hardware Integration

- **Button Pin**: GPIO0 (D3 on NodeMCU) with pull-up resistor
- **Motor Pin**: GPIO14 (D5 on NodeMCU) controlled via PN2222A transistor
- **PWM Frequency**: Configurable (default 150Hz for shoe use)

---

## Execution & Navigation

### Coordinate Entry Sequence
1. User enters bits via tap/doubletap to increment selection
2. **Feedback**: Tap (100ms), DoubleTap (100ms x 2)
3. **Confirm**: Long Press (250ms) to lock in coordinate and advance
4. System advances to next coordinate: FROM_FILE → FROM_RANK → TO_FILE → TO_RANK
5. **Execute**: The final Long Press (at TO_RANK) confirms the coordinate and executes the move directly.

### Tiered Idle Timeout Auto-Correction

The system implements automatic corrections based on idle time:

#### 2 Seconds Idle (idleCancelMs=2000)
- **Action**: Clears current selection (tapCount/selection)
- **Effect**: Stays in current coordinate state
- **Feedback**: 1 short buzz (120ms)

#### 4 Seconds Idle (idleResetMs=4000)
- **Action**: Full reset to FROM_FILE
- **Effect**: Clears all move entry progress
- **Feedback**: 2 buzzes (120ms-80ms)

#### 8 Seconds Idle (idleReplayMs=8000)
- **Action**: Re-transmits last engine move
- **Effect**: Repeats vibration pattern for engine's last move

---

## Web Application

### Core Components

#### Main Application (`app.js`)
The heart of the web application, managing:
- Game state and logic
- WebSocket communication with ESP
- Stockfish WASM engine integration
- User interface updates
- Settings management

#### User Interface (`index.html`)
- Responsive layout for mobile devices
- Board visualization with Unicode pieces
- Control panels for game management
- Debug console for monitoring

#### Styling (`style.css`)
- Dark theme optimized for accessibility
- Mobile-first responsive design
- Clean, intuitive interface elements

### Game State Management

#### Game States
- `IDLE`: Waiting for game start
- `COLOR_SELECT`: Choosing player color (1=White, 2=Black, 3=Manual)
- `FROM_FILE/FROM_RANK`: Piece selection sequence
- `TO_FILE/TO_RANK`: Destination selection
- `PROMOTION`: Piece promotion (unused - auto-queen)
- `WAITING_ENGINE`: Engine thinking
- `ENGINE_MOVE`: Engine move playback

#### Board Representation
- 64-element array representing the chess board
- Piece notation: `wK`, `wQ`, `wR`, `wB`, `wN`, `wP` for white; `bK`, `bQ`, `bR`, `bB`, `bN`, `bP` for black
- FEN generation for engine communication

### Communication Layer

#### WebSocket Integration
- Automatic connection to ESP8266 AP
- Exponential backoff for reconnection
- Heartbeat ping/pong for connection health
- Error handling and state preservation

#### Vibration Commands
- Pattern construction from game events
- PWM and frequency modulation
- Duration scaling for consistency

### Engine Integration

#### Stockfish WASM
- Runs in Web Worker for non-blocking operation
- Communicates via UCI protocol
- Handles move calculation and game logic
- Supports time controls and strength settings
- **Target Strength**: ~1950 Elo (Skill 20, no ELO limiting)

#### Adaptive Thinking Time
The engine uses intelligent timing to mimic human play patterns while maintaining strength:

**Progressive Opening Ramp**:
- Move 1: 1500ms (Blitz)
- Move 2: 5000ms (Semi-Blitz)
- Move 3: 10000ms (Transition)
- Rationale: Simulates human confidence in early-game theory before settling into calculation.

**Recapture Detection**:
- Time: 10000ms
- Triggers when: Opponent just moved to a square AND engine has **exactly one** legal move to capture that square.
- Rationale: If there's only one way to take back, it's likely a forced recapture. 10s is plenty for Stockfish to verify no traps. If there are multiple ways to capture, it uses full time to choose the best piece.

**Phase-Based Timing** (all other moves):
- Opening (≤10 moves, material ≥56): Uses `openingTimeMs` setting (default 20s)
- Endgame (material ≤20): Uses `endgameTimeMs` setting (default 20s)
- Middlegame (all other): Uses `middlegameTimeMs` setting (default 20s)

This adaptive approach maintains ~1950 Elo strength while avoiding suspiciously consistent think times.

#### Move Processing
- Human move validation
- Engine move execution
- FEN position updates
- Game termination detection (checkmate, stalemate)
- Opponent move tracking for recapture detection

### Advanced Features

#### Benchmark System
- **NPS Benchmark**: Performance testing with configurable time/thread settings
- **Game Benchmark**: Engine vs engine self-play with PGN export
- **Draw Detection**: 3-fold repetition and 50-move rule implementation

#### Game History
- **Live Archiving**: Real-time saving of active games
- **Persistent Storage**: LocalStorage backup of last 10 games (displays 5)
- **Session Recovery**: Automatic restoration after reload/disconnect

#### Manual Move Input
- **UCI Format**: Direct move entry (e.g., "e2e4")
- **Validation**: Checks against current board state
- **Integration**: Seamlessly connects with button-based flow

#### Manual Entry Mode (Option 3)
A special mode for entering a game already in progress, allowing the user to set up any board position before the engine takes over.

**Purpose**: When using the system mid-game (e.g., after blitzing the opening moves manually against an opponent), this mode allows entering the moves played so far, then having the engine continue from that position.

**Activation**:
1. Longpress to start from IDLE
2. Tap 3 times to select "Manual" mode
3. Longpress to confirm

**Move Entry**:
- Enter moves alternately for White and Black using the standard coordinate entry (FROM_FILE → FROM_RANK → TO_FILE → TO_RANK)
- Each completed move automatically advances to the next turn
- Status display shows whose turn it is ("Manual White" or "Manual Black")
- Idle timeouts work the same as normal mode:
  - 2s: Resets selection to 0
  - 4s: Resets coordinate entry to FROM_FILE
  - No 8s replay (no engine move to replay yet)

**Ending Manual Entry**:
- When at FROM_FILE with selection = 0, perform **two consecutive longpresses** within 2 seconds
- First longpress: System waits for confirmation ("Longpress once more to end")
- Second longpress: Confirms end of manual entry

**Engine Takeover**:
- After ending manual entry, the engine automatically plays as whoever's turn it is
- If the last manual move was White's, the engine plays as Black
- If the last manual move was Black's, the engine plays as White
- The game then continues normally: user inputs opponent moves, engine responds

**Example Flow**:
1. Game starts, select Manual (option 3)
2. Enter: e2e4 (White), e7e5 (Black), g1f3 (White)
3. At FROM_FILE with selection=0, do longpress twice
4. Engine takes over as Black, calculates and vibrates its move
5. User enters White's response, engine calculates Black's reply, etc.

---

## User Interface

### Main Controls
- **Status Panel**: Shows connection, turn, and selection state
- **Visual Board**: 8x8 grid with chess pieces
- **Move History**: Scrollable list of game moves
- **Manual Input**: Direct move entry field

### Navigation System
- **Tap**: Increment selection (1-8)
- **Long Press**: Confirm selection/execute move
- **Double Longpress**: End manual entry mode (when at FROM_FILE with selection=0)
- **Idle Timeouts**: 
  - 2s: Clear current selection (applies to COLOR_SELECT and move entry)
  - 4s: Reset to FROM_FILE
  - 8s: Replay last engine move (normal mode only, not manual entry)

### Admin Panel
- **Vibration Settings**: PWM scales, durations, frequencies
- **Engine Parameters**: Threads, hash, time controls, skill
- **Boost Mode**: Enhanced settings for critical positions
- **Import/Export**: JSON-based settings backup

### Benchmark Panel
- **Configuration**: Time per move and thread count
- **Execution**: NPS test or game simulation
- **Results**: Performance metrics and PGN export

---

## Technical Specifications

### Hardware Requirements
- ESP8266 microcontroller (NodeMCU recommended)
- Tactile button for input
- Vibration motor (Model 1027, 3V DC)
- PN2222A transistor for motor control

### Software Dependencies
- Arduino IDE with ESP8266 core
- Libraries: ESP8266WiFi, ESP8266WebServer, WebSocketsServer, LittleFS, ArduinoJson
- Web browser supporting WASM and Web Workers

### Network Configuration
- WiFi AP mode: 192.168.4.1
- HTTP server: Port 80
- WebSocket server: Port 81
- Dynamic hostname detection for robust connections

---

## Key Algorithms

### Chess Logic
- **Move Validation**: Legal move generation considering check, castling, en passant
- **Check Detection**: King safety evaluation after hypothetical moves
- **Checkmate/Stalemate**: Game termination condition checking
- **Castling Rights**: Proper tracking of king/rook movement for castling eligibility

### Engine Communication
- **UCI Protocol**: Standard chess engine interface
- **Position Updates**: FEN string generation for engine synchronization
- **Time Management**: Adaptive thinking time based on game phase
- **Memory Management**: Periodic hash clearing to prevent engine timeouts

### Haptic Feedback
- **Pattern Scaling**: Proportional duration adjustments for consistency
- **PWM Mapping**: Intensity calibration for different motor characteristics
- **Timing Constraints**: Minimum on/off durations for reliable operation

---

## Error Handling & Resilience

### Connection Management
- **Automatic Reconnection**: Exponential backoff algorithm
- **State Preservation**: Maintains game progress during outages
- **Heartbeat Monitoring**: Detects silent connection failures

### Engine Recovery
- **Timeout Detection**: Identifies stalled engine calculations
- **Worker Restart**: Resets engine state without page reload
- **Position Refresh**: Re-sends board state after recovery

### Input Validation
- **Move Verification**: Ensures all moves comply with current position
- **State Consistency**: Validates game state transitions
- **User Feedback**: Vibration alerts for invalid actions

---

## Development Notes

### Current Limitations
- Single-player mode (human vs engine)
- Limited to 8x8 standard chess
- No online play capability

### Known Issues
- Engine vs engine mode suppresses all vibrations

### Implementation Notes
- Value tracking uses `tapCount` and `selection` variables
- Long press confirmation required at every step
- Double tap provides a shortcut for faster coordinate entry
- Recapture detection uses heuristic: checks if ANY legal move captures opponent's last destination square
- Adaptive timing maintains ~1950 Elo while appearing more human-like

### Future Enhancements
- Multiplayer support via WebSocket coordination
- Chess variant implementations
- Improved accessibility features
- Enhanced engine strength tuning