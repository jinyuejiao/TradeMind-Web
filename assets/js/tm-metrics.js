/**
 * TradeMind 全站经营指标与报表解析（与 IM ReportMetrics / ReportSqlConstants 对齐）
 */
(function () {
    'use strict';

    var REVENUE_EXCLUDED_STATUSES = [
        'CANCELLED', 'CANCELED', 'RETURNED', 'D010005', 'D010001', 'D010002',
        'ALLOCATING', 'PICKING', 'PENDING', 'PROCESSING', 'DRAFT'
    ];

    function toNumber(value) {
        if (value == null || value === '') return 0;
        if (typeof value === 'number') return isFinite(value) ? value : 0;
        var n = parseFloat(String(value).replace(/[¥$,\s]/g, ''));
        return isFinite(n) ? n : 0;
    }

    /**
     * 解析 PostgreSQL DATE / TIMESTAMP 为本地 Date（避免纯日期 UTC 偏移）
     */
    function parsePgDate(value) {
        if (value == null || value === '') return null;
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }
        if (Array.isArray(value) && value.length >= 3) {
            return new Date(value[0], value[1] - 1, value[2]);
        }
        var s = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            var p = s.split('-');
            return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        }
        var d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    }

    function formatChartDateLabel(value) {
        var d = parsePgDate(value);
        if (!d) return '';
        var m = (d.getMonth() + 1).toString().padStart(2, '0');
        var day = d.getDate().toString().padStart(2, '0');
        return m + '-' + day;
    }

    function isReportRevenueOrder(item) {
        var status = String(item.orderStatus || item.order_status || '').toUpperCase().trim();
        var fin = String(item.finStatus || item.fin_status || 'UNPAID').toUpperCase().trim();
        if (fin === 'BAD_DEBT') return false;
        return status && REVENUE_EXCLUDED_STATUSES.indexOf(status) === -1;
    }

    function isToday(dateValue) {
        var date = parsePgDate(dateValue);
        if (!date) return false;
        var now = new Date();
        return date.getFullYear() === now.getFullYear()
            && date.getMonth() === now.getMonth()
            && date.getDate() === now.getDate();
    }

    function inventoryTurnover(cogsInPeriod, inventoryValue) {
        var cogs = toNumber(cogsInPeriod);
        var inv = toNumber(inventoryValue);
        if (inv <= 0) return 0;
        return cogs / inv;
    }

    function paymentCycleDays(receivable, creditSalesInPeriod, periodDays) {
        var recv = toNumber(receivable);
        var sales = toNumber(creditSalesInPeriod);
        var days = toNumber(periodDays) || 365;
        if (sales <= 0) return 0;
        return (recv / sales) * days;
    }

    function suggestRestockBaseUnits(avgDailySales, leadTimeDays, warningStock, stockBase) {
        var raw = toNumber(avgDailySales) * Math.max(1, leadTimeDays) + toNumber(warningStock) - toNumber(stockBase);
        return Math.max(0, Math.round(raw));
    }

    function formatPurchasePrice(value) {
        var n = toNumber(value);
        if (n <= 0) return null;
        return n;
    }

    function unwrapReportPayload(result) {
        if (result == null) return null;
        if (result.data !== undefined) return result.data;
        return result;
    }

    function inventoryHealthBuckets(items) {
        var list = Array.isArray(items) ? items : [];
        var total = list.length;
        var healthy = 0;
        var risk = 0;
        var overstock = 0;
        list.forEach(function (item) {
            var st = String(item.status || '');
            if (st === '积压') overstock++;
            else if (st === '风险' || st === '缺货风险') risk++;
            else if (st === '健康' || st === '正常') healthy++;
        });
        var pct = function (n) {
            return total > 0 ? Math.round((n / total) * 100) : 0;
        };
        return {
            total: total,
            healthy: healthy,
            risk: risk,
            overstock: overstock,
            healthyPct: pct(healthy),
            riskPct: pct(risk),
            overstockPct: pct(overstock)
        };
    }

    window.TM_METRICS = {
        REVENUE_EXCLUDED_STATUSES: REVENUE_EXCLUDED_STATUSES,
        SALES_WINDOW_DAYS: 14,
        toNumber: toNumber,
        parsePgDate: parsePgDate,
        formatChartDateLabel: formatChartDateLabel,
        isReportRevenueOrder: isReportRevenueOrder,
        isToday: isToday,
        inventoryTurnover: inventoryTurnover,
        paymentCycleDays: paymentCycleDays,
        suggestRestockBaseUnits: suggestRestockBaseUnits,
        formatPurchasePrice: formatPurchasePrice,
        unwrapReportPayload: unwrapReportPayload,
        inventoryHealthBuckets: inventoryHealthBuckets
    };
})();
