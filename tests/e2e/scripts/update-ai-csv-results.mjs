/**
 * 为 test-plan-wholesale.csv 的 AI 相关行补充「测试结果」列
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const csvPath = path.resolve(
  fileURLToPath(new URL('../../../../.trae/docs/test-plan-wholesale.csv', import.meta.url)),
);
const reportPath = path.resolve(
  fileURLToPath(new URL('../reports/ai-csv-cases-result.json', import.meta.url)),
);

const AI_RESULTS = {
  'D-02': '通过-API文本提单jin账号2026-05-24',
  'D-03': '未测-需麦克风实机人工',
  'D-04': '未测-需拍照/选图人工',
  'D-05': '通过-轮询SUCCESS约80s',
  'D-06': '通过-GET records租户隔离正常',
  'D-07': '部分通过-API aiResult含客户/明细;UI审核总计卡未自动化',
  'D-08': '部分通过-aiResult含order items;新产品Tab未UI验证',
  'D-09': '部分通过-customer_data新客户草稿结构正常',
  'D-10': '未测-新租户无客户产品未走确认入库全链路',
  'D-11': '通过-存为草稿仅关闭弹窗记录仍在待确认',
  'D-15': '通过-EXTRACTING删409;SUCCESS后可删(P0已修)',
  'A-01': '通过-返回requestId异步非阻塞',
  'A-02': '待改进-空文本API仍200;非法taskType未断言FAILED',
  'A-03': '通过-PUT aiResult字段',
  'A-04': '未测-subscription/me无energy扣减字段',
  'A-05': '部分通过-1条文本样本结构合理;20份抽检未做',
  'B-08': '未测-需UI打开智能经营AI报告',
};

let extra = {};
if (fs.existsSync(reportPath)) {
  extra = JSON.parse(fs.readFileSync(reportPath, 'utf8')).results || {};
}

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
const headerParts = lines[0].split(',');
const hasResult = headerParts[headerParts.length - 1] === '测试结果' || headerParts.includes('测试结果');
const out = [];
out.push(hasResult ? lines[0] : lines[0] + ',测试结果');

for (let i = 1; i < lines.length; i++) {
  let line = lines[i];
  const id = line.split(',')[0];
  if (hasResult) {
    const parts = line.split(',');
    if (parts.length >= 11) parts[10] = AI_RESULTS[id] || parts[10] || '';
    else if (parts.length === 10) parts.push(AI_RESULTS[id] || '');
    line = parts.join(',');
  } else {
    line = line + ',' + (AI_RESULTS[id] || '');
  }
  if (!AI_RESULTS[id] && extra[id]) {
    const map = { PASS: '通过', FAIL: '失败', SKIP: '未测', WARN: '待改进', PARTIAL: '部分通过' };
    const note = `${map[extra[id].status] || extra[id].status}-${(extra[id].note || '').replace(/,/g, '，')}`;
    if (hasResult) {
      const parts = line.split(',');
      parts[parts.length - 1] = note;
      line = parts.join(',');
    }
  }
  out.push(line);
}

fs.writeFileSync(csvPath, out.join('\n') + '\n', 'utf8');
console.log('已更新', csvPath);
