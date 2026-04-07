# Flappy Knights — 1v1 Online Multiplayer Design

## Overview

Add live online 1v1 competitive PvP multiplayer to Flappy Knights. Two players share the same arena, fight the same enemies, and can joust each other. Highest score after 5 waves wins.

## Architecture

### Backend: PartyKit (Cloudflare)

Authoritative game server. Each match is a PartyKit "party" (room).

**Server responsibilities:**
- Player connections (WebSocket per player)
- Game state sync (positions, velocities, scores, wave progression)
- Collision authority (server decides joust outcomes)
- Wave/enemy spawning (server controls the shared enemy pool)
- Physics simulation at 60hz, state broadcast at 20hz

**Two party files:**
- `party/game.ts` — the game room (physics, AI, collisions, scoring)
- `party/matchmaking.ts` — quick match queue, pairs players into rooms

### Client: Phaser Scenes

**New scenes:**
- `MultiplayerLobby` — create/join room UI, quick match, "waiting for opponent"
- `MultiplayerGame` — shared arena, receives state from PartyKit
- `MultiplayerResults` — winner display, final scores, rematch button

**Input model:** Client sends inputs only (`flap`, `left`, `right`, `stop`) at 60hz. Local player uses client-side prediction with server correction. Opponent sprite interpolates between server snapshots.

**Shared code:** Player rendering, Platform layout, LavaPit, Pterodactyl, Egg, SpectacleManager, all sprite/animation code. Only the state source changes (local physics vs server broadcast).

### Message Protocol

```
Client -> Server:
  { type: 'input', action: 'flap' | 'left' | 'right' | 'stop' }

Server -> Client:
  { type: 'state', players: [...], enemies: [...], eggs: [...], wave, phase }
  { type: 'event', name: 'joust_win' | 'enemy_killed' | ... }  // triggers local VFX/sound
```

### Room State

```
- players: Map of { id, x, y, vx, vy, score, lives, combo, isInvulnerable }
- enemies: Array of { id, type, x, y, vx, vy, aiState, isSmart }
- eggs: Array of { id, x, y, collected }
- wave: current wave number (1-5)
- phase: 'waiting' | 'countdown' | 'playing' | 'wave_transition' | 'finished'
- spawnQueue: enemies yet to spawn this wave
```

## Matchmaking

**Room codes:** Player creates a room, gets a 4-letter code, shares it. Friend joins with the code.

**Quick match:** Player clicks "Play Online", enters a queue managed by `party/matchmaking.ts`. When two players are waiting, server generates a room code and redirects both to the same game room.

## Combat Rules

### PvP Jousting
- **Height wins:** Player with higher Y position (lower on screen = higher lance) wins the collision
- **Tie zone:** If players are within ~5px of the same height, neither takes damage — they bounce apart
- **Reward:** Defeating opponent awards 1000 bonus points
- **Respawn:** Defeated player respawns after 2 seconds (no life lost)

### PvE (same as single-player)
- Bounder: 500 pts (enemy) + 250 pts (egg)
- Hunter: 750 pts (enemy) + 500 pts (egg)
- Shadow Lord: 1000 pts (enemy) + 750 pts (egg)
- Pterodactyl: 2000 pts
- Combos and streaks work normally

### Lives
- Each player has 3 lives from enemy hits (same as single-player)
- Losing all lives = out early, opponent plays remaining waves solo
- PvP jousting does NOT cost lives — only 2s respawn downtime

## Match Flow

1. Both players connect to room
2. 3-second countdown
3. Waves 1-5 play out (same enemy progression as single-player)
4. Wave 5 is survival wave with Pterodactyl
5. After wave 5: highest score wins
6. Tie: sudden-death wave 6, first to score wins
7. Results screen with rematch option

## Visual Design

- Two distinct knight colors (blue vs red) so players can tell each other apart
- Both scores shown in HUD side by side with gap indicator
- Opponent's name/label above their sprite

## Out of Scope (v1)

- Spectator mode
- Teams / 2v2
- In-game chat
- Ranked/ELO matchmaking
- More than 2 players per room
- Replay system
