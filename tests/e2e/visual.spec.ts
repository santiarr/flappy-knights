import { test, expect } from '@playwright/test';

test.describe('Flappy Knights — Visual Regression', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('canvas', { timeout: 10000 });
    });

    test('title screen screenshot', async ({ page }) => {
        // Let animations settle briefly
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('title-screen.png', {
            maxDiffPixels: 3000,
        });
    });

    test('gameplay screenshot', async ({ page }) => {
        // Start the game
        await page.keyboard.press('Space');

        // Wait for scene transition + initial gameplay
        await page.waitForTimeout(2000);

        // Gameplay has continuous animation (enemies, player, particles) so
        // screenshots will never stabilize. Use a single snapshot comparison
        // with a generous pixel ratio tolerance.
        const canvas = page.locator('canvas');
        const screenshot = await canvas.screenshot();
        expect(screenshot.byteLength).toBeGreaterThan(5000);

        // Store a baseline on first run via --update-snapshots; subsequent
        // runs compare with maxDiffPixelRatio to catch major regressions
        // while tolerating frame-to-frame animation differences.
        await expect(page).toHaveScreenshot('gameplay.png', {
            maxDiffPixelRatio: 0.05,
            timeout: 3000,
            animations: 'allow',
        });
    });

    test('game over screenshot', async ({ page }) => {
        // Start the game
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);

        // Wait for player to die (gravity + enemies, ~20s max)
        await page.waitForTimeout(20000);

        // Let game over screen load
        await page.waitForTimeout(1000);

        // Game over has particle rain and tweens — same approach as gameplay.
        await expect(page).toHaveScreenshot('game-over.png', {
            maxDiffPixelRatio: 0.05,
            timeout: 3000,
            animations: 'allow',
        });
    });
});
