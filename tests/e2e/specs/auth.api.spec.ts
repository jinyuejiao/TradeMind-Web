import { test, expect } from '@playwright/test';
import { loginViaApi, authHeaders, envOrSkip } from '../fixtures/auth';

/**
 * X-02, X-04 — 登录与 Token 校验
 * 用例 ID 见 .trae/docs/test-plan-wholesale.csv
 */
test.describe('X-02 租户登录 API', () => {
  test('POST /api/v1/tenant/login 返回 JWT', async ({ request }) => {
    const user = process.env.TM_ADMIN_USER;
    const pass = process.env.TM_ADMIN_PASSWORD;
    test.skip(!user || !pass, '配置 TM_ADMIN_USER / TM_ADMIN_PASSWORD');

    const result = await loginViaApi(request, user!, pass!);
    expect(result.token).toBeTruthy();
    expect(result.token!.split('.').length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('X-04 Token 无效', () => {
  test('篡改 JWT 访问业务接口应 401/403', async ({ request }) => {
    const apiBase = process.env.TM_API_BASE || 'http://localhost:8080';
    const res = await request.get(`${apiBase}/api/v1/products`, {
      headers: authHeaders('invalid.token.here'),
    });
    expect([401, 403]).toContain(res.status());
  });
});
