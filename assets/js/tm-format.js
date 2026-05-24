/**
 * TradeMind — 金额/货币展示（批发默认 CNY）
 */
(function () {
    'use strict';

    function toNumber(value) {
        if (value == null || value === '') return 0;
        if (typeof value === 'number') return isFinite(value) ? value : 0;
        var s = String(value).replace(/[¥$,\s]/g, '');
        var n = parseFloat(s);
        return isFinite(n) ? n : 0;
    }

    function formatCNY(value, opts) {
        opts = opts || {};
        var n = toNumber(value);
        var digits = opts.digits != null ? opts.digits : 2;
        var prefix = opts.symbol === false ? '' : '¥';
        return prefix + n.toFixed(digits);
    }

    function parseCNY(text) {
        return toNumber(text);
    }

    window.TM_formatCNY = formatCNY;
    window.TM_parseCNY = parseCNY;
    window.formatCNYAmount = formatCNY;
})();
