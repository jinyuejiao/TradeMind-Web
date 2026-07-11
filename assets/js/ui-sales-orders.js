/**
 * 销售订单全量分页列表（工作台双视图）
 */
(function () {
    'use strict';

    var PAGE_SIZE = 20;
    var currentPage = 1;
    var totalPages = 1;
    var _bound = false;
    var ACTIVE_TAB = 'border-brand-200 bg-brand-50 text-brand-600';
    var INACTIVE_TAB = 'border-slate-200 text-slate-600 hover:bg-slate-50';

    var filterState = {
        dateRange: '90d',
        logisticsStatus: '',
        finStatus: ''
    };

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification(msg, type || 'info');
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg);
        }
    }

    function apiFetch(path) {
        var fetchFn = window.wrappedFetch || fetch;
        return fetchFn('/api/v1/rd' + path, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
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
        if (window.TM_OrderDict && typeof window.TM_OrderDict.orderStatusLabel === 'function') {
            return window.TM_OrderDict.orderStatusLabel(code);
        }
        var map = window.TM_ORDER_STATUS_MAP || {};
        return map[code] || code || '—';
    }

    function finStatusLabel(code) {
        var map = {
            UNPAID: '未收款',
            PARTIAL_PAID: '部分收款',
            SETTLED: '已结清',
            BAD_DEBT: '坏账'
        };
        var k = String(code || 'UNPAID').trim().toUpperCase();
        return map[k] || k || '—';
    }

    function isOpenOrder(o) {
        if (window.TM_OrderDict && typeof window.TM_OrderDict.isWorkbenchOpenOrder === 'function') {
            return window.TM_OrderDict.isWorkbenchOpenOrder(o);
        }
        return false;
    }

    function orderIdOf(o) {
        return o.order_id != null ? o.order_id : (o.orderId != null ? o.orderId : o.id);
    }

    function readFiltersFromDom() {
        var dr = document.getElementById('sales-orders-date-range');
        var ls = document.getElementById('sales-orders-logistics');
        var fs = document.getElementById('sales-orders-fin-status');
        filterState.dateRange = dr ? dr.value : '90d';
        filterState.logisticsStatus = ls ? ls.value : '';
        filterState.finStatus = fs ? fs.value : '';
    }

    function buildQueryString(pageNo) {
        readFiltersFromDom();
        var qs = '?pageNo=' + pageNo + '&pageSize=' + PAGE_SIZE;
        var keywordEl = document.getElementById('sales-orders-keyword');
        var keyword = keywordEl ? keywordEl.value.trim() : '';
        if (keyword) qs += '&keyword=' + encodeURIComponent(keyword);
        if (filterState.logisticsStatus) {
            qs += '&logisticsStatus=' + encodeURIComponent(filterState.logisticsStatus);
        }
        if (filterState.finStatus) {
            qs += '&finStatus=' + encodeURIComponent(filterState.finStatus);
        }
        if (filterState.dateRange === '90d' && window.TM_OrderDict && window.TM_OrderDict.dateDaysAgo) {
            qs += '&startDate=' + encodeURIComponent(window.TM_OrderDict.dateDaysAgo(90));
        } else if (filterState.dateRange === '30d' && window.TM_OrderDict && window.TM_OrderDict.dateDaysAgo) {
            qs += '&startDate=' + encodeURIComponent(window.TM_OrderDict.dateDaysAgo(30));
        }
        return qs;
    }

    function setTabStyles(viewToggle, activeView) {
        viewToggle.querySelectorAll('[data-view]').forEach(function (btn) {
            var on = btn.getAttribute('data-view') === activeView;
            btn.classList.toggle('active', on);
            btn.classList.remove('border-brand-200', 'bg-brand-50', 'text-brand-600', 'border-slate-200', 'text-slate-600', 'hover:bg-slate-50');
            (on ? ACTIVE_TAB : INACTIVE_TAB).split(' ').forEach(function (c) { btn.classList.add(c); });
        });
    }

    function switchView(view) {
        var overview = document.getElementById('workbench-overview-panel');
        var salesPanel = document.getElementById('workbench-sales-orders-panel');
        var returnsPanel = document.getElementById('workbench-returns-panel');
        var toggle = document.getElementById('workbench-view-toggle');
        if (!toggle) return;
        if (overview) overview.classList.toggle('hidden', view !== 'overview');
        if (salesPanel) salesPanel.classList.toggle('hidden', view !== 'sales-orders');
        if (returnsPanel) returnsPanel.classList.toggle('hidden', view !== 'returns');
        setTabStyles(toggle, view);
        if (view === 'sales-orders') {
            var dictP = window.TM_OrderDict && window.TM_OrderDict.ensureOrderDictLoaded
                ? window.TM_OrderDict.ensureOrderDictLoaded()
                : Promise.resolve();
            dictP.then(function () { loadSalesOrders(1); });
            return;
        }
        if (view === 'returns' && window.TM_Returns && window.TM_Returns.loadList) {
            window.TM_Returns.loadList(1);
        }
    }

    function renderList(records) {
        var container = document.getElementById('sales-orders-list');
        if (!container) return;
        if (!records || !records.length) {
            container.innerHTML = '<p class="text-center text-slate-400 py-8">暂无销售订单</p>';
            return;
        }
        container.innerHTML = records.map(function (o) {
            var oid = orderIdOf(o);
            var openBadge = isOpenOrder(o)
                ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 ml-1">进行中</span>'
                : '';
            var returnedAmt = parseFloat(o.returned_amount != null ? o.returned_amount : (o.returnedAmount || 0));
            var returnedHint = returnedAmt > 0
                ? ('<p class="text-[10px] text-amber-600 mt-0.5">已退 ' + fmtMoney(returnedAmt) + '</p>')
                : '';
            var fin = o.fin_status || o.finStatus;
            return [
                '<div class="tm-po-card cursor-pointer border border-slate-100 rounded-xl p-4 mb-3 hover:border-brand-200" data-order-id="' + oid + '">',
                '  <div class="flex justify-between items-start gap-2">',
                '    <div class="min-w-0 flex-1"><p class="font-bold text-slate-800 flex flex-wrap items-center gap-1">',
                (o.order_code || o.orderCode || ('#' + oid)) + openBadge + '</p>',
                '    <p class="text-xs text-slate-500 truncate">' + (o.cust_name || o.custName || '—') + ' · ' + fmtDate(o.create_time || o.createTime) + '</p>',
                returnedHint + '</div>',
                '    <div class="text-right shrink-0"><p class="font-mono font-bold text-brand-600">' + fmtMoney(o.total_amount != null ? o.total_amount : o.totalAmount) + '</p>',
                '    <p class="text-[10px] text-slate-400">' + statusLabel(o.order_status || o.orderStatus) + '</p>',
                '    <p class="text-[9px] text-slate-300">' + finStatusLabel(fin) + '</p></div>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        container.querySelectorAll('[data-order-id]').forEach(function (el) {
            el.addEventListener('click', function () {
                var id = el.getAttribute('data-order-id');
                if (typeof window.openOrderDetailModal === 'function') {
                    window.openOrderDetailModal(parseInt(id, 10), {});
                } else if (typeof window.openOrderDetail === 'function') {
                    window.openOrderDetail(parseInt(id, 10));
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
        var container = document.getElementById('sales-orders-list');
        if (container) container.innerHTML = '<p class="text-center text-slate-400 py-8">加载中…</p>';
        apiFetch('/orders' + buildQueryString(pageNo)).then(function (res) {
            if (!res || !res.success) {
                notify((res && res.message) || '加载销售订单失败', 'error');
                if (container) container.innerHTML = '<p class="text-center text-red-400 py-8">加载失败</p>';
                return;
            }
            var data = res.data || {};
            renderList(data.records || []);
            renderPagination(data);
        }).catch(function (e) {
            notify('加载销售订单失败: ' + (e.message || '网络错误'), 'error');
            if (container) container.innerHTML = '<p class="text-center text-red-400 py-8">加载失败</p>';
        });
    }

    function bindFilterControls() {
        ['sales-orders-date-range', 'sales-orders-logistics', 'sales-orders-fin-status'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el || el.dataset.tmSalesFilterBound === '1') return;
            el.dataset.tmSalesFilterBound = '1';
            el.addEventListener('change', function () { loadSalesOrders(1); });
        });
    }

    function initSalesOrdersView() {
        var viewToggle = document.getElementById('workbench-view-toggle');
        if (!viewToggle || viewToggle.dataset.tmSalesBound === '1') return;
        viewToggle.dataset.tmSalesBound = '1';
        viewToggle.querySelectorAll('[data-view]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                switchView(btn.getAttribute('data-view'));
            });
        });
        var searchBtn = document.getElementById('sales-orders-search-btn');
        if (searchBtn && searchBtn.dataset.tmBound !== '1') {
            searchBtn.dataset.tmBound = '1';
            searchBtn.addEventListener('click', function () { loadSalesOrders(1); });
        }
        bindFilterControls();
        _bound = true;
        if (window.TM_OrderDict && typeof window.TM_OrderDict.ensureOrderDictLoaded === 'function') {
            window.TM_OrderDict.ensureOrderDictLoaded();
        }
    }

    window.TM_SalesOrders = { load: loadSalesOrders, init: initSalesOrdersView, switchView: switchView };
})();
