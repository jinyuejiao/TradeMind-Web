# TradeMind UI 问题修复计划

## 问题概述
根据用户反馈，当前系统存在以下五个问题：
1. 部分页面用户信息展示错误，显示模拟信息
2. 手机模式下未展示多模块切换栏
3. 手机端会员订阅弹窗与网页版不一致
4. 工作台待确认单据展示模拟信息
5. 智能经营界面展示模拟信息

## 修复计划

### [ ] 任务 1：统一用户信息展示逻辑
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 检查所有页面的用户信息展示逻辑
  - 确保所有页面都调用相同的 `loadUserInfo` 函数
  - 验证用户信息从 TenantService 返回的真实数据
- **Success Criteria**:
  - 所有页面（工作台、智能经营、供应链管理、客户CRM、产品中心）都显示相同的真实用户信息
- **Test Requirements**:
  - `programmatic` TR-1.1: 所有页面调用相同的用户信息加载函数
  - `human-judgement` TR-1.2: 所有页面显示相同的用户名和角色信息

### [ ] 任务 2：修复移动端导航栏展示
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 检查 `injectCommonUI` 函数中移动端导航栏的注入逻辑
  - 确保所有页面都正确调用 `injectCommonUI` 函数
  - 验证移动端导航栏在手机模式下正确显示
- **Success Criteria**:
  - 所有页面在手机模式下都显示底部多模块切换栏
  - 导航栏的激活状态正确显示
- **Test Requirements**:
  - `programmatic` TR-2.1: 所有页面调用 `injectCommonUI` 函数
  - `human-judgement` TR-2.2: 手机模式下显示底部导航栏且激活状态正确

### [ ] 任务 3：统一会员订阅弹窗
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 检查手机端会员订阅弹窗的调用逻辑
  - 确保手机端和网页版使用相同的 `MODAL_TEMPLATE`
  - 验证弹窗内容在不同设备上一致
- **Success Criteria**:
  - 手机端和网页版的会员订阅弹窗内容一致
  - 弹窗样式和功能相同
- **Test Requirements**:
  - `programmatic` TR-3.1: 手机端和网页版使用相同的弹窗模板
  - `human-judgement` TR-3.2: 弹窗内容和样式在不同设备上一致

### [ ] 任务 4：恢复工作台待确认单据真实数据
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 检查工作台页面的待确认单据加载逻辑
  - 移除模拟数据，恢复从 RDService 获取真实数据
  - 验证页面刷新后仍显示真实数据
- **Success Criteria**:
  - 工作台待确认单据列表显示从 RDService 获取的真实数据
  - 页面刷新后仍显示真实数据
  - 提交新增的 AI 提取订单后，待确认单据列表更新正确
- **Test Requirements**:
  - `programmatic` TR-4.1: 页面初始化时从 RDService 获取数据
  - `human-judgement` TR-4.2: 待确认单据列表显示真实数据

### [ ] 任务 5：恢复智能经营界面真实数据
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 检查智能经营页面的图表数据加载逻辑
  - 移除模拟数据，恢复从后端获取真实数据
  - 验证不同情况下都显示真实数据
- **Success Criteria**:
  - 智能经营界面显示从后端获取的真实经营图表
  - 不同情况下都显示真实数据
- **Test Requirements**:
  - `programmatic` TR-5.1: 页面初始化时从后端获取数据
  - `human-judgement` TR-5.2: 经营图表显示真实数据

## 实施步骤
1. 首先检查所有页面的用户信息展示逻辑，确保统一调用 `loadUserInfo` 函数
2. 检查 `injectCommonUI` 函数的实现，确保移动端导航栏正确注入
3. 验证会员订阅弹窗在手机端和网页版的一致性
4. 检查工作台页面的待确认单据加载逻辑，恢复真实数据
5. 检查智能经营页面的图表数据加载逻辑，恢复真实数据
6. 测试所有修复是否生效

## 预期交付
- 所有页面用户信息显示一致且为真实数据
- 手机模式下显示底部导航栏
- 手机端和网页版会员订阅弹窗一致
- 工作台待确认单据显示真实数据
- 智能经营界面显示真实经营图表