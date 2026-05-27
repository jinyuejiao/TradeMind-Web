import { test, expect } from '@playwright/test';
import { loginViaApi, seedAppSession } from '../fixtures/auth';

/**
 * X-22 — 角色门控（仓库员示例）
 */
test.describe('WAREHOUSE 角色', () => {
  test('仓库员不可见管理员专属控件', async ({ page, request }) => {
    const user = process.env.TM_WAREHOUSE_USER || process.env.TM_READONLY_USER;
    const pass = process.env.TM_WAREHOUSE_PASSWORD || process.env.TM_READONLY_PASSWORD;
    test.skip(!user || !pass, '配置 TM_WAREHOUSE_USER / TM_WAREHOUSE_PASSWORD');

    const { token } = await loginViaApi(request, user!, pass!);
    await page.addInitScript(
      (t) => {
        localStorage.setItem('tm_token', t);
        localStorage.setItem('token', t);
        localStorage.setItem(
          'tm_user_info',
          JSON.stringify({ merchantType: 'WHOLESALE', roleType: 'WAREHOUSE' }),
        );
      },
      token,
    );
    await page.goto('/index-app.html');
    await page.waitForLoadState('domcontentloaded');

    const adminOnly = page.locator('[data-role="ADMIN"]');
    if ((await adminOnly.count()) > 0) {
      await expect(adminOnly.first()).toHaveCount(0);
    }
  });
});
