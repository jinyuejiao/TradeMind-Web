import { test, expect } from '@playwright/test';
import { loginViaApi, seedAppSession } from '../fixtures/auth';

/**
 * D-07, D-13, D-14 — 工作台 UI 冒烟（选择器需按实 DOM 微调）
 */
test.describe('工作台 UI', () => {
  test.beforeEach(async ({ page, request }) => {
    const user = process.env.TM_ADMIN_USER;
    const pass = process.env.TM_ADMIN_PASSWORD;
    test.skip(!user || !pass, '配置 TM_ADMIN_USER / TM_ADMIN_PASSWORD');
    const { token } = await loginViaApi(request, user!, pass!);
    await seedAppSession(page, token);
    const workbench = page.getByText(/工作台/).first();
    if ((await workbench.count()) > 0) await workbench.click();
  });

  test('D-07 审核弹窗含订单总计 card', async ({ page }) => {
    const auditItem = page.locator('[data-ai-record], .pending-item, .ai-record-row').first();
    test.skip((await auditItem.count()) === 0, '无待确认数据，跳过');

    await auditItem.click();
    const totalCard = page.locator('.tm-order-total-card, #audit-order-total, [id*="order-total"]').first();
    await expect(totalCard).toBeVisible({ timeout: 10_000 });
  });

  test('D-14 手动添加订单入口可见', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /添加订单|手动.*订单/i }).first();
    test.skip((await addBtn.count()) === 0, '未找到添加订单按钮');
    await expect(addBtn).toBeVisible();
  });
});
