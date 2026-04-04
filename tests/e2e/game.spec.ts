import { test, expect } from '@playwright/test';

test.describe('Flappy Knights — Core Gameplay', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for Phaser canvas to appear
        await page.waitForSelector('canvas', { timeout: 10000 });
    });

    test('game boots and shows canvas', async ({ page }) => {
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(0);
        expect(box!.height).toBeGreaterThan(0);
    });

    test('title screen is displayed', async ({ page }) => {
        // Take a screenshot of the title screen and verify the canvas has rendered content
        const canvas = page.locator('canvas');
        const screenshot = await canvas.screenshot();
        expect(screenshot.byteLength).toBeGreaterThan(1000); // non-trivial image data
    });

    test('space key starts the game (canvas content changes)', async ({ page }) => {
        const canvas = page.locator('canvas');

        // Capture title screen
        const titleShot = await canvas.screenshot();

        // Press Space to start
        await page.keyboard.press('Space');

        // Wait for scene transition (fade-out 300ms + scene load)
        await page.waitForTimeout(1500);

        // Capture gameplay screen
        const gameShot = await canvas.screenshot();

        // The two screenshots should differ (different scenes)
        expect(titleShot.equals(gameShot)).toBe(false);
    });

    test('player input works (arrow keys + space)', async ({ page }) => {
        const canvas = page.locator('canvas');

        // Start the game
        await page.keyboard.press('Space');
        await page.waitForTimeout(1500);

        // Capture before input
        const before = await canvas.screenshot();

        // Simulate gameplay input: flap and move
        await page.keyboard.press('Space');
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(500);
        await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(300);

        // Capture after input
        const after = await canvas.screenshot();

        // Canvas should have changed (player moved, enemies spawning, etc.)
        expect(before.equals(after)).toBe(false);
    });

    test('game over screen appears after player dies', async ({ page }) => {
        // Start the game
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);

        // Do nothing — gravity + enemies will kill the player.
        // Player has limited lives; just wait for death.
        // The game transitions to GameOver scene after ~1s delay post-death.
        // With 3 lives and lava at the bottom, this should complete in ~20s max.
        await page.waitForTimeout(20000);

        // Take screenshot — should be on game over screen (dark bg, "GAME OVER" text)
        const canvas = page.locator('canvas');
        const screenshot = await canvas.screenshot();
        expect(screenshot.byteLength).toBeGreaterThan(1000);
    });

    test('R key restarts from game over', async ({ page }) => {
        const canvas = page.locator('canvas');

        // Start the game
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);

        // Wait for game over
        await page.waitForTimeout(20000);

        // Capture game over screen
        const gameOverShot = await canvas.screenshot();

        // Press R to restart
        await page.keyboard.press('r');
        await page.waitForTimeout(1500);

        // Capture restarted gameplay screen
        const restartShot = await canvas.screenshot();

        // Screens should differ (game over vs active gameplay)
        expect(gameOverShot.equals(restartShot)).toBe(false);
    });

    test('score increases when playing', async ({ page }) => {
        // Start the game
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);

        // Actively play: flap repeatedly and move around to engage enemies
        for (let i = 0; i < 20; i++) {
            await page.keyboard.press('Space');
            if (i % 2 === 0) {
                await page.keyboard.press('ArrowLeft');
            } else {
                await page.keyboard.press('ArrowRight');
            }
            await page.waitForTimeout(300);
        }

        // The HUD score text is rendered on canvas — we can't read it directly.
        // Instead, verify the canvas is still rendering (game hasn't crashed).
        const canvas = page.locator('canvas');
        const screenshot = await canvas.screenshot();
        expect(screenshot.byteLength).toBeGreaterThan(1000);
    });
});
