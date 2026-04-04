#!/usr/bin/env node
/**
 * capture-promo.mjs — Record an autonomous promo video of Flappy Knights
 *
 * Uses Playwright to launch the game, disable death, generate Joust-style
 * input (flap + strafe), and save a .webm screen recording.
 *
 * Usage:
 *   node scripts/capture-promo.mjs [--port 3000] [--duration 13000] [--output-dir output]
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

// ── CLI args ───────────────────────────────────────────────────────────
const { values: args } = parseArgs({
    options: {
        port:       { type: 'string', default: '3000' },
        duration:   { type: 'string', default: '13000' },
        'output-dir': { type: 'string', default: 'output' },
    },
});

const PORT       = parseInt(args.port, 10);
const DURATION   = parseInt(args.duration, 10);
const OUTPUT_DIR = resolve(args['output-dir']);
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'promo-raw.webm');

// ── Viewport: 9:16 mobile portrait ────────────────────────────────────
const VP_WIDTH  = 1080;
const VP_HEIGHT = 1920;

// ── Helpers ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Generate a Joust-style input sequence.
 *
 * Returns an array of { time, action } where action is one of:
 *   'flap' | 'left-down' | 'right-down' | 'direction-up' | 'idle'
 *
 * The sequence alternates between moving left/right with periodic flaps,
 * with occasional pauses for gravity arcs.
 */
function generateInputSequence(durationMs) {
    const actions = [];
    let t = 0;
    let direction = 'right';

    const randBetween = (lo, hi) => lo + Math.random() * (hi - lo);

    while (t < durationMs) {
        // ── Hold a direction for 300-800ms, flapping every 200-400ms ──
        const holdTime = randBetween(300, 800);
        const holdEnd = Math.min(t + holdTime, durationMs);

        // Press direction
        actions.push({ time: t, action: `${direction}-down` });

        // Schedule flaps during this hold
        let flapT = t + randBetween(50, 150); // first flap soon after direction
        while (flapT < holdEnd) {
            actions.push({ time: flapT, action: 'flap' });
            flapT += randBetween(200, 400);
        }

        t = holdEnd;

        // Release direction
        actions.push({ time: t, action: 'direction-up' });

        // ── Occasionally pause (gravity arc) ~20% of the time ─────────
        if (Math.random() < 0.2) {
            const pauseTime = randBetween(200, 500);
            t += pauseTime;
            // Maybe one extra flap mid-pause for a small arc
            if (Math.random() < 0.5) {
                actions.push({ time: t - pauseTime * 0.5, action: 'flap' });
            }
        }

        // ── Switch direction ~60% of the time ─────────────────────────
        if (Math.random() < 0.6) {
            direction = direction === 'right' ? 'left' : 'right';
        }
    }

    // Sort by time (flaps inserted mid-hold may be out of order)
    actions.sort((a, b) => a.time - b.time);
    return actions;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log(`Launching Chromium at ${VP_WIDTH}x${VP_HEIGHT} ...`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: VP_WIDTH, height: VP_HEIGHT },
        recordVideo: {
            dir: OUTPUT_DIR,
            size: { width: VP_WIDTH, height: VP_HEIGHT },
        },
        // Bypass autoplay restrictions so audio init doesn't block
        bypassCSP: true,
    });
    const page = await context.newPage();

    // ── 1. Navigate and wait for load ─────────────────────────────────
    console.log(`Navigating to http://localhost:${PORT} ...`);
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);

    // ── 2. Press Space to skip title screen ───────────────────────────
    console.log('Pressing Space to skip title screen ...');
    await page.keyboard.press('Space');
    await sleep(500);

    // ── 3. Inject invulnerability patch ───────────────────────────────
    //
    // Strategy: Phaser stores its game instance. We iterate scenes every
    // 500ms, find the active Game scene, and:
    //   a) set GameState.lives to 999
    //   b) make player.damage() a no-op
    //   c) override isGameOver to false
    //   d) neutralise lava/hit handlers on the scene itself
    //
    console.log('Injecting invulnerability patch ...');
    await page.evaluate(() => {
        setInterval(() => {
            // Locate the Phaser game instance from the canvas element
            const canvas = document.querySelector('canvas');
            if (!canvas) return;

            // Phaser attaches the game to the parent div's dataset, but the
            // easiest universal way is to walk Phaser.GAMES (global registry).
            const games = window.Phaser?.GAMES;
            if (!games || games.length === 0) return;

            const game = games[0];
            const scenes = game.scene?.scenes;
            if (!scenes) return;

            for (const s of scenes) {
                // Match the Game scene by its key
                if (s.sys?.settings?.key !== 'Game') continue;
                if (!s.sys.isActive()) continue;

                // (a) Keep lives very high
                // GameState is a module-level singleton imported by the scene.
                // We can't import it, but the scene reads/writes GameState.lives
                // in playerHit / handlePlayerLava. We can patch those methods
                // directly on the scene instance.

                // (b) No-op the three death/damage paths
                if (s.playerHit && !s.__patched) {
                    s.__patched = true;

                    s.playerHit = () => {};
                    s.handlePlayerLava = () => {};
                    s.gameOver = () => {};

                    // Also make the player permanently invulnerable
                    if (s.player) {
                        s.player.damage = () => {};
                        // Force invulnerable flag off so alpha stays 1
                        s.player.isInvulnerable = false;
                    }
                }

                // Keep isGameOver false in case it somehow got set
                s.isGameOver = false;
            }
        }, 500);
    });

    // Small wait for patch to apply after first scene tick
    await sleep(600);

    // ── 4. Generate and execute the input sequence ────────────────────
    console.log(`Playing ${DURATION}ms of Joust-style gameplay ...`);
    const sequence = generateInputSequence(DURATION);

    let prevTime = 0;
    let directionHeld = null; // track which arrow key is currently held

    for (const { time, action } of sequence) {
        // Wait until the scheduled time
        const waitMs = time - prevTime;
        if (waitMs > 0) {
            await sleep(waitMs);
        }
        prevTime = time;

        switch (action) {
            case 'flap':
                await page.keyboard.press('Space');
                break;

            case 'left-down':
                // Release previous direction if held
                if (directionHeld === 'ArrowRight') {
                    await page.keyboard.up('ArrowRight');
                }
                await page.keyboard.down('ArrowLeft');
                directionHeld = 'ArrowLeft';
                break;

            case 'right-down':
                if (directionHeld === 'ArrowLeft') {
                    await page.keyboard.up('ArrowLeft');
                }
                await page.keyboard.down('ArrowRight');
                directionHeld = 'ArrowRight';
                break;

            case 'direction-up':
                if (directionHeld) {
                    await page.keyboard.up(directionHeld);
                    directionHeld = null;
                }
                break;

            default:
                break;
        }
    }

    // Release any held key
    if (directionHeld) {
        await page.keyboard.up(directionHeld);
    }

    // Brief cooldown so the video doesn't cut abruptly
    await sleep(500);

    // ── 5. Stop recording and save ────────────────────────────────────
    console.log('Stopping recording ...');
    await page.close();

    // Playwright saves the video on page/context close. Retrieve the path.
    const video = page.video();
    if (video) {
        const tmpPath = await video.path();
        // Rename to our desired output filename
        const { renameSync } = await import('node:fs');
        try {
            renameSync(tmpPath, OUTPUT_FILE);
            console.log(`Saved promo video to ${OUTPUT_FILE}`);
        } catch {
            console.log(`Video saved by Playwright at ${tmpPath}`);
            console.log(`(move it manually to ${OUTPUT_FILE} if rename failed)`);
        }
    }

    await context.close();
    await browser.close();

    console.log('Done.');
}

main().catch((err) => {
    console.error('Capture failed:', err);
    process.exit(1);
});
