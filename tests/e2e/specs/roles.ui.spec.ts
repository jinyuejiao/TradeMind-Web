import { test, expect } from '@playwright/test';
import { loginViaApi, seedAppSession } from '../fixtures/auth';

/**
 * X-22, D-16, P-14 — 角色门控
 */
test.describe('READONLY 角色', () => {
  test('D-16 无确认入库按钮', async ({ page, request }) => {
    const user = process.env.TM_READONLY_USER;
    const pass = process.env.TM_READONLY_PASSWORD;
    test.skip(!user || !pass, '配置 TM_READONLY_USER / TM_READONLY_PASSWORD');

    const { token } = await loginViaApi(request, user!, pass!);
    await page.addInitScript(
      (t) => {
        localStorage.setItem('tm_token', t);
        localStorage.setItem(
          'tm_user_info',
          JSON.stringify({ merchantType: 'WHOLESALE', role: 'READONLY' }),
        );
      },
      token,
    );
    await page.goto('/index-app.html');
    await page.waitForLoadState('domcontentloaded');

    const confirmBtn = page.getByRole('button', {
      name: /确认入库|添加订单|保存/i,
    });
    const adminOnly = page.locator('[data-role="ADMIN"]');
    if ((await adminOnly.count()) > 0) {
      await expect(adminOnly.first()).toBeHidden();
    }
    const visibleDanger = confirmBtn.filter({ hasText: /确认入库|添加订单/ });
    if ((await visibleDanger.count()) > 0) {
      await expect(visibleDanger.first()).toBeHidden();
    }
  });
});
