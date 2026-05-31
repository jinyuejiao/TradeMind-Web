/**
 * TradeMind 全站经营指标与报表解析（与 IM ReportMetrics / ReportSqlConstants 对齐）
 */
(function () {
    'use strict';

    var REVENUE_EXCLUDED_STATUSES = [
        'CANCELLED', 'CANCELED', 'RETURNED', 'D010005', 'DRAFT'
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

    function weightedArAgeDays(weightedAgeSum, receivableBalance) {
        var sum = toNumber(weightedAgeSum);
        var balance = toNumber(receivableBalance);
        if (balance <= 0) return 0;
        return sum / balance;
    }

    function isPaymentCycleDataSufficient(settledOrderCount, receivedInPeriod, salesInPeriod, minSettledOrders, minReceivedRatio) {
        var settled = toNumber(settledOrderCount);
        var received = toNumber(receivedInPeriod);
        var sales = toNumber(salesInPeriod);
        var minOrders = toNumber(minSettledOrders) || 5;
        var minRatio = toNumber(minReceivedRatio) || 0.2;
        if (settled >= minOrders) return true;
        return sales > 0 && received / sales >= minRatio;
    }

    function resolvePaymentCycleDisplay(dsoDays, arAgeDays, historicalDays, dataSufficient) {
        var dso = toNumber(dsoDays);
        var arAge = toNumber(arAgeDays);
        var sufficient = !!dataSufficient;
        if (sufficient && historicalDays != null && isFinite(Number(historicalDays)) && Number(historicalDays) >= 0) {
            return Number(historicalDays);
        }
        if (sufficient && dso > 0) return dso;
        return Math.max(0, arAge);
    }

    function resolvePaymentCycleDisplayMethod(dsoDays, arAgeDays, historicalDays, dataSufficient) {
        var dso = toNumber(dsoDays);
        var sufficient = !!dataSufficient;
        if (sufficient && historicalDays != null && isFinite(Number(historicalDays)) && Number(historicalDays) >= 0) {
            return 'HISTORICAL';
        }
        if (sufficient && dso > 0) return 'DSO';
        return 'AR_AGE';
    }

    function paymentCycleDisplayHint(method) {
        if (method === 'AR_AGE') {
            return '基于应收账龄；登记收款后将显示历史回款天数';
        }
        if (method === 'HISTORICAL') {
            return '基于近一年已结清订单平均回款天数';
        }
        return '基于 DSO 公式（应收账款 / 年赊销 × 365）';
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
        weightedArAgeDays: weightedArAgeDays,
        isPaymentCycleDataSufficient: isPaymentCycleDataSufficient,
        resolvePaymentCycleDisplay: resolvePaymentCycleDisplay,
        resolvePaymentCycleDisplayMethod: resolvePaymentCycleDisplayMethod,
        paymentCycleDisplayHint: paymentCycleDisplayHint,
        PAYMENT_CYCLE_MIN_SETTLED_ORDERS: 5,
        PAYMENT_CYCLE_MIN_RECEIVED_RATIO: 0.2,
        suggestRestockBaseUnits: suggestRestockBaseUnits,
        formatPurchasePrice: formatPurchasePrice,
        unwrapReportPayload: unwrapReportPayload,
        inventoryHealthBuckets: inventoryHealthBuckets
    };
})();
