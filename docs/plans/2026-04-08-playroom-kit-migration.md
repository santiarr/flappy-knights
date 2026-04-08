# Playroom Kit Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Colyseus with Playroom Kit for multiplayer — no server to host, simpler peer-to-peer model, host runs all physics locally.

**Architecture:** Playroom Kit uses a host-authoritative peer-to-peer model. The host player runs the full single-player Game scene with Phaser physics for ALL players. Each player sends their inputs via `player.setState("input", ...)`. The host reads those inputs, applies physics, and writes back positions via `player.setState("pos", ...)`. Non-host clients read positions and set sprite coordinates directly. No separate server. No Railway. No WebSocket management.

**Tech Stack:** Playroom Kit (`playroomkit`), Phaser 3

---

### Task 1: Remove Colyseus, Install Playroom Kit

**Files:**
- Modify: `package.json`
- Delete: `server/` directory (entire folder)
- Delete: `src/multiplayer/connection.ts`
- Modify: `.env` (remove VITE_COLYSEUS_URL)

**Step 1: Uninstall Colyseus packages**

```bash
npm uninstall colyseus @colyseus/schema @colyseus/sdk
```

**Step 2: Install Playroom Kit**

```bash
npm install playroomkit react react-dom
```

(react and react-dom are peer dependencies of playroomkit)

**Step 3: Delete the server directory**

```bash
rm -rf server/
```

**Step 4: Delete the Colyseus connection manager**

```bash
rm src/multiplayer/connection.ts
```

**Step 5: Remove VITE_COLYSEUS_URL from .env**

Remove the line `VITE_COLYSEUS_URL=...` from `.env`.

**Step 6: Remove server scripts from root package.json**

Remove `"server:dev"` script if it exists.

**Step 7: Verify build**

```bash
npm run build
```

Expected: Build will fail because files import from deleted connection.ts. That's fine — we'll fix in next tasks.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove Colyseus, install Playroom Kit"
```

---

### Task 2: Create Playroom Kit Wrapper

**Files:**
- Create: `src/multiplayer/playroom.ts`
- Modify: `src/multiplayer/types.ts` (simplify)

**Step 1: Create the Playroom wrapper**

This replaces `connection.ts`. It wraps Playroom Kit's API with typed helpers.

```typescript
// src/multiplayer/playroom.ts
import { insertCoin, onPlayerJoin, isHost, myPlayer, Joystick } from "playroomkit";

export interface PlayerJoinData {
  id: string;
  color: string;
  isMe: boolean;
  setState: (key: string, value: unknown) => void;
  getState: (key: string) => unknown;
  onQuit: (cb: () => void) => void;
}

let initialized = false;
let joystick: ReturnType<typeof Joystick> | null = null;

export async function initPlayroom(): Promise<void> {
  if (initialized) return;
  await insertCoin({ 
    maxPlayersPerRoom: 2,
    matchmaking: true,
  });
  initialized = true;
}

export function onJoin(callback: (player: PlayerJoinData) => void): void {
  onPlayerJoin((player) => {
    const profile = player.getProfile();
    callback({
      id: player.id,
      color: profile.color?.hex ?? "#ffffff",
      isMe: player.id === myPlayer()?.id,
      setState: (key, value) => player.setState(key, value),
      getState: (key) => player.getState(key),
      onQuit: (cb) => player.onQuit(cb),
    });
  });
}

export function getIsHost(): boolean {
  return isHost();
}

export function getMyId(): string {
  return myPlayer()?.id ?? "";
}

export function setMyInput(input: { action: string }): void {
  myPlayer()?.setState("input", input);
}

export { isHost, myPlayer };
```

**Step 2: Simplify types.ts**

Replace the contents of `src/multiplayer/types.ts` — remove all Colyseus-specific types, keep only what's needed:

```typescript
// src/multiplayer/types.ts
export interface PlayerResult {
  id: string;
  score: number;
  wave: number;
  bestCombo: number;
  enemiesDefeated: number;
  joustWins: number;
}
```

**Step 3: Delete constants.ts**

```bash
rm src/multiplayer/constants.ts
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Playroom Kit wrapper, simplify multiplayer types"
```

---

### Task 3: Rewrite Multiplayer Lobby

**Files:**
- Rewrite: `src/scenes/MultiplayerLobby.ts`

The lobby becomes much simpler with Playroom Kit. `insertCoin({ matchmaking: true })` handles both room creation and matchmaking automatically. Playroom Kit shows its own built-in UI for room creation/joining.

**Step 1: Rewrite the lobby**

The new lobby:
1. Shows "MULTIPLAYER" title
2. Shows a "START" button
3. On click: calls `initPlayroom()` which shows Playroom Kit's built-in lobby UI
4. Listens for `onPlayerJoin` — when 2 players are in, starts the MultiplayerGame scene
5. Has a BACK button to return to TitleScreen

Key change: Playroom Kit handles the room code UI, matchmaking, and connection. We just call `insertCoin()` and wait for players.

The lobby should:
- Call `initPlayroom()` when the player clicks START
- Use `onJoin()` to track connected players
- When 2 players have joined, transition to MultiplayerGame with `{ isHost: getIsHost(), myId: getMyId() }`

No more room code input, no more Create/Join/Quick Match buttons. Playroom Kit handles all of that.

**Step 2: Verify build and commit**

```bash
npm run build
git add src/scenes/MultiplayerLobby.ts
git commit -m "feat: rewrite lobby for Playroom Kit"
```

---

### Task 4: Rewrite Multiplayer Game Scene (Host Side)

**Files:**
- Rewrite: `src/scenes/MultiplayerGame.ts`

This is the biggest change. The host-authoritative model means:

**If isHost():**
- The host creates Player sprites for ALL connected players (using Phaser physics, same as single-player Game.ts)
- Each frame, reads each player's input via `player.getState("input")`
- Applies physics (gravity, flap, movement, platform collision — reuse the existing Player class)
- Runs enemy AI (reuse existing Enemy class with full Phaser physics)
- Checks collisions (player-vs-enemy jousting, player-vs-player jousting, player-vs-egg)
- Writes each player's position back: `player.setState("pos", { x, y, vx, vy, flipX, anim, score, lives, ... })`
- Writes enemy state: `setState("enemies", [{ id, type, x, y, flipX, anim, active }, ...])`  (global state, not per-player)
- Writes game state: `setState("game", { wave, phase })`

**If NOT host:**
- Creates sprite renderers for all players (no physics, just sprites)
- Each frame, reads each player's position via `player.getState("pos")` and sets sprite x/y
- Reads enemy state and renders enemy sprites
- Reads game state for HUD
- Sends own input: `myPlayer().setState("input", { action: "flap" | "left" | "right" | "stop" })`

**Key insight:** The host's game logic is essentially the single-player `Game.ts` scene but with multiple Player objects controlled by remote inputs instead of local keyboard. We can reuse the existing Player, Enemy, Egg, Platform, LavaPit classes AS-IS because the host runs real Phaser physics.

**Implementation approach:**

The MultiplayerGame scene should:
1. `create()`: Call `onJoin()` to set up players. For the host, create full physics Player objects. For non-host, create plain sprites.
2. `update()`: 
   - Host: read inputs, update all players/enemies, write state
   - Non-host: read state, update sprite positions
3. Reuse `drawCaveBackground()`, `Platform.createAll()`, `LavaPit` from Game.ts
4. Reuse the combat logic from Game.ts (handleCombat, defeatEnemy, etc.)

**For the host, the update loop looks like:**
```typescript
update(time, delta) {
  if (getIsHost()) {
    // Read each player's input
    for (const p of this.players) {
      const input = p.state.getState("input");
      // Apply to their Player physics object
      if (input?.action === "flap") p.player.flap();
      if (input?.action === "left") p.player.moveLeft(delta);
      if (input?.action === "right") p.player.moveRight(delta);
      if (input?.action === "stop") p.player.stopHorizontal();
      
      p.player.update(time, delta);
      
      // Write position back
      p.state.setState("pos", {
        x: p.player.x, y: p.player.y,
        flipX: p.player.flipX,
        anim: p.player.anims.currentAnim?.key,
        score: p.score, lives: p.lives,
        isInvulnerable: p.player.getIsInvulnerable(),
      });
    }
    
    // Update enemies (same as Game.ts)
    // Check collisions (same as Game.ts)
    // Write enemy state
  } else {
    // Non-host: read positions and update sprites
    for (const p of this.players) {
      const pos = p.state.getState("pos");
      if (pos) {
        p.sprite.x = pos.x;
        p.sprite.y = pos.y;
        p.sprite.setFlipX(pos.flipX);
        if (pos.anim && p.sprite.anims?.currentAnim?.key !== pos.anim) {
          p.sprite.play(pos.anim, true);
        }
      }
    }
  }
}
```

**Step 1: Implement the full scene**

Read the current `src/scenes/Game.ts` to understand the single-player physics loop. The host's MultiplayerGame is a copy of that loop but with multiple players and remote input.

**Step 2: Verify build and commit**

```bash
npm run build
git add src/scenes/MultiplayerGame.ts
git commit -m "feat: rewrite multiplayer game scene for Playroom Kit host-authoritative model"
```

---

### Task 5: Rewrite Multiplayer Results + Wire Up main.ts

**Files:**
- Modify: `src/scenes/MultiplayerResults.ts`
- Modify: `src/main.ts` (remove Colyseus imports, update scene list)

**Step 1: Simplify results scene**

Remove Colyseus connection references. The results data is passed via scene data (same as before). The REMATCH button calls `initPlayroom()` again. MAIN MENU goes to TitleScreen.

**Step 2: Clean up main.ts**

Remove any Colyseus imports. Ensure all multiplayer scenes are registered. The Playroom Kit initialization happens in the lobby, not in main.ts.

**Step 3: Verify full build**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: update results scene and main.ts for Playroom Kit"
```

---

### Task 6: Test and Deploy

**Step 1: Test locally**

```bash
npm run dev
```

Open two browser tabs. Click Multiplayer → START in both. Playroom Kit should show its lobby UI, match the players, and start the game.

**Step 2: Deploy to Vercel**

```bash
npm run build
vercel deploy --prod --yes
```

No Railway deploy needed — there's no server anymore!

**Step 3: Test production**

Open https://flappy-knights.vercel.app on two devices. Test the full multiplayer flow.

**Step 4: Commit any fixes and push**

```bash
git push origin main
```

---

## Summary

| Task | Description | Complexity |
|------|-------------|-----------|
| 1 | Remove Colyseus, install Playroom Kit | Small |
| 2 | Create Playroom wrapper + simplify types | Small |
| 3 | Rewrite lobby (much simpler) | Medium |
| 4 | Rewrite game scene (host runs physics) | Large |
| 5 | Update results + main.ts | Small |
| 6 | Test and deploy | Small |

**Key advantage:** No server to maintain. No Railway costs. No WebSocket management. No Schema serialization. The host's browser runs the same Phaser physics as single-player. Playroom Kit handles all the networking.

**Key risk:** Host's browser is the server — if they have a slow connection or close the tab, the game ends. For a casual 1v1 game, this is acceptable.
