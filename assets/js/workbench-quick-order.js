/**
 * 工作台内嵌快速开单（允许欠货）
 */
(function () {
    'use strict';

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification(msg, type || 'info');
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg);
        } else {
            alert(msg);
        }
    }

    function getProfile() {
        return window.TM_WorkbenchProfile || { quickOrderColumns: ['product', 'qty', 'price', 'amount'] };
    }

    function columnVisible(key) {
        var cols = getProfile().quickOrderColumns || [];
        return cols.indexOf(key) >= 0;
    }

    function buildHeaderRow() {
        var html = '<th class="px-2 py-1.5 text-left">商品</th>';
        if (columnVisible('spec')) html += '<th class="px-2 py-1.5 text-left">规格</th>';
        if (columnVisible('expiry')) html += '<th class="px-2 py-1.5 text-left">效期</th>';
        if (columnVisible('serial')) html += '<th class="px-2 py-1.5 text-left">序列号</th>';
        html += '<th class="px-2 py-1.5 text-right">数量</th><th class="px-2 py-1.5 text-right">单价</th><th class="px-2 py-1.5 text-right">小计</th><th class="px-1 py-1.5"></th>';
        return html;
    }

    function createRow() {
        var tbody = document.getElementById('wq-order-tbody');
        if (!tbody) return;
        var tr = document.createElement('tr');
        tr.className = 'wq-order-row';
        var specCols = '';
        if (columnVisible('spec')) specCols += '<td class="px-2 py-1"><input type="text" class="wq-spec form-input form-input--compact w-full text-xs" placeholder="规格" readonly tabindex="-1" /></td>';
        if (columnVisible('expiry')) specCols += '<td class="px-2 py-1"><input type="text" class="wq-expiry form-input form-input--compact w-full text-xs" placeholder="-" readonly tabindex="-1" /></td>';
        if (columnVisible('serial')) specCols += '<td class="px-2 py-1"><input type="text" class="wq-serial form-input form-input--compact w-full text-xs" placeholder="可选" /></td>';
        tr.innerHTML =
            '<td class="px-2 py-1"><select class="wq-product form-input form-input--compact w-full text-xs font-bold"></select></td>' +
            specCols +
            '<td class="px-2 py-1"><input type="number" min="1" value="1" class="wq-qty form-input form-input--compact w-16 text-right text-xs font-mono" /></td>' +
            '<td class="px-2 py-1"><input type="number" min="0" step="0.01" class="wq-price form-input form-input--compact w-20 text-right text-xs font-mono" /></td>' +
            '<td class="px-2 py-1 text-right font-mono text-xs wq-line-total">0.00</td>' +
            '<td class="px-1 py-1"><button type="button" class="wq-remove text-slate-400 hover:text-red-500" aria-label="删除行"><i class="ph ph-trash"></i></button></td>';
        tbody.appendChild(tr);
        fillProductSelect(tr.querySelector('.wq-product'));
        bindRowEvents(tr);
        recalcTotal();
    }

    function fillProductSelect(sel) {
        if (!sel) return;
        var products = window.productListCache || window.productsCache || [];
        sel.innerHTML = '<option value="">选择商品</option>';
        products.forEach(function (p) {
            var id = p.productId || p.product_id || p.id;
            var name = p.name || p.productName || ('#' + id);
            var opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            opt.dataset.price = p.price || p.unitPrice || p.salePrice || 0;
            opt.dataset.spec = p.attributesDisplay || p.spec || '';
            sel.appendChild(opt);
        });
    }

    function bindRowEvents(tr) {
        tr.querySelector('.wq-product').addEventListener('change', function () {
            var opt = this.options[this.selectedIndex];
            var priceEl = tr.querySelector('.wq-price');
            if (priceEl && opt && opt.dataset.price) priceEl.value = opt.dataset.price;
            var specEl = tr.querySelector('.wq-spec');
            if (specEl && opt) specEl.value = opt.dataset.spec || '';
            recalcRow(tr);
        });
        ['.wq-qty', '.wq-price'].forEach(function (sel) {
            var el = tr.querySelector(sel);
            if (el) el.addEventListener('input', function () { recalcRow(tr); });
        });
        var rm = tr.querySelector('.wq-remove');
        if (rm) rm.addEventListener('click', function () {
            tr.remove();
            recalcTotal();
        });
    }

    function recalcRow(tr) {
        var qty = parseFloat(tr.querySelector('.wq-qty').value) || 0;
        var price = parseFloat(tr.querySelector('.wq-price').value) || 0;
        var total = Math.round(qty * price * 100) / 100;
        tr.querySelector('.wq-line-total').textContent = total.toFixed(2);
        recalcTotal();
    }

    function recalcTotal() {
        var sum = 0;
        document.querySelectorAll('#wq-order-tbody .wq-order-row').forEach(function (tr) {
            sum += parseFloat(tr.querySelector('.wq-line-total').textContent) || 0;
        });
        var el = document.getElementById('wq-order-total');
        if (el) el.textContent = '¥' + sum.toFixed(2);
    }

    async function populateCustomers() {
        var sel = document.getElementById('wq-order-customer');
        if (!sel) return;
        if (typeof window.loadCustomerList === 'function') await window.loadCustomerList();
        var map = window.customerMapCache || window.customersCache || {};
        sel.innerHTML = '<option value="">选择客户</option>';
        Object.keys(map).forEach(function (cid) {
            var c = map[cid];
            if (!c || !c.name) return;
            var opt = document.createElement('option');
            opt.value = cid;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
    }

    async function populateWarehouses() {
        var sel = document.getElementById('wq-order-warehouse');
        if (!sel || !window.wrappedFetch) return;
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/warehouses', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var list = data && data.data ? data.data : (Array.isArray(data) ? data : []);
            sel.innerHTML = '<option value="">默认仓库</option>';
            list.forEach(function (w) {
                var opt = document.createElement('option');
                opt.value = w.warehouseId || w.warehouse_id || w.id;
                opt.textContent = w.name || ('仓#' + opt.value);
                sel.appendChild(opt);
            });
            var defWh = getProfile().defaultFulfillmentWarehouseId && getProfile().defaultFulfillmentWarehouseId();
            if (defWh) sel.value = String(defWh);
        } catch (e) { /* ignore */ }
    }

    async function initPanel() {
        var panel = document.getElementById('workbench-quick-order-panel');
        if (!panel) return;
        if (window.TM_loadWorkbenchProfile) await window.TM_loadWorkbenchProfile();
        if (!getProfile().showQuickOrder || !getProfile().showQuickOrder()) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.remove('hidden');
        var thead = document.getElementById('wq-order-thead');
        if (thead) thead.innerHTML = buildHeaderRow();
        if (typeof window.loadProductList === 'function') await window.loadProductList();
        await populateCustomers();
        await populateWarehouses();
        var tbody = document.getElementById('wq-order-tbody');
        if (tbody && !tbody.querySelector('.wq-order-row')) createRow();
        var industryBadge = document.getElementById('wq-industry-badge');
        if (industryBadge && getProfile().industryLabel) {
            industryBadge.textContent = getProfile().industryLabel();
        }
    }

    async function saveQuickOrder() {
        var custSel = document.getElementById('wq-order-customer');
        var whSel = document.getElementById('wq-order-warehouse');
        var custId = custSel && custSel.value ? parseInt(custSel.value, 10) : NaN;
        if (!custId || isNaN(custId)) {
            notify('请选择客户', 'error');
            return;
        }
        var items = [];
        document.querySelectorAll('#wq-order-tbody .wq-order-row').forEach(function (tr) {
            var pid = parseInt(tr.querySelector('.wq-product').value, 10);
            var qty = parseInt(tr.querySelector('.wq-qty').value, 10) || 0;
            var unitPrice = parseFloat(tr.querySelector('.wq-price').value) || 0;
            if (!pid || isNaN(pid) || qty <= 0) return;
            items.push({
                productId: pid,
                quantity: qty,
                unitPrice: unitPrice,
                totalAmount: Math.round(unitPrice * qty * 100) / 100,
                itemStatus: 'D011001'
            });
        });
        if (!items.length) {
            notify('请添加有效商品行', 'error');
            return;
        }
        var grand = items.reduce(function (s, it) { return s + it.totalAmount; }, 0);
        var whId = whSel && whSel.value ? parseInt(whSel.value, 10) : null;
        var payload = {
            allowShortage: true,
            order: {
                custId: custId,
                totalAmount: grand,
                orderStatus: 'D010001',
                finStatus: 'UNPAID',
                allowShortage: true,
                fulfillmentWarehouseId: whId,
                warehouseId: whId
            },
            orderItems: items
        };
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var data = await window.handleApiResponse(resp);
            if (!data) return;
            notify('快速开单成功' + (data.data && data.data.hasShortage ? '（含欠货）' : ''), 'success');
            document.getElementById('wq-order-tbody').innerHTML = '';
            createRow();
            recalcTotal();
            if (typeof window.loadInProgressOrders === 'function') window.loadInProgressOrders();
        } catch (e) {
            notify(e.message || '开单失败', 'error');
        }
    }

    window.TM_initQuickOrderPanel = initPanel;
    window.TM_saveQuickOrder = saveQuickOrder;
    window.TM_addQuickOrderRow = createRow;

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(initPanel, 300);
    });
})();
