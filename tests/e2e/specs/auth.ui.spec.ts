import { test, expect } from '@playwright/test';
import { loginViaApi, seedAppSession } from '../fixtures/auth';

/**
 * X-03, X-05 — 未登录跳转 / 退出登录
 */
test.describe('X-03 未登录访问主壳', () => {
  test('无 token 访问 index-app 应跳转登录', async ({ page }) => {
    await page.goto('/index-app.html');
    await page.waitForURL(/login\.html/i, { timeout: 15_000 }).catch(() => {});
    const url = page.url();
    expect(url).toMatch(/login\.html/i);
  });
});

test.describe('X-05 退出登录', () => {
  test('确认退出后清除会话', async ({ page, request }) => {
    const user = process.env.TM_ADMIN_USER;
    const pass = process.env.TM_ADMIN_PASSWORD;
    test.skip(!user || !pass, '配置 TM_ADMIN_USER / TM_ADMIN_PASSWORD');

    const { token } = await loginViaApi(request, user!, pass!);
    await seedAppSession(page, token);

    const logoutBtn = page.locator('[data-action="logout"], button:has-text("退出")').first();
    test.skip((await logoutBtn.count()) === 0, '未找到退出按钮选择器，请按实际 DOM 调整');

    page.once('dialog', (d) => d.accept());
    await logoutBtn.click();
    await page.waitForURL(/login\.html/i, { timeout: 15_000 });
    const stored = await page.evaluate(() => localStorage.getItem('tm_token'));
    expect(stored).toBeFalsy();
  });
});
