import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:3000',
        viewport: { width: 540, height: 960 },
    },
    webServer: {
        command: 'npm run dev-nolog',
        port: 3000,
        reuseExistingServer: true,
    },
});
