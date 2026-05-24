# TradeMind 批发商户版 E2E

对应用例清单：[`../../../.trae/docs/test-plan-wholesale.csv`](../../../.trae/docs/test-plan-wholesale.csv)

## 前置

1. 后端网关：`http://localhost:8080`（与 `env-config.js` 一致）
2. 静态页：在 `TradeMind-Web` 目录执行  
   `python -m http.server 9013`
3. 复制 `.env.example` → `.env` 并填写测试账号

## 安装与运行

```bash
cd TradeMind-Web/tests/e2e
npm install
npx playwright install chromium
npm run test:api    # 仅 API（L1）
npm run test:ui     # 桌面 UI 冒烟（L2）
npm run test:ui:mobile  # 移动视口（部分用例需人工补测）
npm run report      # 查看 HTML 报告
```

## 用例 ID 与文件映射

| 文件 | 覆盖用例 ID（示例） |
|------|---------------------|
| `specs/auth.api.spec.ts` | X-02, X-04 |
| `specs/auth.ui.spec.ts` | X-03, X-05 |
| `specs/shell.ui.spec.ts` | X-20, X-26 |
| `specs/dashboard.ui.spec.ts` | D-07, D-14 |
| `specs/dashboard.ai.spec.ts` | D-05, D-06, A-01 |
| `specs/roles.ui.spec.ts` | X-22, D-16 |
| `specs/tenant-isolation.api.spec.ts` | X-10 |

其余模块（CRM、产品、供应商、经营）在 CSV 的「自动化用例」列已预留文件名，可按同样模式在 `specs/` 下追加 `crm.ui.spec.ts` 等。

## 说明

- 带 `test.skip` 的用例表示依赖测试数据或 DOM 选择器待对齐，配置就绪后去掉 skip。
- 标注「人工」的用例（移动 safe-area、支付回调、AI 准确率等）不在此包强制覆盖，发版前仍走 CSV 人工清单。
