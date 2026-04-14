# ⚠️ TradeMind 开发协议 (必须严格遵守)

## 1. 禁止内联事件
- **严禁**在 HTML 标签中编写 `onclick`、`onchange`、`onmouseover` 等属性。
- 所有交互必须通过 `data-action` 属性配合 `main-app.js` 的事件委派实现。
- **正确示例**：
  ```html
  <button data-action="openProductDetail" data-id="123">打开产品</button>
  ```
- **错误示例**：
  ```html
  <button onclick="openProductDetail(123)">打开产品</button>
  ```

## 2. 变量唯一性
- **严禁**在 CSS 中出现十六进制颜色（如 `#14B8A6`）、直接写像素值（如 `12px`）等硬编码值。
- 必须使用 CSS 变量（如 `var(--tm-primary)`、`var(--tm-spacing-md)`）。
- **正确示例**：
  ```css
  .btn {
      background-color: var(--tm-primary);
      border-radius: var(--tm-radius-lg);
      padding: var(--tm-spacing-sm) var(--tm-spacing-md);
  }
  ```
- **错误示例**：
  ```css
  .btn {
      background-color: #14B8A6;
      border-radius: 2.5rem;
      padding: 0.5rem 1rem;
  }
  ```

## 3. 路径契约
- 所有脚本和样式引用必须使用绝对路径（如 `/assets/js/...`、`/assets/css/...`）。
- **正确示例**：
  ```html
  <script src="/assets/js/env-config.js"></script>
  <link rel="stylesheet" href="/assets/css/theme.css">
  ```
- **错误示例**：
  ```html
  <script src="../../assets/js/env-config.js"></script>
  <link rel="stylesheet" href="../css/theme.css">
  ```

## 4. 命名契约
- **业务函数**必须挂载在 `window.TM_Actions`。
- **UI 工具函数**必须挂载在 `window.TM_UI`。
- **正确示例**：
  ```javascript
  window.TM_Actions.openProductDetail = function(element) {
      const productId = element.dataset.id;
      // 业务逻辑...
  };

  window.TM_UI.showModal = function(templateId, data) {
      // UI 逻辑...
  };
  ```

## 5. 初始化契约
- 子页面逻辑必须通过 `TradeMindApp.register` 注册。
- 页面加载完成后必须显式调用 `TradeMindApp.init('模块名')`。
- **正确示例**：
  ```javascript
  window.TradeMindApp.register('products', function(options) {
      console.log('[Product-Center] 初始化产品中心模块...');
      loadProducts();
  });

  // 页面加载完成后
  document.addEventListener('DOMContentLoaded', function() {
      window.TradeMindApp.init('products');
  });
  ```

## 6. 日志契约
- **每一个接口请求完成后**，必须 `console.log` 响应状态及处理后的数据对象。
- **严禁**静默失败，所有错误必须在控制台输出。
- **正确示例**：
  ```javascript
  const response = await window.wrappedFetch('/api/v1/products', { method: 'GET' });
  console.log('[API] 响应状态:', response.status);
  
  const data = await response.json();
  console.log('[API] 响应数据:', data);
  ```

## 7. 页面 head 引入顺序
每个页面的 `<head>` 必须按照以下顺序引入资源：

```html
<head>
    <!-- 1. 环境配置 -->
    <script src="/assets/js/env-config.js"></script>
    
    <!-- 2. API 客户端 -->
    <script src="/assets/js/api-client.js"></script>
    
    <!-- 3. 主题样式 -->
    <link rel="stylesheet" href="/assets/css/theme.css">
    
    <!-- 4. 全局应用控制中心 -->
    <script src="/assets/js/main-app.js"></script>
    
    <!-- 5. UI 组件系统 -->
    <script src="/assets/js/ui-components.js"></script>
    
    <!-- 6. 页面特定样式 -->
    <link rel="stylesheet" href="/modules/product-center/product-center.css">
    
    <!-- 7. 页面特定脚本 -->
    <script src="/modules/product-center/product-center.js"></script>
</head>
```

## 8. 渲染契约
- 所有列表渲染逻辑（如产品列表、客户列表等）必须先检查容器 ID 是否存在。
- 若容器不存在，必须打印显眼的错误日志。
- **正确示例**：
  ```javascript
  function renderProductList(products) {
      const container = document.getElementById('product-list-container');
      if (!container) {
          console.error('[Product-Center] ❌ 产品列表容器不存在: product-list-container');
          return;
      }
      
      console.log('[Product-Center] 渲染产品列表:', products.length, '个产品');
      // 渲染逻辑...
  }
  ```

## 9. 响应式契约
- 根据 `window.innerWidth < 768` 自动切换布局模式。
- 移动端使用 `tm-mobile-active` 类名和 `layout-mode` 属性。
- 所有弹窗必须渲染到统一的 `id="common-modal-container"` 中。

## 10. 组件化契约
- Logo、用户信息、备案 Footer、手机底部导航栏等通用组件使用 `window.TradeMindApp.components` 中的模板。
- 所有组件必须通过 `window.TradeMindApp.components` 访问，不允许直接写硬编码 HTML。

---

## 📋 快速参考

### CSS 变量速查表
| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `--tm-primary` | 主品牌色 | `#14B8A6` |
| `--tm-bg-dark` | 深色背景 | `#0F172A` |
| `--tm-radius-xl` | 大圆角 | `2.5rem` |
| `--tm-shadow-xl` | 大阴影 | `0 25px 50px -12px rgba(0, 0, 0, 0.25)` |
| `--tm-spacing-md` | 中等间距 | `1rem` |

### 常用 TM_Actions 示例
```javascript
window.TM_Actions.openProductDetail = function(element) {
    const productId = element.dataset.id;
    // ...
};

window.TM_Actions.deleteProduct = function(element) {
    const productId = element.dataset.id;
    // ...
};
```

### 常用 TM_UI 示例
```javascript
window.TM_UI.showNotification('操作成功', 'success');
window.TM_UI.showModal('product-detail-template', { id: 123 });
window.TM_UI.closeModal();
window.TM_UI.switchTab('dashboard');
```

---

**违反以上任何协议都将导致代码审查不通过，请严格遵守！** 🚀
