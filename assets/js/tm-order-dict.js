/**
 * 销售订单 D010 / 退厂单 D021 状态字典（全模块共享）
 */
(function () {
    'use strict';

    var TM_ORDER_STATUS_FALLBACK = {
        D010001: '待配货',
        D010002: '拣货中',
        D010003: '全部发货',
        D010004: '已签收',
        D010005: '退货',
        D010006: '部分发货'
    };

    var TM_SUPPLIER_RETURN_STATUS_FALLBACK = {
        D021001: '草稿',
        D021002: '已发出',
        D021003: '供应商确认',
        D021004: '已完成',
        D021005: '作废'
    };

    var _orderLoadPromise = null;
    var _supplierReturnLoadPromise = null;

    function normalizeDictCode(code) {
        return String(code || '').trim().toUpperCase().replace(/_/g, '');
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
        if (raw.indexOf('D010') === 0) return normalizeDictCode(raw);
        return normalizeDictCode(raw);
    }

    function toCanonicalSupplierReturnStatusCode(statusCode) {
        var raw = String(statusCode || '').trim().toUpperCase();
        if (!raw) return '';
        if (raw === 'DRAFT') return 'D021001';
        if (raw === 'SHIPPED') return 'D021002';
        if (raw === 'SUPPLIER_CONFIRMED') return 'D021003';
        if (raw === 'COMPLETED') return 'D021004';
        if (raw === 'VOIDED') return 'D021005';
        var m = raw.match(/^D021[_-]?0*(\d{1,3})$/);
        if (m) {
            var n = m[1];
            while (n.length < 3) n = '0' + n;
            return 'D021' + n;
        }
        return normalizeDictCode(raw);
    }

    function dictItemToOrderCode(item) {
        var dictId = String((item && (item.dictId || item.dict_id)) || '').trim().toUpperCase();
        var dictCode = String((item && (item.dictCode || item.code)) || '').trim().toUpperCase();
        if (dictId) {
            var fromId = toCanonicalOrderStatusCode(dictId);
            if (fromId.indexOf('D010') === 0 && fromId.length >= 7) return fromId;
        }
        return toCanonicalOrderStatusCode(dictCode);
    }

    function dictItemToSupplierReturnCode(item) {
        var dictId = String((item && (item.dictId || item.dict_id)) || '').trim().toUpperCase();
        var dictCode = String((item && (item.dictCode || item.code)) || '').trim().toUpperCase();
        if (dictId) {
            var fromId = toCanonicalSupplierReturnStatusCode(dictId);
            if (fromId.indexOf('D021') === 0 && fromId.length >= 7) return fromId;
        }
        return toCanonicalSupplierReturnStatusCode(dictCode);
    }

    function isValidOrderCanonical(code) {
        return /^D01000[1-6]$/.test(toCanonicalOrderStatusCode(code));
    }

    function isValidSupplierReturnCanonical(code) {
        return /^D02100[1-5]$/.test(toCanonicalSupplierReturnStatusCode(code));
    }

    function ensureMap(target, fallback) {
        if (!target || typeof target !== 'object') {
            target = {};
        }
        Object.keys(fallback).forEach(function (k) {
            if (!target[k]) target[k] = fallback[k];
        });
        return target;
    }

    function publishOrderMap(map) {
        window.TM_ORDER_STATUS_MAP = ensureMap(Object.assign({}, map || {}), TM_ORDER_STATUS_FALLBACK);
        return window.TM_ORDER_STATUS_MAP;
    }

    function publishSupplierReturnMap(map) {
        window.TM_SUPPLIER_RETURN_STATUS_MAP = ensureMap(Object.assign({}, map || {}), TM_SUPPLIER_RETURN_STATUS_FALLBACK);
        return window.TM_SUPPLIER_RETURN_STATUS_MAP;
    }

    function apiFetch(path) {
        var fetchFn = window.wrappedFetch || fetch;
        return fetchFn('/api/v1/rd' + path, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }).then(function (r) { return r.json(); });
    }

    function loadOrderStatusDict() {
        if (_orderLoadPromise) return _orderLoadPromise;
        _orderLoadPromise = apiFetch('/dictionaries/list/D010').then(function (result) {
            var list = result && Array.isArray(result.data) ? result.data : [];
            var map = {};
            var seen = {};
            list.forEach(function (item) {
                var level = Number(item.dictLevel != null ? item.dictLevel : (item.dict_level != null ? item.dict_level : 2));
                if (level === 1) return;
                var rawCode = String(item.dictCode || item.code || '').trim().toUpperCase();
                var name = String(item.dictName || item.dictname || item.name || '').trim();
                var canonical = dictItemToOrderCode(item);
                if (!canonical || !name || !isValidOrderCanonical(canonical)) return;
                if (seen[canonical]) return;
                seen[canonical] = true;
                map[rawCode] = name;
                map[canonical] = name;
            });
            return publishOrderMap(map);
        }).catch(function (err) {
            console.warn('[TM_OrderDict] 加载 D010 失败，使用 fallback:', err);
            return publishOrderMap(TM_ORDER_STATUS_FALLBACK);
        });
        return _orderLoadPromise;
    }

    function loadSupplierReturnStatusDict() {
        if (_supplierReturnLoadPromise) return _supplierReturnLoadPromise;
        _supplierReturnLoadPromise = apiFetch('/dictionaries/list/D021').then(function (result) {
            var list = result && Array.isArray(result.data) ? result.data : [];
            var map = {};
            var seen = {};
            list.forEach(function (item) {
                var level = Number(item.dictLevel != null ? item.dictLevel : (item.dict_level != null ? item.dict_level : 2));
                if (level === 1) return;
                var rawCode = String(item.dictCode || item.code || '').trim().toUpperCase();
                var name = String(item.dictName || item.dictname || item.name || '').trim();
                var canonical = dictItemToSupplierReturnCode(item);
                if (!canonical || !name || !isValidSupplierReturnCanonical(canonical)) return;
                if (seen[canonical]) return;
                seen[canonical] = true;
                map[rawCode] = name;
                map[canonical] = name;
            });
            return publishSupplierReturnMap(map);
        }).catch(function (err) {
            console.warn('[TM_OrderDict] 加载 D021 失败，使用 fallback:', err);
            return publishSupplierReturnMap(TM_SUPPLIER_RETURN_STATUS_FALLBACK);
        });
        return _supplierReturnLoadPromise;
    }

    function orderStatusLabel(code) {
        var canon = toCanonicalOrderStatusCode(code);
        var map = window.TM_ORDER_STATUS_MAP || TM_ORDER_STATUS_FALLBACK;
        if (canon && map[canon]) return map[canon];
        var raw = String(code || '').trim().toUpperCase();
        if (raw && map[raw]) return map[raw];
        if (canon && TM_ORDER_STATUS_FALLBACK[canon]) return TM_ORDER_STATUS_FALLBACK[canon];
        return code || '—';
    }

    function supplierReturnStatusLabel(code) {
        var canon = toCanonicalSupplierReturnStatusCode(code);
        var map = window.TM_SUPPLIER_RETURN_STATUS_MAP || TM_SUPPLIER_RETURN_STATUS_FALLBACK;
        if (canon && map[canon]) return map[canon];
        var raw = String(code || '').trim().toUpperCase();
        if (raw && map[raw]) return map[raw];
        if (canon && TM_SUPPLIER_RETURN_STATUS_FALLBACK[canon]) return TM_SUPPLIER_RETURN_STATUS_FALLBACK[canon];
        return code || '—';
    }

    var TM_RETURN_STATUS_FALLBACK = {
        D018001: '草稿',
        D018002: '待收货',
        D018003: '验收中',
        D018004: '已完成',
        D018005: '拒收',
        D018006: '作废'
    };

    function toCanonicalReturnStatusCode(statusCode) {
        var raw = String(statusCode || '').trim().toUpperCase();
        if (!raw) return '';
        if (raw === 'DRAFT') return 'D018001';
        if (raw === 'PENDING_RECEIVE') return 'D018002';
        if (raw === 'INSPECTING') return 'D018003';
        if (raw === 'COMPLETED') return 'D018004';
        if (raw === 'REJECTED') return 'D018005';
        if (raw === 'VOIDED') return 'D018006';
        var m = raw.match(/^D018[_-]?0*(\d{1,3})$/);
        if (m) {
            var n = m[1];
            while (n.length < 3) n = '0' + n;
            return 'D018' + n;
        }
        return normalizeDictCode(raw);
    }

    function returnStatusLabel(code) {
        var canon = toCanonicalReturnStatusCode(code);
        if (canon && TM_RETURN_STATUS_FALLBACK[canon]) return TM_RETURN_STATUS_FALLBACK[canon];
        return code || '—';
    }

    function normalizeFinStatus(code) {
        return String(code || 'UNPAID').trim().toUpperCase();
    }

    /** 与后端 OrderStatusCodes.isWorkbenchOpen 一致 */
    function isWorkbenchOpenOrder(order) {
        if (!order) return false;
        var st = toCanonicalOrderStatusCode(order.order_status || order.orderStatus);
        if (st === 'D010005') return false;
        var fullyShipped = st === 'D010003' || st === 'D010004';
        var settled = normalizeFinStatus(order.fin_status || order.finStatus) === 'SETTLED';
        return !fullyShipped || !settled;
    }

    function dateDaysAgo(days) {
        var d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
    }

    publishOrderMap(TM_ORDER_STATUS_FALLBACK);
    publishSupplierReturnMap(TM_SUPPLIER_RETURN_STATUS_FALLBACK);

    window.TM_OrderDict = {
        TM_ORDER_STATUS_FALLBACK: TM_ORDER_STATUS_FALLBACK,
        TM_SUPPLIER_RETURN_STATUS_FALLBACK: TM_SUPPLIER_RETURN_STATUS_FALLBACK,
        toCanonicalOrderStatusCode: toCanonicalOrderStatusCode,
        toCanonicalSupplierReturnStatusCode: toCanonicalSupplierReturnStatusCode,
        publishOrderMap: publishOrderMap,
        publishSupplierReturnMap: publishSupplierReturnMap,
        loadOrderStatusDict: loadOrderStatusDict,
        loadSupplierReturnStatusDict: loadSupplierReturnStatusDict,
        ensureOrderDictLoaded: loadOrderStatusDict,
        ensureSupplierReturnDictLoaded: loadSupplierReturnStatusDict,
        orderStatusLabel: orderStatusLabel,
        supplierReturnStatusLabel: supplierReturnStatusLabel,
        returnStatusLabel: returnStatusLabel,
        toCanonicalReturnStatusCode: toCanonicalReturnStatusCode,
        isWorkbenchOpenOrder: isWorkbenchOpenOrder,
        normalizeFinStatus: normalizeFinStatus,
        dateDaysAgo: dateDaysAgo
    };
})();
