# TradeMind UI 重构实现计划

## 第一阶段：标准弹窗骨架与会员中心还原

### [x] 任务 1.1：提取弹窗标准模板
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 从 `models/index.html` 提取弹窗的基础样式
  - 包括 `rounded-[2.5rem]` 圆角、`backdrop-blur-sm` 遮罩、以及 `modal-content-box` 的阴影参数
- **Success Criteria**:
  - 成功提取并记录弹窗的标准样式参数
- **Test Requirements**:
  - `programmatic` TR-1.1.1: 确认从 models/index.html 中提取到完整的弹窗样式
  - `human-judgement` TR-1.1.2: 提取的样式参数与 UI 设计一致
- **Notes**:
  - 提取的样式参数：
    - 弹窗圆角：`rounded-[2.5rem]`
    - 遮罩样式：`backdrop-blur-sm`（在 `.modal-blur` 类中）
    - 阴影参数：`shadow-2xl`
    - 移动端高度：`height: 92vh !important;`
    - 移动端圆角：`border-radius: 1.5rem 1.5rem 0 0 !important;`

### [x] 任务 1.2：重构会员订阅弹窗
- **Priority**: P0
- **Depends On**: 任务 1.1
- **Description**:
  - 在 `auth.js` 的 `MODAL_TEMPLATE` 中，严格按照附件图 5 还原
  - 左侧：基础试用版（灰蓝色调，显示“CURRENT PLAN”）
  - 右侧：普通会员订阅（青绿色边框，带有“RECOMMENDED”标签和“立即升级”按钮）
  - 底部：横向的“巨猿推荐官计划”横条，包含专属推荐码和“生成海报”橙色按钮
- **Success Criteria**:
  - 会员订阅弹窗与附件图 5 完全一致
- **Test Requirements**:
  - `programmatic` TR-1.2.1: 弹窗 HTML 结构正确，包含所有必要元素
  - `human-judgement` TR-1.2.2: 弹窗视觉效果与 UI 设计一致
- **Notes**:
  - MODAL_TEMPLATE 已经包含了完整的会员订阅中心弹窗和品牌推荐海报弹窗结构，与 models/index.html 中的弹窗结构一致
  - 弹窗包含了所有必要元素：左侧基础试用版卡片、右侧普通会员订阅卡片、底部巨猿推荐官计划横条

### [ ] 任务 1.3：对齐业务弹窗
- **Priority**: P1
- **Depends On**: 任务 1.1
- **Description**:
  - 修改 `dashboard.html`（待确认单据）、`crm.html`（客户编辑）和 `product-center.html`（产品编辑）的弹窗 HTML 结构
  - 统一头部：左上角必须包含一个带有背景色的圆角图标容器
  - 统一按钮：底部操作按钮样式必须对齐 UI 文件的“取消返回（Ghost按钮）”和“确认提交（Solid按钮）”
- **Success Criteria**:
  - 所有业务弹窗的结构和样式统一
- **Test Requirements**:
  - `programmatic` TR-1.3.1: 所有业务弹窗都包含统一的头部和按钮样式
  - `human-judgement` TR-1.3.2: 业务弹窗视觉效果与 UI 设计一致

## 第二阶段：产品中心细节修正

### [ ] 任务 2.1：修正产品中心列表新增按钮
- **Priority**: P1
- **Depends On**: None
- **Description**:
  - 找到产品中心（`product-center.html`）搜索框右侧的“新增产品”按钮
  - 修正：将其从当前的空白/错误方块修改为 UI 稿中的样式：一个圆角的、带有 `ph-plus-bold` 图标的青绿色按钮（或 UI 对应的 `ph-plus-circle`）
- **Success Criteria**:
  - 新增产品按钮样式与 UI 设计一致
- **Test Requirements**:
  - `programmatic` TR-2.1.1: 按钮包含正确的图标和样式
  - `human-judgement` TR-2.1.2: 按钮视觉效果与 UI 设计一致

### [ ] 任务 2.2：补全产品编辑弹窗头部图标
- **Priority**: P1
- **Depends On**: 任务 1.3
- **Description**:
  - 在产品编辑弹窗的左上角标题旁，注入缺失的图标容器（参考 UI 文件中的 `ph-package` 或 `ph-pencil-line`）
- **Success Criteria**:
  - 产品编辑弹窗头部包含正确的图标
- **Test Requirements**:
  - `programmatic` TR-2.2.1: 弹窗头部包含图标容器
  - `human-judgement` TR-2.2.2: 图标视觉效果与 UI 设计一致

## 第三阶段：移动端全局导航框架重构

### [ ] 任务 3.1：重构 `injectCommonUI` 函数
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 在 `auth.js` 中重构 `injectCommonUI` 函数
  - 顶部 Header：在移动端（`block md:hidden`）显示一个简洁的顶部栏。左侧为 Logo 缩略图，右侧为用户圆形头像（点击触发会员弹窗）
  - 底部导航栏 (Bottom Nav)：在 `body` 底部注入一个固定的导航条
    - 包含 5 个图标项：工作台、智能经营、客户 CRM、产品中心、供应商管理
    - 交互逻辑：点击图标触发 `switchTab` 或页面跳转
- **Success Criteria**:
  - `injectCommonUI` 函数能够在移动端正确注入顶部栏和底部导航栏
- **Test Requirements**:
  - `programmatic` TR-3.1.1: 函数能够正确注入顶部栏和底部导航栏
  - `human-judgement` TR-3.1.2: 导航栏视觉效果与 UI 设计一致

### [ ] 任务 3.2：确保全站同步
- **Priority**: P1
- **Depends On**: 任务 3.1
- **Description**:
  - 检查 `SmartOps.html`、`crm.html` 等所有子页面，确保它们在加载时都调用了这一套 `injectCommonUI`
  - 逻辑对齐：移动端下，隐藏侧边栏（Sidebar），显示底部导航栏，确保在不同页面间切换时，底部的“激活状态”图标能正确高亮（使用青绿色）
- **Success Criteria**:
  - 所有子页面都使用统一的 `injectCommonUI` 函数，移动端导航效果一致
- **Test Requirements**:
  - `programmatic` TR-3.2.1: 所有子页面都调用了 `injectCommonUI` 函数
  - `human-judgement` TR-3.2.2: 移动端导航在所有页面间切换时效果一致

## 关键 UI 元素代码规范

- **品牌青绿色**：`#14B8A6` (Tailwind: `teal-500`)
- **会员弹窗圆角**：`rounded-[2.5rem]`
- **手机端底部导航高度**：`h-16` 或 `h-20`，背景色 `bg-white/80` 带 `backdrop-blur-md`
- **图标库**：统一使用 `ph-bold` (Phosphor Icons)，大小在移动端设定为 `text-xl`