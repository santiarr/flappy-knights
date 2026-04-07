# Multiplayer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 1v1 online multiplayer to Flappy Knights using PartyKit for real-time WebSocket communication.

**Architecture:** PartyKit authoritative server runs game physics and broadcasts state. Clients send inputs only. Two PartyKit "parties": game room (physics/AI/collisions) and matchmaking queue. Three new Phaser scenes on the client: lobby, multiplayer game, and results.

**Tech Stack:** PartyKit (server), partysocket (client), Phaser 3 (rendering), TypeScript

---

### Task 1: PartyKit Project Setup

**Files:**
- Create: `partykit.json`
- Create: `party/server.ts` (minimal echo server)
- Modify: `package.json` (add dependencies + scripts)

**Step 1: Install PartyKit dependencies**

Run: `npm install partykit partysocket`

**Step 2: Create partykit.json**

```json
{
  "name": "flappy-knights",
  "main": "party/server.ts",
  "parties": {
    "matchmaking": "party/matchmaking.ts"
  }
}
```

**Step 3: Create minimal party/server.ts**

```typescript
import type * as Party from "partykit/server";

export default class GameServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "connected", id: conn.id }));
    this.room.broadcast(JSON.stringify({
      type: "player_joined",
      playerCount: [...this.room.getConnections()].length,
    }));
  }

  onClose(conn: Party.Connection) {
    this.room.broadcast(JSON.stringify({
      type: "player_left",
      playerCount: [...this.room.getConnections()].length - 1,
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    // Echo for now — will become input handler
    this.room.broadcast(message, [sender.id]);
  }
}
```

**Step 4: Add scripts to package.json**

Add to `"scripts"`:
```json
"party:dev": "npx partykit dev",
"party:deploy": "npx partykit deploy"
```

**Step 5: Verify PartyKit dev server starts**

Run: `npx partykit dev`
Expected: Server running on `localhost:1999`

**Step 6: Commit**

```bash
git add partykit.json party/server.ts package.json package-lock.json
git commit -m "feat: add PartyKit project setup for multiplayer"
```

---

### Task 2: Shared Types & Message Protocol

**Files:**
- Create: `src/multiplayer/types.ts`

**Step 1: Define shared types**

```typescript
// === Message Protocol ===

// Client -> Server
export type ClientMessage =
  | { type: "input"; action: "flap" | "left" | "right" | "stop" }
  | { type: "ready" }
  | { type: "rematch" };

// Server -> Client
export type ServerMessage =
  | { type: "connected"; id: string }
  | { type: "waiting"; roomCode: string }
  | { type: "countdown"; seconds: number }
  | { type: "state"; state: GameSnapshot }
  | { type: "event"; name: GameEvent; data?: Record<string, unknown> }
  | { type: "match_over"; winner: string; players: PlayerResult[] }
  | { type: "player_joined"; playerCount: number }
  | { type: "player_left"; playerCount: number }
  | { type: "matched"; roomCode: string };

// === Game State ===

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  lives: number;
  combo: number;
  isInvulnerable: boolean;
  isRespawning: boolean;
  flipX: boolean;
  anim: string; // current animation key
}

export interface EnemyState {
  id: number;
  type: "BOUNDER" | "HUNTER" | "SHADOW_LORD";
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipX: boolean;
  anim: string;
  active: boolean;
}

export interface EggState {
  id: number;
  type: "BOUNDER" | "HUNTER" | "SHADOW_LORD";
  x: number;
  y: number;
  active: boolean;
}

export interface GameSnapshot {
  players: PlayerState[];
  enemies: EnemyState[];
  eggs: EggState[];
  wave: number;
  phase: "waiting" | "countdown" | "playing" | "wave_transition" | "finished";
  timestamp: number;
}

export type GameEvent =
  | "joust_win"
  | "joust_bounce"
  | "enemy_killed"
  | "egg_collected"
  | "egg_hatched"
  | "player_damaged"
  | "player_eliminated"
  | "wave_complete"
  | "ptero_killed";

export interface PlayerResult {
  id: string;
  score: number;
  wave: number;
  bestCombo: number;
  enemiesDefeated: number;
  joustWins: number;
}

// === Room Code ===
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O (confusing)
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```

**Step 2: Commit**

```bash
git add src/multiplayer/types.ts
git commit -m "feat: add multiplayer message protocol and shared types"
```

---

### Task 3: PartyKit Game Server — Physics & State

**Files:**
- Rewrite: `party/server.ts` (full game server)

This is the heaviest task. The server runs a simplified physics simulation mirroring the client's Phaser physics. It does NOT use Phaser — it uses plain math for gravity, velocity, platform collisions, and screen wrapping.

**Step 1: Implement the game server**

The server needs these systems:
1. **Player physics** — gravity, velocity, platform collision, screen wrap, lava death
2. **Enemy AI** — port the line-tracking and smart AI from `Enemy.ts` (simplified: enemies flap toward tracking lines or pursue players)
3. **Collision detection** — player-vs-enemy (height comparison), player-vs-player (height comparison + tie bounce), player-vs-egg
4. **Wave management** — spawn enemies, track wave completion, 5-wave match
5. **Scoring** — points for kills, eggs, PvP jousts

Key constants to import/duplicate from `Constants.ts`:
- `GAME.WIDTH`, `GAME.HEIGHT`, `GAME.GRAVITY`
- `PLATFORM.POSITIONS` (for collision)
- `PLAYER.FLAP_FORCE`, `PLAYER.SPEED`, etc.
- `ENEMY.*` configs
- `WAVE.*` configs

The server tick loop (runs at 60hz via `setInterval`):

```typescript
// Pseudocode for the server tick
tick(delta: number) {
  if (this.phase !== "playing") return;

  // 1. Apply buffered inputs for each player
  for (const [id, inputs] of this.inputBuffer) {
    this.applyInput(id, inputs);
  }
  this.inputBuffer.clear();

  // 2. Step physics for players
  for (const p of this.players.values()) {
    p.vy += GRAVITY * delta;
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    this.resolveplatformCollisions(p);
    this.resolveScreenWrap(p);
    this.checkLava(p);
  }

  // 3. Step physics for enemies
  for (const e of this.enemies) {
    if (!e.active) continue;
    this.updateEnemyAI(e, delta);
    e.vy += GRAVITY * delta;
    e.x += e.vx * delta;
    e.y += e.vy * delta;
    this.resolveplatformCollisions(e);
    this.resolveScreenWrap(e);
    this.checkEnemyLava(e);
  }

  // 4. Check collisions
  this.checkPlayerVsEnemy();
  this.checkPlayerVsPlayer();
  this.checkPlayerVsEgg();

  // 5. Spawn enemies from queue
  this.processSpawnQueue(delta);

  // 6. Check wave completion
  this.checkWaveComplete();

  // 7. Broadcast state (every 3rd tick = 20hz)
  this.tickCount++;
  if (this.tickCount % 3 === 0) {
    this.broadcastState();
  }
}
```

**Implementation notes:**
- Platform collision: simple AABB check against `PLATFORM.POSITIONS`. If entity overlaps a platform from above, snap to top and zero vertical velocity.
- Enemy AI: start with line-tracking only (dumb mode). Smart mode can be added later as refinement. This simplifies the server significantly.
- PvP collision uses the same height comparison as `handleCombat()` in Game.ts: `playerBottom < opponent.y` = win.
- Tie zone: if both players' bottoms are within 5px of each other's Y, bounce apart.

**Step 2: Verify server compiles**

Run: `npx partykit dev`
Expected: Compiles and starts on localhost:1999

**Step 3: Commit**

```bash
git add party/server.ts
git commit -m "feat: implement PartyKit game server with physics, AI, and collision"
```

---

### Task 4: PartyKit Matchmaking Server

**Files:**
- Create: `party/matchmaking.ts`

**Step 1: Implement matchmaking party**

```typescript
import type * as Party from "partykit/server";
import { generateRoomCode } from "../src/multiplayer/types";

interface QueueEntry {
  conn: Party.Connection;
  joinedAt: number;
}

export default class MatchmakingServer implements Party.Server {
  private queue: QueueEntry[] = [];

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.queue.push({ conn, joinedAt: Date.now() });
    conn.send(JSON.stringify({ type: "queued", position: this.queue.length }));
    this.tryMatch();
  }

  onClose(conn: Party.Connection) {
    this.queue = this.queue.filter(e => e.conn.id !== conn.id);
  }

  private tryMatch() {
    while (this.queue.length >= 2) {
      const p1 = this.queue.shift()!;
      const p2 = this.queue.shift()!;
      const roomCode = generateRoomCode();

      const msg = JSON.stringify({ type: "matched", roomCode });
      p1.conn.send(msg);
      p2.conn.send(msg);

      // Close matchmaking connections — clients will connect to game room
      p1.conn.close();
      p2.conn.close();
    }
  }
}
```

**Step 2: Verify partykit.json includes matchmaking party**

The `parties` field in `partykit.json` (from Task 1) already points to this file.

**Step 3: Commit**

```bash
git add party/matchmaking.ts
git commit -m "feat: add matchmaking server for quick match queue"
```

---

### Task 5: Client Connection Manager

**Files:**
- Create: `src/multiplayer/connection.ts`

**Step 1: Implement connection manager**

```typescript
import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage } from "./types";

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

type MessageHandler = (msg: ServerMessage) => void;

class ConnectionManager {
  private socket: PartySocket | null = null;
  private handlers: MessageHandler[] = [];

  connect(roomCode: string): void {
    this.disconnect();
    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
    });

    this.socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      for (const handler of this.handlers) {
        handler(msg);
      }
    });
  }

  connectMatchmaking(): void {
    this.disconnect();
    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: "queue",
      party: "matchmaking",
    });

    this.socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      for (const handler of this.handlers) {
        handler(msg);
      }
    });
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  offMessage(handler: MessageHandler): void {
    this.handlers = this.handlers.filter(h => h !== handler);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.handlers = [];
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const connection = new ConnectionManager();
```

**Step 2: Add VITE_PARTYKIT_HOST to .env**

Add to `.env`:
```
VITE_PARTYKIT_HOST=localhost:1999
```

**Step 3: Commit**

```bash
git add src/multiplayer/connection.ts .env
git commit -m "feat: add WebSocket connection manager for PartyKit"
```

---

### Task 6: Multiplayer Lobby Scene

**Files:**
- Create: `src/scenes/MultiplayerLobby.ts`
- Modify: `src/scenes/TitleScreen.ts` (add MULTIPLAYER button)
- Modify: `src/main.ts` (register new scene)

**Step 1: Create MultiplayerLobby scene**

The lobby has three states:
1. **Menu** — CREATE ROOM, JOIN ROOM, QUICK MATCH buttons
2. **Waiting** — shows room code, "Waiting for opponent..."
3. **Joining** — text input for room code + JOIN button

Use the same `createButton()` pattern from TitleScreen. The cave background tiles are already available from Preloader.

Key behaviors:
- CREATE ROOM: calls `connection.connect(generatedCode)`, shows code
- JOIN ROOM: shows a simple 4-character input, connects on submit
- QUICK MATCH: calls `connection.connectMatchmaking()`, shows "Searching..."
- When server sends `player_joined` with `playerCount: 2`, transition to countdown
- BACK button returns to TitleScreen

Room code display: large gold text with the 4-letter code, "Share this code with your friend" subtitle.

Room code input: 4 boxes that fill in as you type, styled to match the arcade aesthetic. Listen for keyboard letter events, filter to A-Z only, auto-submit when 4 chars entered.

**Step 2: Add MULTIPLAYER button to TitleScreen**

In `TitleScreen.ts` `showMainMenu()`, after the PLAY button and before HOW TO PLAY, add:

```typescript
y += 55;
const mpBtn = this.createButton(cx, y, 'MULTIPLAYER', 220, 42, () => {
    this.scene.start('MultiplayerLobby');
});
this.mainElements.push(mpBtn);
```

Adjust the subsequent y spacing so HOW TO PLAY and the hint text don't overlap.

**Step 3: Register scene in main.ts**

Add `MultiplayerLobby` to the scene array in `main.ts`:

```typescript
import { MultiplayerLobby } from './scenes/MultiplayerLobby';
// ...
scene: [Boot, Preloader, TitleScreen, MainGame, GameOver, MultiplayerLobby],
```

**Step 4: Verify it compiles and the button appears**

Run: `npm run dev`
Expected: Title screen shows PLAY, MULTIPLAYER, HOW TO PLAY buttons

**Step 5: Commit**

```bash
git add src/scenes/MultiplayerLobby.ts src/scenes/TitleScreen.ts src/main.ts
git commit -m "feat: add multiplayer lobby scene with create/join/quick match"
```

---

### Task 7: Multiplayer Game Scene

**Files:**
- Create: `src/scenes/MultiplayerGame.ts`
- Modify: `src/main.ts` (register scene)

**Step 1: Create MultiplayerGame scene**

This scene is similar to `Game.ts` but:
- **Two players rendered** — local player + opponent sprite
- **No local physics simulation** — positions come from server state snapshots
- **Input sends to server** — keyboard/touch input sends `ClientMessage` via connection manager
- **Interpolation** — opponent and enemy positions interpolate between server snapshots for smooth rendering
- **Dual HUD** — left side shows your score, right side shows opponent's score

Key implementation details:

**Rendering from server state:**
```typescript
// Called on every server state message (20hz)
onServerState(state: GameSnapshot) {
  this.prevState = this.currentState;
  this.currentState = state;
  this.interpStart = Date.now();
}

// Called in update() (60fps)
renderInterpolated() {
  if (!this.prevState || !this.currentState) return;
  const t = Math.min((Date.now() - this.interpStart) / 50, 1); // 50ms = 20hz

  // Interpolate opponent position
  const prev = this.prevState.players.find(p => p.id !== this.localPlayerId);
  const curr = this.currentState.players.find(p => p.id !== this.localPlayerId);
  if (prev && curr) {
    this.opponentSprite.x = Phaser.Math.Linear(prev.x, curr.x, t);
    this.opponentSprite.y = Phaser.Math.Linear(prev.y, curr.y, t);
    this.opponentSprite.setFlipX(curr.flipX);
    if (this.opponentSprite.anims.currentAnim?.key !== curr.anim) {
      this.opponentSprite.play(curr.anim);
    }
  }

  // Same for enemies and eggs
}
```

**Local player uses client-side prediction:**
- Apply inputs locally for immediate feedback
- Correct position when server state arrives (snap if drift > threshold)

**Opponent sprite:**
- Uses a different atlas color. For v1, reuse the same player atlas but tint it red: `this.opponentSprite.setTint(0xff6666)`

**Input handling:**
- Same keyboard/touch code as Game.ts, but instead of calling `player.flap()` directly, send:
```typescript
connection.send({ type: "input", action: "flap" });
```
- Also apply locally for prediction

**Server events:**
- `event` messages trigger local VFX (SpectacleManager hit effects, combo popups, etc.)
- `match_over` transitions to MultiplayerResults scene

**Step 2: Register scene in main.ts**

```typescript
import { MultiplayerGame } from './scenes/MultiplayerGame';
// ...
scene: [Boot, Preloader, TitleScreen, MainGame, GameOver, MultiplayerLobby, MultiplayerGame],
```

**Step 3: Commit**

```bash
git add src/scenes/MultiplayerGame.ts src/main.ts
git commit -m "feat: add multiplayer game scene with server state rendering"
```

---

### Task 8: Multiplayer Results Scene

**Files:**
- Create: `src/scenes/MultiplayerResults.ts`
- Modify: `src/main.ts` (register scene)

**Step 1: Create MultiplayerResults scene**

Similar to GameOver but shows:
- WINNER / LOSER banner (gold for winner, red for loser)
- Both players' scores side by side with stats:
  - Score
  - Waves survived
  - Best combo
  - Enemies defeated
  - Joust wins
- REMATCH button (sends `{ type: "rematch" }` to server)
- MAIN MENU button (disconnects and returns to TitleScreen)

Receives data via `this.scene.start('MultiplayerResults', { result, localPlayerId })`.

The `result` is the `match_over` server message containing `PlayerResult[]`.

**Step 2: Register scene in main.ts**

```typescript
import { MultiplayerResults } from './scenes/MultiplayerResults';
// ...add to scene array
```

**Step 3: Commit**

```bash
git add src/scenes/MultiplayerResults.ts src/main.ts
git commit -m "feat: add multiplayer results scene"
```

---

### Task 9: Server-Side Enemy AI

**Files:**
- Create: `party/enemy-ai.ts`
- Modify: `party/server.ts` (import and use)

**Step 1: Port enemy AI to server**

Create a standalone enemy AI module that doesn't depend on Phaser. Port the line-tracking (dumb mode) from `Enemy.ts`:

```typescript
// Simplified server-side enemy AI
export function updateEnemyAI(
  enemy: ServerEnemy,
  players: ServerPlayer[],
  delta: number,
  time: number,
): void {
  if (!enemy.isSmart) {
    // Line tracking — same logic as Enemy.ts updateLineTracking()
    // Fly toward tracking line Y, move in facing direction, reverse at edges
  } else {
    // Smart mode — pursue nearest player
    const nearest = findNearestPlayer(enemy, players);
    if (nearest) {
      // Simplified pursuit: accelerate toward player, flap if below
    }
  }
}
```

Keep it simple for v1. The full Bounder/Hunter/Shadow Lord AI differentiation can be a follow-up.

**Step 2: Commit**

```bash
git add party/enemy-ai.ts party/server.ts
git commit -m "feat: add server-side enemy AI for multiplayer"
```

---

### Task 10: Integration Testing & Polish

**Files:**
- Modify: various files for bug fixes
- Create: `src/multiplayer/constants.ts` (multiplayer-specific constants)

**Step 1: Create multiplayer constants**

```typescript
export const MULTIPLAYER = {
  MATCH_WAVES: 5,
  PVP_JOUST_POINTS: 1000,
  PVP_RESPAWN_TIME: 2000,    // ms
  PVP_TIE_ZONE: 5,           // px — height difference for bounce
  PVP_BOUNCE_FORCE: 150,
  COUNTDOWN_SECONDS: 3,
  SERVER_TICK_RATE: 60,       // hz
  BROADCAST_RATE: 20,         // hz
  INTERP_DURATION: 50,        // ms between state snapshots
};
```

**Step 2: Test the full flow manually**

1. Start PartyKit dev server: `npx partykit dev`
2. Start Vite dev server: `npm run dev`
3. Open two browser tabs
4. Tab 1: Create Room → get room code
5. Tab 2: Join Room → enter code
6. Both should see countdown → game starts
7. Play through waves, test PvP jousting
8. Verify scores update for both players
9. Verify match ends after wave 5
10. Test rematch flow

**Step 3: Test quick match**

1. Open two tabs
2. Both click Quick Match
3. Should auto-match and start game

**Step 4: Fix bugs found during testing**

Common issues to watch for:
- Input lag (ensure inputs are applied immediately client-side)
- Position desync (tune interpolation timing)
- Enemy spawn positions overlapping players
- Score display not updating for both players
- Disconnection handling (opponent leaves mid-match)

**Step 5: Add disconnect handling to server**

In `party/server.ts` `onClose()`:
- If match is in progress, notify remaining player
- Award win to remaining player
- Clean up game state

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: multiplayer integration testing and polish"
```

---

### Task 11: Deploy PartyKit & Update Production Config

**Files:**
- Modify: `.env` (add production PartyKit host)
- Modify: `vercel.json` if needed

**Step 1: Deploy PartyKit**

Run: `npx partykit deploy`
Expected: Deployed to `flappy-knights.<username>.partykit.dev`

**Step 2: Update .env with production host**

```
VITE_PARTYKIT_HOST=flappy-knights.<username>.partykit.dev
```

**Step 3: Deploy Vercel**

Run: `vercel deploy --prod --yes`

**Step 4: Test production**

Open two browsers/devices, test the full multiplayer flow on the live URL.

**Step 5: Commit final config**

```bash
git add .env
git commit -m "feat: configure production PartyKit deployment"
```

---

## Task Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | PartyKit project setup | Small |
| 2 | Shared types & protocol | Small |
| 3 | Game server (physics, collisions, waves) | Large |
| 4 | Matchmaking server | Small |
| 5 | Client connection manager | Small |
| 6 | Multiplayer lobby scene | Medium |
| 7 | Multiplayer game scene | Large |
| 8 | Multiplayer results scene | Small |
| 9 | Server-side enemy AI | Medium |
| 10 | Integration testing & polish | Medium |
| 11 | Deploy & production config | Small |

**Critical path:** Tasks 1-3 must be sequential. Tasks 4-5 can parallel after Task 2. Tasks 6-8 can parallel after Task 5. Task 9 depends on Task 3. Task 10 depends on all others. Task 11 is last.
