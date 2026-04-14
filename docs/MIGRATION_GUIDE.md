# TradeMind-Web 模块迁移指南

## 概述

本文档提供了将现有模块迁移到新架构的详细步骤和最佳实践。

## 迁移步骤概览

对于每个现有模块（如 CRM、Dashboard、SmartOps、供应链），请按照以下步骤进行迁移：

### 步骤 1：创建新的模块 JS 文件

为每个模块创建独立的 JS 文件（如 `crm.js`、`dashboard.js`、`smart-ops.js`、`supply-chain.js`）。

**模板示例**：

```javascript
/* ========================================================
 * TradeMind - [模块名称] 模块
 * ========================================================
 * [模块描述]
 * ======================================================== */

(function() {
    'use strict';

    console.log('[模块名称] 模块加载中...');

    // ================ 全局变量 ================
    // 在这里定义模块所需的全局变量

    // ================ 业务函数 ================
    // 在这里实现所有业务函数

    // ================ 注册到 TM_Actions ================
    window.TM_Actions.yourActionName = function(element) {
        // 业务逻辑...
    };

    // ================ 注册到 TradeMindApp ================
    window.TradeMindApp.register('模块名称', function(options) {
        console.log('[模块名称] 初始化模块...');
        // 初始化代码...
        
        // 注入公共 UI
        if (window.TM_UI && window.TM_UI.injectCommonUI) {
            window.TM_UI.injectCommonUI();
        }
    });

    console.log('[模块名称] 模块加载完成！');
})();
```

### 步骤 2：更新 HTML 文件中的脚本引入顺序

更新模块的 HTML 文件，确保按照以下顺序引入资源：

```html
<head>
    <!-- 1. 环境配置 -->
    <script src="../../assets/js/env-config.js"></script>
    
    <!-- 2. API 客户端 -->
    <script src="../../assets/js/api-client.js"></script>
    
    <!-- 3. 主题样式 -->
    <link rel="stylesheet" href="../../assets/css/theme.css">
    
    <!-- 4. 全局应用控制中心 -->
    <script src="../../assets/js/main-app.js"></script>
    
    <!-- 5. UI 组件系统 -->
    <script src="../../assets/js/ui-components.js"></script>
    
    <!-- 6. 模块特定样式（如果有） -->
    <link rel="stylesheet" href="module-specific.css">
    
    <!-- 7. 模块特定脚本 -->
    <script src="your-module.js"></script>
</head>
```

### 步骤 3：替换 HTML 中的 onclick 属性

将 HTML 中的所有 `onclick` 属性替换为 `data-action` 属性。

**替换规则**：
- `onclick="functionName(params)"` → `data-action="functionName"`
- 所有参数通过 `data-*` 属性传递

**示例**：

```html
<!-- 之前 -->
<button onclick="openCustomerDetail(123)">打开客户详情</button>

<!-- 之后 -->
<button data-action="openCustomerDetail" data-id="123">打开客户详情</button>
```

### 步骤 4：注册业务函数到 TM_Actions

在模块的 JS 文件中，将所有业务函数注册到 `window.TM_Actions`：

```javascript
window.TM_Actions.openCustomerDetail = function(element) {
    const customerId = element.dataset.id;
    // 业务逻辑...
};

window.TM_Actions.deleteCustomer = function(element) {
    const customerId = element.dataset.id;
    // 业务逻辑...
};

window.TM_Actions.switchTab = function(element) {
    const tab = element.dataset.tab;
    window.TM_UI.switchTab(tab);
};
```

### 步骤 5：注册模块到 TradeMindApp

在模块的 JS 文件末尾，注册模块到 `window.TradeMindApp`：

```javascript
window.TradeMindApp.register('模块名称', function(options) {
    console.log('[模块名称] 初始化模块...');
    
    // 初始化代码...
    loadData();
    renderUI();
    
    // 注入公共 UI
    if (window.TM_UI && window.TM_UI.injectCommonUI) {
        window.TM_UI.injectCommonUI();
    }
});
```

### 步骤 6：在页面加载时初始化模块

在 HTML 文件末尾添加初始化代码：

```html
<script>
    document.addEventListener('DOMContentLoaded', function() {
        window.TradeMindApp.init('模块名称');
    });
</script>
```

## 各模块迁移清单

### CRM 模块 (crm.html)

1. 创建 `modules/crm/crm.js`
2. 迁移业务函数：客户管理、客户详情、客户列表等
3. 替换 HTML 中的 onclick
4. 引入新的脚本和样式

### Dashboard 模块 (dashboard.html)

1. 创建 `modules/dashboard/dashboard.js`
2. 迁移业务函数：数据可视化、快捷操作等
3. 替换 HTML 中的 onclick
4. 引入新的脚本和样式

### SmartOps 模块 (SmartOps.html)

1. 创建 `modules/SmartOps/smart-ops.js`
2. 迁移业务函数：智能经营功能
3. 替换 HTML 中的 onclick
4. 引入新的脚本和样式

### 供应链模块 (supply-chain.html)

1. 创建 `modules/supply-chain/supply-chain.js`
2. 迁移业务函数：供应商管理、供应链功能
3. 替换 HTML 中的 onclick
4. 引入新的脚本和样式

## 常见问题

### Q: 迁移时如何保持现有功能不变？

A: 只需要改变函数的挂载方式，业务逻辑代码可以保持完全不变。

### Q: 如何处理复杂的参数传递？

A: 使用 `data-*` 属性可以传递任意多个参数：

```html
<button data-action="editProduct" 
        data-id="123" 
        data-name="产品名称"
        data-price="99.99">
    编辑产品
</button>
```

然后在 JS 中获取：

```javascript
window.TM_Actions.editProduct = function(element) {
    const id = element.dataset.id;
    const name = element.dataset.name;
    const price = element.dataset.price;
    // ...
};
```

### Q: 如何处理表单提交？

A: 对于表单，使用 `data-action` 在 form 元素上：

```html
<form data-action="submitForm">
    <!-- 表单内容 -->
    <button type="submit">提交</button>
</form>
```

然后在 JS 中：

```javascript
window.TM_Actions.submitForm = function(element, event) {
    event.preventDefault();
    // 处理表单提交
};
```

## 迁移检查清单

每个模块迁移完成后，请确认以下项：

- [ ] 创建了新的模块 JS 文件
- [ ] 更新了 HTML 文件中的脚本引入顺序
- [ ] 替换了所有 HTML 中的 onclick 属性
- [ ] 业务函数已注册到 TM_Actions
- [ ] 模块已注册到 TradeMindApp
- [ ] 在页面加载时正确初始化
- [ ] 所有功能正常工作
- [ ] 控制台无错误
- [ ] 响应式布局正常
- [ ] 移动端适配正常

---

**注意：迁移时请参考产品中心模块的迁移示例（`product-center.js`）！
