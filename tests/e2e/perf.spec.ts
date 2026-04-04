import { test, expect } from '@playwright/test';

test.describe('Flappy Knights — Performance', () => {

    test('page loads in under 5 seconds', async ({ page }) => {
        const start = Date.now();

        await page.goto('/');
        await page.waitForSelector('canvas', { timeout: 5000 });

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(5000);
    });

    test('canvas renders without errors', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        page.on('pageerror', (err) => {
            errors.push(err.message);
        });

        await page.goto('/');
        await page.waitForSelector('canvas', { timeout: 10000 });

        // Wait for Phaser to fully initialize
        await page.waitForTimeout(2000);

        // Filter for WebGL/Phaser-related errors (ignore benign warnings)
        const criticalErrors = errors.filter((e) =>
            /webgl|phaser|canvas|context/i.test(e) &&
            !/deprecated|warning/i.test(e)
        );

        expect(criticalErrors).toEqual([]);
    });
});
