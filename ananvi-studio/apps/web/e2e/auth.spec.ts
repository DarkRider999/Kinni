// apps/web/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register');

    await page.fill('[name="name"]', 'E2E Tester');
    await page.fill('[name="email"]', `e2e-${Date.now()}@test.com`);
    await page.fill('[name="password"]', 'Str0ng!Pass99');
    await page.fill('[name="confirmPassword"]', 'Str0ng!Pass99');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/studio', { timeout: 10000 });
    await expect(page.locator('[data-testid="user-menu"]'))
      .toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'seeded@test.com');
    await page.fill('[name="password"]', 'Str0ng!Pass99');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/studio');
  });

  test('should show validation errors for weak password', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[name="password"]', '123');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout and clear session', async ({ page }) => {
    await loginAsSeededUser(page);
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');

    await expect(page).toHaveURL('/login');
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/login/);
  });
});

// apps/web/e2e/studio.spec.ts
test.describe('Studio — Job Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page);
  });

  test('should create a new clipping job', async ({ page }) => {
    await page.goto('/studio');
    await page.fill('[data-testid="url-input"]',
      'https://youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('[data-testid="clip-button"]');

    // Should show job in queue
    await expect(page.locator('[data-testid="job-status"]'))
      .toContainText('Processing', { timeout: 15000 });
  });

  test('should show credit balance', async ({ page }) => {
    await page.goto('/studio');
    const balance = page.locator('[data-testid="credit-balance"]');
    await expect(balance).toBeVisible();
    await expect(balance).toContainText(/\d+/);
  });

  test('should configure caption style', async ({ page }) => {
    await page.goto('/studio');
    await page.click('[data-testid="style-selector"]');

    const styles = page.locator('[data-testid="style-option"]');
    await expect(styles).toHaveCount(6); // 6 presets

    await styles.nth(0).click();
    await expect(page.locator('[data-testid="selected-style"]'))
      .toContainText('wavy');
  });
});

// apps/web/e2e/admin.spec.ts
test.describe('Admin Dashboard', () => {
  test('should show admin login page', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('h1')).toContainText('Admin');
    await expect(page.locator('[name="username"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
  });

  test('should show analytics dashboard for super_admin', async ({ page }) => {
    await loginAsAdmin(page, 'super_admin');
    await page.goto('/admin');

    await expect(page.locator('[data-testid="stat-card"]'))
      .toHaveCount(6);
  });

  test('should hide database utilities from admin role', async ({ page }) => {
    await loginAsAdmin(page, 'admin');
    await page.goto('/admin');

    await expect(page.locator('[data-testid="nav-database"]'))
      .not.toBeVisible();
  });
});
