/**
 * 产品档案表单 — 工作台待确认单据产品 Tab 与产品中心新增弹窗共用字段结构
 */
(function (global) {
    'use strict';

    var FRAGMENT_URL = '/modules/fragments/product-registry-form.html?v=20260623feat';

    function normalizeAiProduct(raw) {
        if (!raw || typeof raw !== 'object') raw = {};
        return {
            name: raw.name || raw.product_name || raw.productName || '',
            sku: raw.sku || raw.product_sku || raw.productSku || '',
            price: raw.price != null ? raw.price : (raw.sale_price != null ? raw.sale_price : raw.unit_price),
            base_unit: raw.base_unit || raw.baseUnit || raw.unit || '件',
            sales_unit: raw.sales_unit || raw.salesUnit || raw.base_unit || raw.baseUnit || raw.unit || '件',
            stock: raw.stock != null ? raw.stock : raw.stock_quantity,
            description: raw.description || raw.summary || '',
            category_id: raw.category_id != null ? raw.category_id : raw.categoryId,
            unit_conversions: raw.unit_conversions || raw.unitConversions
        };
    }

    function mount(container) {
        if (!container) return Promise.reject(new Error('产品档案表单容器不存在'));
        if (container.dataset.tmProductMounted === '1') {
            return Promise.resolve(container);
        }
        return fetch(FRAGMENT_URL, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('加载产品档案表单失败: ' + res.status);
                return res.text();
            })
            .then(function (html) {
                container.innerHTML = html;
                container.dataset.tmProductMounted = '1';
                return container;
            });
    }

    global.TmProductRegistry = {
        mount: mount,
        normalizeAiProduct: normalizeAiProduct
    };
})(window);
