import { test, expect } from '@playwright/test';
import { loginViaApi, authHeaders } from '../fixtures/auth';

/**
 * X-10, X-15 — 租户隔离
 */
test.describe('租户数据隔离', () => {
  test('X-10 租户 A token 不可读租户 B 资源', async ({ request }) => {
    const userA = process.env.TM_ADMIN_USER;
    const passA = process.env.TM_ADMIN_PASSWORD;
    const userB = process.env.TM_TENANT_B_USER;
    const passB = process.env.TM_TENANT_B_PASSWORD;
    test.skip(!userA || !passA || !userB || !passB, '配置双租户账号');

    const a = await loginViaApi(request, userA!, passA!);
    const b = await loginViaApi(request, userB!, passB!);
    const apiBase = process.env.TM_API_BASE || 'http://localhost:8080';

    const listRes = await request.get(`${apiBase}/api/v1/customers`, {
      headers: authHeaders(a.token),
    });
    expect(listRes.ok()).toBeTruthy();
    const customersA = await listRes.json();
    const idsA = new Set(
      (Array.isArray(customersA) ? customersA : customersA.data ?? [])
        .map((c: { id?: string }) => c.id)
        .filter(Boolean),
    );

    const probeRes = await request.get(`${apiBase}/api/v1/customers`, {
      headers: authHeaders(b.token),
    });
    expect(probeRes.ok()).toBeTruthy();
    const customersB = await probeRes.json();
    const idsB = (Array.isArray(customersB) ? customersB : customersB.data ?? [])
      .map((c: { id?: string }) => c.id)
      .filter(Boolean);

    for (const id of idsB) {
      if (!id) continue;
      const cross = await request.get(`${apiBase}/api/v1/customers/${id}`, {
        headers: authHeaders(a.token),
      });
      if (idsA.has(id)) continue;
      expect([403, 404]).toContain(cross.status());
    }
  });
});
