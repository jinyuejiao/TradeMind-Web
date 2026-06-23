/**
 * 销售订单全量分页列表（工作台双视图）
 */
(function () {
    'use strict';

    var PAGE_SIZE = 20;
    var currentPage = 1;
    var totalPages = 1;

    function api(path) {
        return fetch('/api/v1/rd' + path, {
            headers: { 'X-Tenant-Id': window.currentTenantId || '' }
        }).then(function (r) { return r.json(); });
    }

    function fmtMoney(v) {
        var n = parseFloat(v);
        return isNaN(n) ? '—' : '¥' + n.toFixed(2);
    }

    function fmtDate(v) {
        if (!v) return '—';
        return String(v).replace('T', ' ').slice(0, 16);
    }

    function statusLabel(code) {
        var map = window.TM_ORDER_STATUS_MAP || {};
        return map[code] || code || '—';
    }

    function renderList(records) {
        var container = document.getElementById('sales-orders-list');
        if (!container) return;
        if (!records || !records.length) {
            container.innerHTML = '<p class="text-center text-slate-400 py-8">暂无销售订单</p>';
            return;
        }
        container.innerHTML = records.map(function (o) {
            return [
                '<div class="tm-po-card cursor-pointer border border-slate-100 rounded-xl p-4 mb-3 hover:border-brand-200" data-order-id="' + o.order_id + '">',
                '  <div class="flex justify-between items-start gap-2">',
                '    <div><p class="font-bold text-slate-800">' + (o.order_code || ('#' + o.order_id)) + '</p>',
                '    <p class="text-xs text-slate-500">' + (o.cust_name || '—') + ' · ' + fmtDate(o.create_time) + '</p></div>',
                '    <div class="text-right"><p class="font-mono font-bold text-brand-600">' + fmtMoney(o.total_amount) + '</p>',
                '    <p class="text-[10px] text-slate-400">' + statusLabel(o.order_status) + '</p></div>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        container.querySelectorAll('[data-order-id]').forEach(function (el) {
            el.addEventListener('click', function () {
                var id = el.getAttribute('data-order-id');
                if (typeof window.openOrderDetailModal === 'function') {
                    window.openOrderDetailModal(parseInt(id, 10));
                }
            });
        });
    }

    function renderPagination(data) {
        var bar = document.getElementById('sales-orders-pagination');
        if (!bar) return;
        currentPage = data.pageNo || 1;
        totalPages = data.totalPages || 1;
        bar.innerHTML = [
            '<button type="button" id="sales-orders-prev" class="btn-secondary text-sm"' + (currentPage <= 1 ? ' disabled' : '') + '>上一页</button>',
            '<span class="text-sm text-slate-500">' + currentPage + ' / ' + totalPages + '（共 ' + (data.total || 0) + ' 条）</span>',
            '<button type="button" id="sales-orders-next" class="btn-secondary text-sm"' + (currentPage >= totalPages ? ' disabled' : '') + '>下一页</button>'
        ].join('');
        var prev = document.getElementById('sales-orders-prev');
        var next = document.getElementById('sales-orders-next');
        if (prev) prev.addEventListener('click', function () { loadSalesOrders(currentPage - 1); });
        if (next) next.addEventListener('click', function () { loadSalesOrders(currentPage + 1); });
    }

    function loadSalesOrders(pageNo) {
        pageNo = pageNo || 1;
        var keyword = (document.getElementById('sales-orders-keyword') || {}).value || '';
        var qs = '?pageNo=' + pageNo + '&pageSize=' + PAGE_SIZE;
        if (keyword) qs += '&keyword=' + encodeURIComponent(keyword);
        api('/orders' + qs).then(function (res) {
            if (!res.success) return;
            var data = res.data || {};
            renderList(data.records || []);
            renderPagination(data);
        });
    }

    function initSalesOrdersView() {
        var viewToggle = document.getElementById('workbench-view-toggle');
        if (viewToggle) {
            viewToggle.querySelectorAll('[data-view]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var view = btn.getAttribute('data-view');
                    document.getElementById('workbench-overview-panel').classList.toggle('hidden', view !== 'overview');
                    document.getElementById('workbench-sales-orders-panel').classList.toggle('hidden', view !== 'sales-orders');
                    viewToggle.querySelectorAll('[data-view]').forEach(function (b) {
                        b.classList.toggle('active', b === btn);
                    });
                    if (view === 'sales-orders') loadSalesOrders(1);
                });
            });
        }
        var searchBtn = document.getElementById('sales-orders-search-btn');
        if (searchBtn) searchBtn.addEventListener('click', function () { loadSalesOrders(1); });
    }

    window.TM_SalesOrders = { load: loadSalesOrders, init: initSalesOrdersView };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSalesOrdersView);
    } else {
        initSalesOrdersView();
    }
})();
