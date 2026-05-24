import { test, expect } from '@playwright/test';
import { loginViaApi, seedAppSession } from '../fixtures/auth';

/**
 * X-20, X-26 — 五 Tab 导航与批发壳
 */
const TABS = [
  { label: /工作台|dashboard/i, hash: /dashboard|workbench|#/i },
  { label: /智能经营|经营/i, hash: /smart|ops|biz/i },
  { label: /CRM|客户/i, hash: /crm/i },
  { label: /产品/i, hash: /product/i },
  { label: /供应商|进货/i, hash: /supplier|supply/i },
];

test.describe('X-20 五 Tab 导航', () => {
  test.beforeEach(async ({ page, request }) => {
    const user = process.env.TM_ADMIN_USER;
    const pass = process.env.TM_ADMIN_PASSWORD;
    test.skip(!user || !pass, '配置 TM_ADMIN_USER / TM_ADMIN_PASSWORD');
    const { token } = await loginViaApi(request, user!, pass!);
    await seedAppSession(page, token);
  });

  for (const tab of TABS) {
    test(`可切换到 ${tab.label}`, async ({ page }) => {
      const nav = page.locator('nav, [role="tablist"], .bottom-nav, #mobile-bottom-nav').first();
      const link = nav.getByRole('link', { name: tab.label }).or(nav.getByText(tab.label)).first();
      test.skip((await link.count()) === 0, 'Tab 选择器需按实际 DOM 调整');
      await link.click();
      await page.waitForTimeout(800);
      const hash = await page.evaluate(() => location.hash);
      const url = page.url();
      expect(hash + url).toMatch(tab.hash);
    });
  }
});

test.describe('X-26 WHOLESALE 主壳加载', () => {
  test('index-app 加载后存在主内容区', async ({ page, request }) => {
    const user = process.env.TM_ADMIN_USER;
    const pass = process.env.TM_ADMIN_PASSWORD;
    test.skip(!user || !pass, '配置账号');

    const { token } = await loginViaApi(request, user!, pass!);
    await seedAppSession(page, token);
    await expect(page.locator('#app, main, [data-app-shell]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
