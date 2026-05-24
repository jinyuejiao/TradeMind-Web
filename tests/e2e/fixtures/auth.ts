import { createHash } from 'crypto';
import { APIRequestContext, Page } from '@playwright/test';

export type LoginResult = {
  token: string;
  tenantId?: string;
  merchantType?: string;
  accessMode?: string;
  role?: string;
};

function hashPassword(plain: string, useMd5: boolean): string {
  if (!useMd5) return plain;
  return createHash('md5').update(plain, 'utf8').digest('hex');
}

export async function loginViaApi(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<LoginResult> {
  const apiBase = process.env.TM_API_BASE || 'http://localhost:8080';
  const useMd5 = process.env.TM_PASSWORD_IS_MD5 === 'true';
  const res = await request.post(`${apiBase}/api/v1/tenant/login`, {
    data: {
      username,
      password: hashPassword(password, useMd5),
    },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`login failed ${res.status()}: ${body}`);
  }
  const json = await res.json();
  const token = json.token || json.data?.token;
  if (!token) throw new Error('login response missing token');
  return {
    token,
    tenantId: json.tenantId ?? json.data?.tenantId,
    merchantType: json.merchantType ?? json.data?.merchantType,
    accessMode: json.accessMode ?? json.data?.accessMode,
    role: json.role ?? json.data?.role,
  };
}

/** 在浏览器中注入 token，打开批发主壳 */
export async function seedAppSession(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('tm_token', t);
    localStorage.setItem(
      'tm_user_info',
      JSON.stringify({ merchantType: 'WHOLESALE', role: 'ADMIN' }),
    );
  }, token);
  await page.goto('/index-app.html');
  await page.waitForLoadState('domcontentloaded');
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function envOrSkip(key: string): string | undefined {
  const v = process.env[key];
  if (!v) return undefined;
  return v;
}
