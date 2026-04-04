# Joust Clone - Design Brief

## Concept Summary
A faithful recreation of the classic 1982 arcade game Joust, built as a Phaser 3 TypeScript browser game. Players control a knight riding a flying ostrich, battling enemy knights on buzzards through increasingly difficult waves. Combat is determined by vertical positioning — the higher rider wins.

## Core Mechanics

### Flying / Flap
- Tap Space or tap the middle third of the screen to flap wings, applying an upward force
- Gravity constantly pulls the player down
- Left/Right arrows or tapping the left/right thirds of the screen for horizontal movement
- Screen wraps horizontally (exit left, enter right)

### Combat
- When the player and an enemy overlap, compare vertical positions
- The rider whose mount is HIGHER (lower Y value) defeats the other
- If heights are roughly equal, both bounce off each other
- Defeated enemies drop collectible eggs

### Eggs
- Eggs land on platforms and have a 5-second hatch timer
- Collecting an egg awards bonus points (250/500/750 based on enemy type)
- If an egg hatches, a tougher enemy spawns in its place

### Waves
- Each wave spawns a set of enemies (Bounders, Hunters, Shadow Lords)
- Clear all enemies and collect/let hatch all eggs to advance
- Later waves feature more enemies and tougher types

## Win/Lose Conditions
- **Win condition**: Survive as long as possible, achieve the highest score
- **Lose condition**: Lose all 3 lives (hit by enemies from above, or fall into lava)

## Entity Interactions

### Player (Golden Knight on Ostrich)
- Collides with platforms (lands on them)
- Overlaps with enemies (triggers combat)
- Overlaps with eggs (collects them)
- Overlaps with lava (instant life loss)

### Enemies (Bounder / Hunter / Shadow Lord)
- Three types with increasing speed: Bounder (red, slow), Hunter (gray, medium), Shadow Lord (blue, fast)
- AI flies toward player, tries to position above
- Collide with platforms
- Die in lava
- Defeated by player when player is higher

### Eggs
- Dropped by defeated enemies
- Land on platforms via gravity
- Collectible by player for points
- Hatch into tougher enemies after 5 seconds

### Platforms
- Static physics bodies arranged in classic Joust layout
- Ground level with gaps, middle tiers, and top platforms
- All entities collide with platforms

### Lava
- Animated wavy surface at the bottom of the screen
- Kills player (loses a life) and enemies on contact
- Visual: orange/red with animated wave surface and glowing bubbles
