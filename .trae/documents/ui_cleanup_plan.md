# UI优化：移除重复样式

## 问题分析

通过排查所有模块文件，发现以下问题：

1. **所有模块都已正确引用 common.css**（第10行）
2. **common.css已包含完整的公用样式**，但各模块仍有重复的内联样式
3. **重复的样式包括**：
   - CSS变量定义（:root）
   - body基础样式
   - .no-scrollbar 样式
   - .fade-in 动画
   - .tech-pulse 动画
   - .pb-safe 样式
   - .report-active 样式
   - .form-input 及表单控件样式
   - .nav-btn.active-nav 导航状态样式
   - 其他重复的动画和工具类

## 修复方案

### 1. 保留各模块独特的样式
- 仅保留各模块特有的、未在common.css中定义的样式
- 例如：报表美化CSS、视图切换按钮、子Tab按钮、高级配置抽屉等特定功能的样式

### 2. 移除所有重复的公用样式
- 从每个模块的内联&lt;style&gt;标签中删除已在common.css中定义的样式

## 执行步骤

1. **dashboard.html** - 移除重复样式，保留报表美化、子Tab按钮等独有样式
2. **crm.html** - 移除重复样式，保留CRM专用适配样式
3. **product-center.html** - 移除重复样式，保留产品中心特有样式（子Tab按钮、高级抽屉、操作按钮等）
4. **supply-chain.html** - 移除重复样式，保留供应链特有样式（视图切换、保存按钮、新增按钮等）
5. **SmartOps.html** - 移除重复样式，保留智能经营特有样式（报表相关样式等）

## 修改文件列表

- `modules/dashboard/dashboard.html`
- `modules/crm/crm.html`
- `modules/product-center/product-center.html`
- `modules/supply-chain/supply-chain.html`
- `modules/SmartOps/SmartOps.html`
