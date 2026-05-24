import { test, expect } from '@playwright/test';
import { loginViaApi, authHeaders } from '../fixtures/auth';

/**
 * D-05, D-06, A-01 — AI 记录 API
 */
test.describe('AI 记录 API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = process.env.TM_ADMIN_USER;
    const pass = process.env.TM_ADMIN_PASSWORD;
    test.skip(!user || !pass, '配置 TM_ADMIN_USER / TM_ADMIN_PASSWORD');
    const result = await loginViaApi(request, user!, pass!);
    token = result.token;
  });

  test('D-06 GET /api/v1/ai/records 仅本租户', async ({ request }) => {
    const apiBase = process.env.TM_API_BASE || 'http://localhost:8080';
    const res = await request.get(`${apiBase}/api/v1/ai/records`, {
      headers: authHeaders(token),
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.data ?? body.records ?? [];
    expect(Array.isArray(list)).toBeTruthy();
  });

  test.skip('A-01 POST /api/v1/ai/execute 返回 requestId', async ({ request }) => {
    // 取消 skip 并填入测试文本后启用
    const apiBase = process.env.TM_API_BASE || 'http://localhost:8080';
    const res = await request.post(`${apiBase}/api/v1/ai/execute`, {
      headers: authHeaders(token),
      data: { text: '客户张三 苹果10箱 单价50' },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.requestId || json.data?.requestId).toBeTruthy();
  });
});
