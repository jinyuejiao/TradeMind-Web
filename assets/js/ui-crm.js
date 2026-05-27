/**
 * TradeMind — CRM 客户详情：交互时间轴、字典与产品摘要工具
 */
(function () {
    'use strict';

    var TIMELINE_SUMMARY_MAX_CHARS = 28;
    var TIMELINE_SUMMARY_MAX_ITEMS = 2;

    var TM_ORDER_STATUS_FALLBACK = {
        D010001: '待配货',
        D010002: '拣货中',
        D010003: '全部发货',
        D010004: '已签收',
        D010005: '退货',
        D010006: '部分发货'
    };

    var TM_ORDER_FIN_FALLBACK = {
        UNPAID: '未收款',
        PARTIAL_PAID: '部分收款',
        SETTLED: '已结清',
        BAD_DEBT: '坏账'
    };

    var gatewayUrl = '';
    var orderStatusDictMap = {};
    var finStatusDictMap = {};
    var productById = {};

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeOrderStatusCode(statusCode) {
        return String(statusCode || '').trim().toUpperCase().replace(/_/g, '');
    }

    function toCanonicalOrderStatusCode(statusCode) {
        var raw = String(statusCode || '').trim().toUpperCase();
        if (!raw) return '';
        if (raw === 'PENDING' || raw === 'ALLOCATING') return 'D010001';
        if (raw === 'PROCESSING' || raw === 'PICKING') return 'D010002';
        if (raw === 'SHIPPED' || raw === 'FULL_SHIPPED') return 'D010003';
        if (raw === 'PARTIAL_SHIPPED' || raw === 'PARTIALSHIP') return 'D010006';
        if (raw === 'COMPLETED' || raw === 'RECEIVED') return 'D010004';
        if (raw === 'CANCELLED' || raw === 'CANCELED' || raw === 'RETURNED') return 'D010005';
        var m = raw.match(/^D010[_-]?0*(\d{1,3})$/);
        if (m) {
            var n = m[1];
            while (n.length < 3) n = '0' + n;
            return 'D010' + n;
        }
        if (raw.indexOf('D010') === 0) return normalizeOrderStatusCode(raw);
        return normalizeOrderStatusCode(raw);
    }

    function dictItemToStorageStatusCode(item) {
        var dictId = String((item && (item.dictId || item.dict_id)) || '').trim().toUpperCase();
        var dictCode = String((item && (item.dictCode || item.code)) || '').trim().toUpperCase();
        if (dictId) {
            var fromId = toCanonicalOrderStatusCode(dictId);
            if (fromId.indexOf('D010') === 0 && fromId.length >= 7) return fromId;
        }
        return toCanonicalOrderStatusCode(dictCode);
    }

    function isValidOrderStatusCanonical(code) {
        return /^D01000[1-5]$/.test(toCanonicalOrderStatusCode(code));
    }

    function fetchJson(url) {
        if (typeof window.wrappedFetch !== 'function') {
            return Promise.reject(new Error('wrappedFetch 不可用'));
        }
        return window.wrappedFetch(url, { method: 'GET' }).then(function (res) {
            if (!res.ok) {
                return res.json().catch(function () { return {}; }).then(function (body) {
                    var msg = (body && (body.message || body.error)) || ('请求失败: ' + res.status);
                    throw new Error(msg);
                });
            }
            return res.json();
        });
    }

    function loadOrderStatusDict() {
        var url = gatewayUrl + '/api/v1/rd/dictionaries/list/D010';
        return fetchJson(url).then(function (result) {
            var list = result && Array.isArray(result.data) ? result.data : [];
            var map = {};
            var seenCanonical = {};
            list.forEach(function (item) {
                var level = Number(item.dictLevel != null ? item.dictLevel : (item.dict_level != null ? item.dict_level : 2));
                if (level === 1) return;
                var rawCode = String(item.dictCode || item.code || '').trim().toUpperCase();
                var name = String(item.dictName || item.dictname || item.name || '').trim();
                var canonical = dictItemToStorageStatusCode(item);
                if (!canonical || !name || !isValidOrderStatusCanonical(canonical)) return;
                if (seenCanonical[canonical]) return;
                seenCanonical[canonical] = true;
                map[rawCode] = name;
                map[canonical] = name;
            });
            if (Object.keys(map).length) {
                orderStatusDictMap = map;
            } else {
                orderStatusDictMap = Object.assign({}, TM_ORDER_STATUS_FALLBACK);
            }
        }).catch(function (err) {
            console.warn('[TmCrm] 加载 D010 字典失败，使用回退:', err);
            orderStatusDictMap = Object.assign({}, TM_ORDER_STATUS_FALLBACK);
        });
    }

    function loadFinStatusDict() {
        var url = gatewayUrl + '/api/v1/rd/dictionaries/list/D015';
        return fetchJson(url).then(function (result) {
            var list = result && Array.isArray(result.data) ? result.data : [];
            var map = {};
            list.forEach(function (item) {
                var level = Number(item.dictLevel != null ? item.dictLevel : (item.dict_level != null ? item.dict_level : 2));
                if (level === 1) return;
                var rawCode = String(item.dictCode || item.code || '').trim().toUpperCase();
                var dictId = String(item.dictId || item.dict_id || '').trim().toUpperCase();
                var name = String(item.dictName || item.dictname || item.name || '').trim();
                if (!name) return;
                if (rawCode) map[rawCode] = name;
                if (dictId) map[dictId] = name;
            });
            if (Object.keys(map).length) {
                finStatusDictMap = map;
            } else {
                finStatusDictMap = Object.assign({}, TM_ORDER_FIN_FALLBACK);
            }
        }).catch(function (err) {
            console.warn('[TmCrm] 加载 D015 字典失败，使用回退:', err);
            finStatusDictMap = Object.assign({}, TM_ORDER_FIN_FALLBACK);
        });
    }

    function loadProductIndex() {
        var url = gatewayUrl + '/api/v1/rd/products';
        return fetchJson(url).then(function (result) {
            var list = result && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
            var byId = {};
            list.forEach(function (p) {
                var id = p.productId != null ? p.productId : p.product_id;
                if (id == null) return;
                byId[id] = {
                    name: (p.name || p.productName || p.product_name || '').trim(),
                    salesUnit: (p.salesUnit || p.sales_unit || '').trim(),
                    baseUnit: (p.baseUnit || p.base_unit || '').trim()
                };
            });
            productById = byId;
        }).catch(function (err) {
            console.warn('[TmCrm] 加载产品列表失败，摘要将使用产品 ID:', err);
            productById = {};
        });
    }

    function getLogisticsStatusLabel(statusCode) {
        var key = String(statusCode || '').trim().toUpperCase();
        var canon = toCanonicalOrderStatusCode(key);
        return orderStatusDictMap[key]
            || orderStatusDictMap[canon]
            || TM_ORDER_STATUS_FALLBACK[canon]
            || statusCode
            || '—';
    }

    function getFinStatusLabel(statusCode) {
        var c = String(statusCode || 'UNPAID').trim().toUpperCase();
        return finStatusDictMap[c]
            || TM_ORDER_FIN_FALLBACK[c]
            || c
            || '—';
    }

    function normalizeFinStatus(statusCode) {
        var raw = String(statusCode || 'UNPAID').trim().toUpperCase();
        if (raw === 'PAID' || raw === 'FULL_PAID') return 'SETTLED';
        if (raw === 'PARTIAL' || raw === 'PARTIALPAID') return 'PARTIAL_PAID';
        if (raw === 'BAD_DEBT' || raw === 'BADDEBT') return 'BAD_DEBT';
        return raw || 'UNPAID';
    }

    function getLogisticsBadgeClass(statusCode) {
        var code = toCanonicalOrderStatusCode(statusCode);
        switch (code) {
            case 'D010004':
                return 'crm-status-badge bg-emerald-50 text-emerald-700';
            case 'D010005':
                return 'crm-status-badge bg-slate-100 text-slate-600';
            case 'D010003':
                return 'crm-status-badge bg-blue-50 text-blue-700';
            case 'D010002':
                return 'crm-status-badge bg-sky-50 text-sky-700';
            case 'D010006':
                return 'crm-status-badge bg-indigo-50 text-indigo-700';
            default:
                return 'crm-status-badge bg-teal-50 text-teal-700';
        }
    }

    function getFinBadgeClass(statusCode) {
        var fin = normalizeFinStatus(statusCode);
        switch (fin) {
            case 'SETTLED':
                return 'crm-status-badge bg-emerald-50 text-emerald-700';
            case 'PARTIAL_PAID':
                return 'crm-status-badge bg-sky-50 text-sky-700';
            case 'BAD_DEBT':
                return 'crm-status-badge bg-slate-100 text-slate-600';
            default:
                return 'crm-status-badge bg-amber-50 text-amber-700';
        }
    }

    function renderOrderStatusBadgesHtml(order) {
        var logisticsLabel = getLogisticsStatusLabel(order && (order.orderStatus || order.order_status));
        var finLabel = getFinStatusLabel(order && (order.finStatus || order.fin_status || 'UNPAID'));
        var logisticsClass = getLogisticsBadgeClass(order && (order.orderStatus || order.order_status));
        var finClass = getFinBadgeClass(order && (order.finStatus || order.fin_status || 'UNPAID'));
        return ''
            + '<span class="' + logisticsClass + '" title="' + escapeHtml(logisticsLabel) + '">'
            + '<span class="truncate">' + escapeHtml(logisticsLabel) + '</span></span>'
            + '<span class="' + finClass + '" title="' + escapeHtml(finLabel) + '">'
            + '<span class="truncate">' + escapeHtml(finLabel) + '</span></span>';
    }

    function formatOrderStatusPair(order) {
        var logistics = getLogisticsStatusLabel(order && (order.orderStatus || order.order_status));
        var fin = getFinStatusLabel(order && (order.finStatus || order.fin_status || 'UNPAID'));
        return logistics + ' | ' + fin;
    }

    function buildOrderItemsSummary(items, productLookup) {
        var lookup = productLookup || productById;
        if (!items || !items.length) return '';
        return items.map(function (item) {
            var pid = item.productId != null ? item.productId : item.product_id;
            var p = lookup[pid] || {};
            var name = (p.name || ('产品#' + pid)).trim();
            var qty = item.quantity != null ? item.quantity : 0;
            var unit = (p.salesUnit || p.baseUnit || '件').trim() || '件';
            return name + '*' + qty + ' ' + unit;
        }).join(', ');
    }

    function truncateOrderSummary(text, maxChars, maxItems) {
        var src = (text || '').trim();
        if (!src) return '';
        var limitChars = maxChars != null ? maxChars : TIMELINE_SUMMARY_MAX_CHARS;
        var limitItems = maxItems != null ? maxItems : TIMELINE_SUMMARY_MAX_ITEMS;
        var parts = src.split(', ');
        if (limitItems > 0 && parts.length > limitItems) {
            parts = parts.slice(0, limitItems);
            src = parts.join(', ');
        }
        if (src.length <= limitChars) return src;
        return src.slice(0, limitChars) + '...';
    }

    function summarizeOrderItems(items, order) {
        if (!items || !items.length) {
            return '订单号 ' + ((order && (order.orderCode || order.order_code)) || '—');
        }
        var full = buildOrderItemsSummary(items, productById);
        return truncateOrderSummary(full, TIMELINE_SUMMARY_MAX_CHARS, TIMELINE_SUMMARY_MAX_ITEMS);
    }

    function timelineRailHtml() {
        return '<div class="absolute left-2.5 top-0 bottom-0 w-px bg-slate-100"></div>';
    }

    function resetTimelinePlaceholder() {
        var container = document.getElementById('timeline-container');
        if (!container) return;
        container.innerHTML = timelineRailHtml()
            + '<div class="p-8 text-center text-slate-400">'
            + '<i class="ph ph-clock text-4xl mb-3"></i>'
            + '<p class="text-sm">请选择客户后查看交易时间轴</p></div>';
    }

    function showTimelineLoading() {
        var container = document.getElementById('timeline-container');
        if (!container) return;
        container.innerHTML = timelineRailHtml()
            + '<div class="p-8 text-center text-slate-400">'
            + '<i class="ph ph-clock text-4xl mb-3"></i>'
            + '<p class="text-sm">加载订单记录中...</p></div>';
    }

    function renderTimeline(records) {
        var container = document.getElementById('timeline-container');
        if (!container) return;

        if (!records || !records.length) {
            container.innerHTML = timelineRailHtml()
                + '<div class="text-center text-slate-400 py-8"><p class="text-sm">暂无交易记录</p></div>';
            return;
        }

        var body = records.map(function (record, index) {
            var order = record.order || {};
            var items = record.items || [];
            var dt = order.createTime || order.create_time ? new Date(order.createTime || order.create_time) : null;
            var timeText = dt && !isNaN(dt.getTime()) ? dt.toLocaleString() : '未知时间';
            var summaryFull = items.length
                ? buildOrderItemsSummary(items, productById)
                : ('订单号 ' + (order.orderCode || order.order_code || '—'));
            var summaryDisplay = items.length
                ? summarizeOrderItems(items, order)
                : summaryFull;
            var statusBadges = renderOrderStatusBadgesHtml(order);
            var amount = order.totalAmount != null ? order.totalAmount : (order.total_amount != null ? order.total_amount : 0);
            if ((!amount || Number(amount) <= 0) && items.length) {
                amount = items.reduce(function (sum, it) {
                    var lineTotal = it.totalAmount != null ? it.totalAmount : it.total_amount;
                    if (lineTotal != null && Number(lineTotal) > 0) return sum + Number(lineTotal);
                    var qty = Number(it.quantity) || 0;
                    var up = it.unitPrice != null ? it.unitPrice : it.unit_price;
                    return sum + (qty * (Number(up) || 0));
                }, 0);
                amount = Math.round(amount * 100) / 100;
            }

            return ''
                + '<div class="relative' + (index > 4 ? ' opacity-80' : '') + '">'
                + '  <span class="absolute -left-[22px] w-4 h-4 rounded-full bg-brand-500 border-4 border-white shadow-sm shrink-0"></span>'
                + '  <div class="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-1 min-w-0">'
                + '    <p class="text-[10px] text-slate-400 font-mono font-bold tracking-tighter uppercase shrink-0">' + escapeHtml(timeText) + '</p>'
                + '    <div class="flex flex-wrap items-center justify-end gap-1.5 min-w-0 max-w-full">' + statusBadges + '</div>'
                + '  </div>'
                + '  <p class="text-xs font-bold text-slate-800 tracking-tight truncate" title="' + escapeHtml(summaryFull) + '">' + escapeHtml(summaryDisplay) + '</p>'
                + '  <p class="mt-1 text-xs font-bold text-brand-600">订单金额: ¥' + escapeHtml(amount) + '</p>'
                + '</div>';
        }).join('');

        container.innerHTML = timelineRailHtml() + body;
    }

    function loadCustomerTimeline(custId) {
        showTimelineLoading();
        var ordersUrl = gatewayUrl + '/api/v1/rd/orders/customer/' + encodeURIComponent(custId);

        return fetchJson(ordersUrl).then(function (orderResult) {
            var orders = Array.isArray(orderResult.data) ? orderResult.data.slice() : [];
            orders.sort(function (a, b) {
                var ta = new Date(a.createTime || a.create_time || 0).getTime();
                var tb = new Date(b.createTime || b.create_time || 0).getTime();
                return tb - ta;
            });
            return Promise.all(orders.map(function (order) {
                var orderId = order.orderId != null ? order.orderId : order.order_id;
                var itemsUrl = gatewayUrl + '/api/v1/rd/orders/' + encodeURIComponent(orderId) + '/items';
                return fetchJson(itemsUrl).then(function (itemResult) {
                    var items = Array.isArray(itemResult.data) ? itemResult.data : [];
                    return { order: order, items: items };
                }).catch(function () {
                    return { order: order, items: [] };
                });
            }));
        }).then(function (enriched) {
            renderTimeline(enriched);
        }).catch(function (error) {
            console.error('[TmCrm] 加载时间轴失败:', error);
            renderTimeline([]);
        });
    }

    function init(options) {
        options = options || {};
        gatewayUrl = options.gatewayUrl || (typeof window.getApiUrl === 'function' ? window.getApiUrl('gateway') : '');
        if (!gatewayUrl) {
            console.warn('[TmCrm] gatewayUrl 未配置');
            return Promise.resolve();
        }
        return Promise.all([
            loadOrderStatusDict(),
            loadFinStatusDict(),
            loadProductIndex()
        ]);
    }

    window.TmCrm = {
        init: init,
        loadCustomerTimeline: loadCustomerTimeline,
        resetTimelinePlaceholder: resetTimelinePlaceholder,
        renderTimeline: renderTimeline,
        formatOrderStatusPair: formatOrderStatusPair,
        renderOrderStatusBadgesHtml: renderOrderStatusBadgesHtml,
        getLogisticsBadgeClass: getLogisticsBadgeClass,
        getFinBadgeClass: getFinBadgeClass,
        buildOrderItemsSummary: buildOrderItemsSummary,
        truncateOrderSummary: truncateOrderSummary,
        summarizeOrderItems: summarizeOrderItems,
        getLogisticsStatusLabel: getLogisticsStatusLabel,
        getFinStatusLabel: getFinStatusLabel,
        TIMELINE_SUMMARY_MAX_CHARS: TIMELINE_SUMMARY_MAX_CHARS,
        TIMELINE_SUMMARY_MAX_ITEMS: TIMELINE_SUMMARY_MAX_ITEMS
    };
})();
