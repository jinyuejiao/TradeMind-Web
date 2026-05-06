# TradeMind 架构指南

## 目录职能

### `/modules/` - 核心业务逻辑模块
- `/dashboard/` - 工作台首页模块
- `/SmartOps/` - 智能经营分析模块
- `/crm/` - 客户关系管理模块
- `/product-center/` - 产品中心模块
- `/supply-chain/` - 供应链/供应商管理模块
- ⚠️ 注意：每个模块目录下只保留核心的 `[模块名].html` 文件；**禁止**在 `modules/` 下创建按行业拆分的 `fragments/` 子目录（行业差异见下文 `/fragments/`）。

### `/fragments/` - 按商户类型的 HTML 片段（行业感知 UI）
- 路径：`/fragments/{wholesale|foreign|ecom|factory}/{scope}/{slot}.html`
- `dict_code`（后端 / JWT）与目录映射：`WHOLESALE→wholesale`，`FOREIGN_TRADE→foreign`，`ECOM→ecom`，`FACTORY_TRADE→factory`
- 模块骨架内预留：`<div data-tm-fragment-scope="..." data-tm-slot="..."></div>`
- 由 `/assets/js/tm-ui-loader.js` 的 `TM_UI.injectSlots(视图根)` 在模块 HTML 注入后执行；失败或未配置时清空插槽，避免残留 DOM
- 全局换肤：`document.documentElement` 上的 `data-merchant-type`（值为字典 **D013** 子项 `dict_code`），`theme.css` 中间接触发 `--tm-brand-accent-rgb`

### `/MobileAdapt/` - 移动端适配逻辑
- `TM_Responsive.js` - 统一的响应式适配库
- 提供全局的设备判断和视图渲染抽象
- 使用 `window.TM_Responsive.isMobile()` 或 `isMobileView()` 判断设备类型，禁止硬编码 `window.innerWidth < 768`
- 样式移动端分界与 Tailwind `md` 一致：**CSS 使用 `max-width: 767px`**

### `/assets/js/` - 系统级框架逻辑
- `auth.js` - 认证与授权逻辑
- `ui-main.js` - 主界面交互逻辑
- `ui-product-center.js` - 产品中心业务逻辑
- `main-app.js` - 应用初始化逻辑（提供 `window.TM_UI` 基础方法）
- `tm-ui-loader.js` - 商户上下文 `TM_UI_CONTEXT`、`TM_UI.injectSlots` / `refreshAll`、`TM_RoleGate`（须在 `main-app.js` 之后加载）
- ⚠️ 注意：所有业务逻辑 JavaScript 必须存放在 `/assets/js/` 目录下，禁止在 `/modules/` 目录下存放 JS 文件
- ⚠️ 扩展 `TM_UI` 时使用 `Object.assign(window.TM_UI, { ... })`，禁止整对象覆盖导致丢失 `showNotification` 等

### `/assets/css/` - 全局样式与主题
- `theme.css` - 主题色与变量定义
- `ui-main.css` - 主界面样式
- `ui-mobile.css` - 移动端专用样式

## 开发规范

### 模块开发规范
1. **禁止在 `/modules/` 下编写模拟数据** - 所有数据都应通过真实API获取
2. **API调用统一使用 `wrappedFetch`** - 确保认证和错误处理统一
3. **移动端适配使用 `TM_Responsive` 模块** - 不要在业务逻辑中硬编码判断逻辑
4. **禁止在 `/modules/` 下创建行业类 `fragments` 子目录** - 行业片段集中在仓库根 `/fragments/`；模块根目录仅保留 `[模块名].html`
5. **禁止在 `/modules/` 下存放 `.js` 文件** - 所有业务 JS 统一放在 `/assets/js/` 目录下

### UI规范
- **品牌颜色**：使用 `brand-500` 作为主色（值：`#14B8A6`）
- **圆角风格**：统一使用 `rounded-2xl` 或 `rounded-3xl`
- **阴影风格**：使用 `shadow-lg` 或 `shadow-xl` 增强层次感

### 权限与角色（壳层）
- 控件仅对部分角色展示：使用 `data-role="ADMIN"`（多个角色空格分隔）
- 页面加载后由 `TM_RoleGate.apply(root)` 剔除无权限节点（须设置 `TM_UI_CONTEXT.role`，登录后由 JWT 同步）

### 弹窗规范
- 所有模态框都应该有模糊背景 (`modal-blur`)
- 使用 `rounded-3xl` 作为标准弹窗圆角
- 统一使用 `closeXxxModal()` 函数关闭弹窗

## UI契约

### CSS变量定义
```css
:root {
    --tm-primary: #14B8A6;
    --tm-primary-hover: #0D9488;
    --tm-secondary: #1F2937;
    --tm-accent: #F59E0B;
    --tm-danger: #F43F5E;
    --tm-success: #10B981;
}
```

### 响应式断点
- **移动端**：`< 768px`
- **平板/桌面端**：`>= 768px`

## 关键文件路径对照表

| 模块名 | 生效 HTML 路径 | 生效 JS 逻辑路径 |
| :--- | :--- | :--- |
| 工作台 | `/modules/dashboard/dashboard.html` | `/assets/js/ui-main.js` |
| 智能经营 | `/modules/SmartOps/SmartOps.html` | `/assets/js/ui-main.js` |
| 客户 CRM | `/modules/crm/crm.html` | `/assets/js/ui-main.js` |
| 产品中心 | `/modules/product-center/product-center.html` | `/assets/js/ui-product-center.js` |
| 供应商管理 | `/modules/supply-chain/supply-chain.html` | `/assets/js/ui-main.js` |

## 后端对齐（商户类型）

- 字典 **D013 MERCHANT_TYPE**：`WHOLESALE` / `FOREIGN_TRADE` / `ECOM` / `FACTORY_TRADE`（见 `InitCfgService` `DictionaryInitService`）
- 表 `tenants.merchant_type`、JWT claim **`merchantType`**、网关下行请求头 **`X-Merchant-Type`** 均为同一套 `dict_code`

## 重构历史

### 2026-05-06
- ✅ 字典 D013、租户 `merchant_type`、JWT / 网关 `X-Merchant-Type`
- ✅ `fragments/` + `tm-ui-loader.js` + 工作台 `dashboard/workspace-banner` 插槽示例
- ✅ 注册 URL 意图 `tmResolveMerchantIntent`、登录后 `applyContextFromToken`

### 2026-04-19
- ✅ 移除了冗余的 `modules-ui/` 文件夹
- ✅ 统一了模块加载路径为 `/modules/`
- ✅ 创建了 `MobileAdapt/` 目录和 `TM_Responsive.js` 统一适配库
- ✅ 建立了完整的架构文档
- ✅ 删除了所有模块的 `fragments/` 文件夹（5个）
- ✅ 删除了 `modules/` 目录下的所有冗余 JS 文件（4个）
- ✅ 更新了 `ui-main.js`，将移动端判断逻辑迁移到 `TM_Responsive.js`
- ✅ 更新了架构文档，添加了强制规范和文件路径对照表
