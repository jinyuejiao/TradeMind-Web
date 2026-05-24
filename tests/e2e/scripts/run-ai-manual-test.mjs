/**
 * 自助注册 + AI 用例联调（输出 JSON 报告）
 * node scripts/run-ai-manual-test.mjs
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.TM_API_BASE || 'http://localhost:8080';
const ts = Date.now().toString().slice(-8);
const PHONE = `139${ts.slice(0, 8)}`.slice(0, 11);
const USER = `tm_ai_${ts}`;
const PASS = 'Test@123456';
const COMPANY = `AI测试商户${ts}`;

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
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

const report = {
  meta: { api: API, user: USER, phone: PHONE, at: new Date().toISOString() },
  steps: [],
};

function step(id, name, status, detail) {
  report.steps.push({ id, name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '-' : '?';
  console.log(`${icon} [${id}] ${name}: ${status}`, detail ? JSON.stringify(detail).slice(0, 200) : '');
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function registerViaOps() {
  const opsLogin = await req('/api/v1/tenant/login', {
    method: 'POST',
    body: {
      userName: 'ops_admin',
      password: 'ccfdc86aed008bff3e0e34af27610e6f',
    },
  });
  const opsToken = opsLogin.json?.token;
  if (!opsToken) {
    throw new Error('ops_admin 登录失败，无法创建测试租户');
  }
  const createRes = await req('/api/v1/tenant/create', {
    method: 'POST',
    token: opsToken,
    body: {
      username: USER,
      password: md5(PASS),
      phone: PHONE,
      tenantName: COMPANY,
      merchantType: 'WHOLESALE',
    },
  });
  return createRes;
}

async function main() {
  if (process.env.TM_USE_OPS_CREATE === '1') {
    const createRes = await registerViaOps();
    step(
      'X-01b',
      '运维 create 租户（免短信）',
      createRes.ok || createRes.status === 201 ? 'PASS' : 'FAIL',
      { status: createRes.status, tenantId: createRes.json?.tenantId },
    );
    if (!createRes.ok && createRes.status !== 201) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(1);
    }
  }

  // X-01 / send-code（公开注册，需真实短信验证码）
  const codeRes = await req('/api/v1/tenant/send-code', {
    method: 'POST',
    body: { phone: PHONE },
  });
  const smsToken = codeRes.json?.smsToken || 'MOCK-SMS-TOKEN';
  const mock = codeRes.json?.mock;
  if (process.env.TM_USE_OPS_CREATE !== '1') {
    step(
      'X-01',
      '发送注册验证码',
      codeRes.ok && codeRes.json?.success ? 'PASS' : 'FAIL',
      { status: codeRes.status, mock, message: codeRes.json?.message },
    );
  } else {
    step('X-01', '发送注册验证码', 'SKIP', { reason: '已用 ops create' });
  }

  // Register
  const regRes =
    process.env.TM_USE_OPS_CREATE === '1'
      ? { ok: true, status: 201, json: { success: true } }
      : await req('/api/v1/tenant/register', {
    method: 'POST',
          body: {
            username: USER,
            email: null,
            phone: PHONE,
            tenantName: COMPANY,
            tenantCode: '',
            password: md5(PASS),
            referralCode: '',
            smsToken,
            smsCode: '123456',
            merchantType: 'WHOLESALE',
          },
        });
  if (process.env.TM_USE_OPS_CREATE !== '1') {
    step(
      'X-01b',
      '批发商户注册',
      regRes.ok || regRes.status === 200 ? 'PASS' : 'FAIL',
      { status: regRes.status, body: regRes.json },
    );
  }
  if (!regRes.ok && regRes.status !== 200 && regRes.status !== 201) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // Login
  const loginRes = await req('/api/v1/tenant/login', {
    method: 'POST',
    body: { userName: USER, password: md5(PASS) },
  });
  const token =
    loginRes.json?.token ||
    loginRes.json?.data?.token ||
    (loginRes.json?.success && loginRes.json?.token);
  step(
    'X-02',
    '登录获取 JWT',
    token ? 'PASS' : 'FAIL',
    {
      status: loginRes.status,
      merchantType: loginRes.json?.user?.merchantType || loginRes.json?.merchantType,
      accessMode: loginRes.json?.user?.accessMode || loginRes.json?.accessMode,
    },
  );
  if (!token) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // A-01 / D-02 TEXT execute
  const orderText =
    '客户：张三水果店\n地址：杭州市西湖区文一路100号\n电话：13800138000\n商品：红富士苹果 10箱 单价50元/箱\n备注：明天上午送货';
  const execRes = await req('/api/v1/ai/execute', {
    method: 'POST',
    token,
    body: {
      taskType: 'ORDER_EXTRACT',
      inputType: 'TEXT',
      payload: { text: orderText },
    },
  });
  const requestId =
    execRes.json?.requestId ||
    execRes.json?.data?.requestId;
  step(
    'A-01',
    'POST /ai/execute 文本提单',
    requestId ? 'PASS' : 'FAIL',
    { status: execRes.status, requestId, message: execRes.json?.message },
  );

  // D-05 poll status
  let finalStatus = null;
  let statusDetail = null;
  if (requestId) {
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const st = await req(`/api/v1/ai/status/${requestId}`, { token });
      const s =
        st.json?.status ||
        st.json?.data?.status ||
        st.json?.state;
      statusDetail = { attempt: i + 1, status: s, http: st.status, body: st.json };
      if (s && /SUCCESS|COMPLETED|FAILED|ERROR/i.test(String(s))) {
        finalStatus = s;
        break;
      }
    }
  }
  step(
    'D-05',
    '轮询 /ai/status',
    finalStatus && /SUCCESS|COMPLETED/i.test(finalStatus)
      ? 'PASS'
      : finalStatus && /FAIL|ERROR/i.test(finalStatus)
        ? 'FAIL'
        : requestId
          ? 'FAIL'
          : 'SKIP',
    statusDetail,
  );

  // D-06 records
  const recRes = await req('/api/v1/ai/records', { token });
  const records = Array.isArray(recRes.json)
    ? recRes.json
    : recRes.json?.data || recRes.json?.records || [];
  const recordId = records[0]?.id || records[0]?.recordId;
  step(
    'D-06',
    'GET /ai/records 待确认列表',
    recRes.ok && Array.isArray(records) ? 'PASS' : 'FAIL',
    { count: records.length, firstId: recordId, status: recRes.status },
  );

  // A-03 update result
  if (recordId) {
    const aiPayload =
      records[0]?.aiResult || records[0]?.rawAiResult || '{"customer_data":{"name":"测试"}}';
    const putRes = await req(`/api/v1/ai/records/${recordId}/result`, {
      method: 'PUT',
      token,
      body: { aiResult: typeof aiPayload === 'string' ? aiPayload : JSON.stringify(aiPayload) },
    });
    step(
      'A-03',
      'PUT /ai/records/{id}/result',
      putRes.ok || putRes.status === 200 ? 'PASS' : 'FAIL',
      { status: putRes.status, message: putRes.json?.message },
    );
  } else {
    step('A-03', 'PUT /ai/records/{id}/result', 'SKIP', { reason: '无待确认记录' });
  }

  // D-15 delete — 须在 D-05 SUCCESS 之后，避免异步落库时记录已被删
  if (recordId && finalStatus && /SUCCESS|COMPLETED/i.test(finalStatus)) {
    const delRes = await req(`/api/v1/ai/records/${recordId}`, { method: 'DELETE', token });
    step(
      'D-15',
      'DELETE /ai/records/{id}',
      delRes.ok || delRes.status === 200 || delRes.status === 204 ? 'PASS' : 'FAIL',
      { status: delRes.status, message: delRes.json?.message },
    );
  } else if (recordId) {
    step('D-15', 'DELETE 待确认', 'SKIP', { reason: '任务未 SUCCESS，跳过删除以免干扰异步' });
  } else {
    step('D-15', 'DELETE 待确认', 'SKIP', null);
  }

  // Second execute for FAILED path test with empty text
  const badExec = await req('/api/v1/ai/execute', {
    method: 'POST',
    token,
    body: {
      taskType: 'ORDER_EXTRACT',
      inputType: 'TEXT',
      payload: { text: '   ' },
    },
  });
  step(
    'A-02',
    '空文本提单（期望拒绝或快速失败）',
    badExec.status >= 400 ? 'PASS' : badExec.json?.success === false ? 'PASS' : 'WARN',
    { status: badExec.status, body: badExec.json },
  );

  report.summary = {
    pass: report.steps.filter((s) => s.status === 'PASS').length,
    fail: report.steps.filter((s) => s.status === 'FAIL').length,
    skip: report.steps.filter((s) => s.status === 'SKIP').length,
    warn: report.steps.filter((s) => s.status === 'WARN').length,
    credentials: { user: USER, password: PASS, phone: PHONE },
  };

  const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '../reports/ai-test-result.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n报告已写入:', outFile);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
