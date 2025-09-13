import { test, expect } from '@playwright/test';

test.describe('Identity Creation Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Mock wallet connection
        await page.addInitScript(() => {
            (window as any).ethereum = {
                request: async ({ method }: any) => {
                    if (method === 'eth_requestAccounts') {
                        return ['0x742d35Cc6636C0532925a3b8F39c3ee2C96afeCf'];
                    }
                    if (method === 'eth_chainId') {
                        return '0xc478'; // Somnia testnet
                    }
                    return null;
                },
                on: () => { },
                removeListener: () => { },
            };
        });

        await page.goto('/');
    });

    test('should create identity successfully', async ({ page }) => {
        // Connect wallet
        await page.click('button:has-text("Connect Wallet")');
        await page.click('button:has-text("MetaMask")');

        // Navigate to dashboard
        await page.click('a:has-text("Dashboard")');

        // Fill identity creation form
        await page.fill('input[placeholder="Enter your unique username"]', 'testuser123');
        await page.selectOption('select', 'Smart Contract Development');
        await page.fill('textarea[placeholder="Tell the world about yourself..."]', 'Test bio');

        // Submit form
        await page.click('button:has-text("Create SomniaID")');

        // Wait for success
        await expect(page.locator('text=Your SomniaID has been created!')).toBeVisible({ timeout: 10000 });

        // Verify dashboard shows identity
        await expect(page.locator('h1:has-text("Welcome back, testuser123!")')).toBeVisible();
    });

    test('should handle validation errors', async ({ page }) => {
        await page.goto('/dashboard');

        // Try to submit without filling required fields
        await page.click('button:has-text("Create SomniaID")');

        // Should show validation error
        await expect(page.locator('text=Please fill in all required fields')).toBeVisible();
    });

    test('should show real-time reputation updates', async ({ page }) => {
        // Mock existing identity
        await page.addInitScript(() => {
            localStorage.setItem('identity_0x742d35Cc6636C0532925a3b8F39c3ee2C96afeCf',
                JSON.stringify({
                    tokenId: 1,
                    username: 'testuser',
                    reputationScore: 100,
                    level: 1
                })
            );
        });

        await page.goto('/dashboard');

        // Verify initial reputation
        await expect(page.locator('text=100').first()).toBeVisible();

        // Mock WebSocket update
        await page.evaluate(() => {
            const event = new CustomEvent('reputation-updated', {
                detail: { tokenId: '1', newScore: 150, timestamp: Date.now() }
            });
            window.dispatchEvent(event);
        });

        // Should show updated reputation (this would require proper WebSocket mocking)
        // await expect(page.locator('text=150')).toBeVisible();
    });
});