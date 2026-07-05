/**
 * 产品档案表单 — 工作台待确认单据产品 Tab 与产品中心新增弹窗共用字段结构
 */
(function (global) {
    'use strict';

    var FRAGMENT_URL = '/modules/fragments/product-registry-form.html?v=20260705fix1';
    var FRAGMENT_VER = '20260705fix1';

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

    function scopeFragmentHtml(html, scope) {
        if (!scope) return html;
        return html
            .replace(/\bid="(detail-[^"]+)"/g, 'id="' + scope + '-$1"')
            .replace(/\bfor="(detail-[^"]+)"/g, 'for="' + scope + '-$1"');
    }

    function mount(container) {
        if (!container) return Promise.reject(new Error('产品档案表单容器不存在'));
        if (container.dataset.tmProductMounted === '1' && container.dataset.tmProductFormVer === FRAGMENT_VER) {
            return Promise.resolve(container);
        }
        var scope = container.id === 'audit-product-registry-root' ? 'audit' : 'pc';
        return fetch(FRAGMENT_URL, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('加载产品档案表单失败: ' + res.status);
                return res.text();
            })
            .then(function (html) {
                container.dataset.tmFormScope = scope;
                delete container.dataset.tmCapBound;
                container.innerHTML = scopeFragmentHtml(html, scope);
                container.dataset.tmProductMounted = '1';
                container.dataset.tmProductFormVer = FRAGMENT_VER;
                return container;
            });
    }

    global.TmProductRegistry = {
        mount: mount,
        normalizeAiProduct: normalizeAiProduct
    };
})(window);
