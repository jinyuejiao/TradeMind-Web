/**
 * 验证 P0：EXTRACTING 状态不可 DELETE
 * 用法: node scripts/verify-p0-extracting-delete.mjs
 * 环境变量: TM_TEST_USER=jin TM_TEST_PASS=123456
 */
import crypto from 'crypto';

const API = process.env.TM_API_BASE || 'http://localhost:8080';
const USER = process.env.TM_TEST_USER || 'jin';
const PASS = process.env.TM_TEST_PASS || '123456';

function md5(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

const login = await req('/api/v1/tenant/login', {
  method: 'POST',
  body: { userName: USER, password: md5(PASS) },
});
const token = login.json?.token;
if (!token) {
  console.error('登录失败', login.status, login.json);
  process.exit(1);
}
console.log('✓ 登录成功', USER);

const text = '客户王五 橙子5箱 单价40';
const ex = await req('/api/v1/ai/execute', {
  method: 'POST',
  token,
  body: {
    taskType: 'ORDER_EXTRACT',
    inputType: 'TEXT',
    payload: { text },
  },
});
const requestId = ex.json?.requestId;
if (!requestId) {
  console.error('execute 失败', ex.json);
  process.exit(1);
}
console.log('✓ execute', requestId);

let recordId = null;
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const st = await req(`/api/v1/ai/status/${requestId}`, { token });
  if (st.json?.status === 'EXTRACTING') {
    const recs = await req('/api/v1/ai/records', { token });
    const list = Array.isArray(recs.json) ? recs.json : recs.json?.data || [];
    const hit = list.find((r) => r.requestId === requestId || r.request_id === requestId);
    recordId = hit?.id ?? hit?.recordId;
    if (recordId) break;
  }
  if (/SUCCESS|FAILED/.test(st.json?.status || '')) break;
}

if (!recordId) {
  const recs = await req('/api/v1/ai/records', { token });
  const list = Array.isArray(recs.json) ? recs.json : recs.json?.data || [];
  recordId = list[0]?.id ?? list[0]?.recordId;
}

if (!recordId) {
  console.error('未找到 recordId');
  process.exit(1);
}

const del = await req(`/api/v1/ai/records/${recordId}`, { method: 'DELETE', token });
if (del.status === 409) {
  console.log('✓ P0 通过: EXTRACTING 时 DELETE 返回 409', del.json?.message);
} else {
  console.error('✗ P0 失败: 期望 409，实际', del.status, del.json);
  process.exit(1);
}

// 等待 SUCCESS 后应可删除
console.log('等待识别完成…');
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const st = await req(`/api/v1/ai/status/${requestId}`, { token });
  if (/SUCCESS|FAILED/.test(st.json?.status || '')) {
    console.log('  状态', st.json.status);
    break;
  }
}

const del2 = await req(`/api/v1/ai/records/${recordId}`, { method: 'DELETE', token });
if (del2.ok || del2.status === 200) {
  console.log('✓ SUCCESS 后可删除', del2.status);
} else {
  console.log('? 完成后删除', del2.status, del2.json?.message);
}
