# TradeMind - 公共 UI 组件实现计划

## [/] 任务 1: 在 auth.js 中定义标准组件模板
- **优先级**: P0
- **依赖**: 无
- **描述**:
  - 在 `auth.js` 顶部定义三个 HTML 模板常量
  - 提取工作台左上角的 TradeMind Logo 及图标结构作为 `LOGO_TEMPLATE`
  - 提取正确的用户信息区结构作为 `USER_SECTION_TEMPLATE`
  - 提取产品中心的会员订阅及推荐海报弹窗作为 `MODAL_TEMPLATE`
- **成功标准**:
  - 三个模板常量在 auth.js 中正确定义
  - 模板包含完整的 HTML 结构和必要的事件绑定
- **测试要求**:
  - `programmatic` TR-1.1: 模板常量在 auth.js 中存在且格式正确
  - `human-judgement` TR-1.2: 模板内容与原页面结构一致

## [ ] 任务 2: 实现统一注入逻辑 (auth.js)
- **优先级**: P0
- **依赖**: 任务 1
- **描述**:
  - 在 `auth.js` 中新增全局函数 `window.injectCommonUI()`
  - 实现 Logo 注入到 `id="sidebar-logo-container"`
  - 实现用户信息注入到 `id="sidebar-user-container"`
  - 实现弹窗注入（单例模式）
  - 实现动态数据绑定，更新用户信息和推荐码
- **成功标准**:
  - `injectCommonUI()` 函数正确实现
  - 能正确注入所有组件并更新动态数据
- **测试要求**:
  - `programmatic` TR-2.1: 函数能在所有模块中被调用
  - `human-judgement` TR-2.2: 注入后的组件显示正确

## [ ] 任务 3: 改造各子模块 HTML (清理与占位)
- **优先级**: P1
- **依赖**: 任务 2
- **描述**:
  - 遍历所有模块 HTML 文件
  - 替换左上角 Logo 为 `<div id="sidebar-logo-container"></div>`
  - 替换左下角用户信息为 `<div id="sidebar-user-container"></div>`
  - 删除页面末尾的硬编码弹窗 HTML
  - 确保每个页面在初始化时调用 `window.injectCommonUI()`
- **成功标准**:
  - 所有模块都使用统一的占位容器
  - 所有模块都调用注入函数
- **测试要求**:
  - `programmatic` TR-3.1: 所有模块都有正确的容器 ID
  - `human-judgement` TR-3.2: 页面结构清晰，无重复代码

## [ ] 任务 4: 迁移 JS 交互函数至全局
- **优先级**: P1
- **依赖**: 任务 3
- **描述**:
  - 将 `openSubscriptionModal`, `closeSubscriptionModal`, `downloadPoster` 等函数从 product-center.html 迁移到 auth.js
  - 确保所有页面都引用了 `html2canvas.min.js`
- **成功标准**:
  - 所有交互函数在 auth.js 中定义
  - 所有页面都能正确调用这些函数
- **测试要求**:
  - `programmatic` TR-4.1: 函数在 auth.js 中存在且可调用
  - `human-judgement` TR-4.2: 弹窗交互功能正常

## [ ] 任务 5: 最终校验
- **优先级**: P2
- **依赖**: 任务 4
- **描述**:
  - 切换 5 个模块，确认 Logo 无位移
  - 确认左下角用户信息在所有页面都显示
  - 确认所有页面点击用户都弹出正确版本的弹窗
- **成功标准**:
  - 所有模块的 UI 组件显示一致
  - 交互功能正常
- **测试要求**:
  - `human-judgement` TR-5.1: Logo 位置正确
  - `human-judgement` TR-5.2: 用户信息显示正确
  - `human-judgement` TR-5.3: 弹窗功能正常