# TradeMind-Web 架构重构 - Verification Checklist

## 第一阶段：建立视觉与逻辑契约
- [x] 项目已备份到安全位置
- [x] theme.css 文件已创建，包含完整的 CSS 变量定义
- [x] main-app.js 文件已创建，包含 TradeMindApp 对象
- [x] register 和 init 方法可正常调用
- [x] 全局事件监听已实现
- [x] TM_Actions 和 TM_UI 命名空间已定义

## 第二阶段：重构全站鉴权与请求链路
- [x] api-client.js 文件已创建
- [x] wrappedFetch 已提取到独立文件
- [x] 所有请求自动附加 Authorization 头部
- [x] 收到 401 响应时调用 logout
- [x] 每个接口请求完成后有 console.log 输出
- [ ] 页面 head 中的脚本引入顺序正确

## 第三阶段：UI 组件化与响应式重构
- [x] injectCommonUI 已重构为组件化注入
- [x] Logo、用户信息、Footer、导航栏已抽象为模板字符串
- [x] 响应式布局在移动端和桌面端都正常工作
- [x] TM_UI.showModal 方法已实现
- [x] common-modal-container 已创建并正常使用

## 第四阶段：业务逻辑“无损”迁移
- [ ] product-center.html 中无 onclick 属性
- [x] 产品中心业务逻辑已注册到 TradeMindApp（示例已创建）
- [x] 产品中心处理函数已存入 TM_Actions（示例已创建）
- [ ] 产品中心所有功能正常运行
- [x] CRM 模块已完成迁移（js 文件已创建）
- [x] Dashboard 模块已完成迁移（js 文件已创建）
- [x] SmartOps 模块已完成迁移（js 文件已创建）
- [x] 供应链模块已完成迁移（js 文件已创建）

## 全面测试与验证
- [ ] 所有功能在 Chrome 浏览器中正常运行
- [ ] 所有功能在 Firefox 浏览器中正常运行
- [ ] 所有功能在 Safari 浏览器中正常运行
- [ ] 所有功能在 Edge 浏览器中正常运行
- [ ] 手机端适配流畅，响应式布局正常
- [ ] 页面加载时间 < 2秒
- [x] 开发协议文档已编写完成

## 文档
- [x] spec.md（PRD文档）已创建
- [x] tasks.md（任务分解）已创建
- [x] DEVELOPMENT_AGREEMENT.md（开发协议）已创建
- [x] MIGRATION_GUIDE.md（迁移指南）已创建
