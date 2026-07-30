/**
 * 物流运单号清洗与承运商识别（对齐欠货履约 LOGISTICS_BRANDS 中文名）
 */
(function (global) {
    'use strict';

    var BRANDS = ['顺丰', '中通', '圆通', '韵达', '申通', '极兔', '德邦', '自配送'];

    var CODE_TO_BRAND = {
        SF: '顺丰', SFEXPRESS: '顺丰', SHUNFENG: '顺丰',
        ZTO: '中通', ZHONGTONG: '中通',
        YTO: '圆通', YUANTONG: '圆通',
        YD: '韵达', YUNDA: '韵达',
        STO: '申通', SHENTONG: '申通',
        JT: '极兔', JTEXPRESS: '极兔', JITU: '极兔',
        DBL: '德邦', DBKD: '德邦', DEBANG: '德邦', DEPPON: '德邦'
    };

    function normalizeBrand(name) {
        if (!name) return '';
        var t = String(name).trim();
        if (!t) return '';
        if (BRANDS.indexOf(t) >= 0) return t;
        var upper = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (CODE_TO_BRAND[upper]) return CODE_TO_BRAND[upper];
        for (var i = 0; i < BRANDS.length; i++) {
            if (t.indexOf(BRANDS[i]) >= 0) return BRANDS[i];
        }
        return '';
    }

    /** 从扫码/粘贴内容提取运单号（支持 URL query） */
    function cleanTrackingNo(raw) {
        if (raw == null) return '';
        var s = String(raw).trim();
        if (!s) return '';
        // 多行取首行
        s = s.split(/[\r\n]+/)[0].trim();
        try {
            if (/^https?:\/\//i.test(s)) {
                var u = new URL(s);
                var keys = ['mailNo', 'mailno', 'billCode', 'billcode', 'nu', 'trackingNo',
                    'tracking_no', 'waybill', 'waybillNo', 'expressNo', 'number', 'no'];
                for (var i = 0; i < keys.length; i++) {
                    var v = u.searchParams.get(keys[i]);
                    if (v && String(v).trim()) {
                        s = String(v).trim();
                        break;
                    }
                }
                if (/^https?:\/\//i.test(s)) {
                    var path = u.pathname || '';
                    var m = path.match(/([A-Za-z0-9]{8,})/);
                    if (m) s = m[1];
                }
            }
        } catch (e) { /* ignore */ }
        s = s.replace(/[\s\-]/g, '');
        // 去掉中文前缀如「运单号:」
        s = s.replace(/^[^A-Za-z0-9]+/, '');
        return s;
    }

    /**
     * @returns {{ brand: string, confidence: number, trackingNo: string }}
     */
    function detectBrand(rawTracking) {
        var trackingNo = cleanTrackingNo(rawTracking);
        var result = { brand: '', confidence: 0, trackingNo: trackingNo };
        if (!trackingNo) return result;

        var upper = trackingNo.toUpperCase();

        // 显式前缀
        var prefixRules = [
            { re: /^(SF|SFEXPRESS)/i, brand: '顺丰', conf: 0.95 },
            { re: /^(YT|YTO)/i, brand: '圆通', conf: 0.9 },
            { re: /^(ZTO|ZT)/i, brand: '中通', conf: 0.85 },
            { re: /^(STO|ST)/i, brand: '申通', conf: 0.85 },
            { re: /^(YD)/i, brand: '韵达', conf: 0.9 },
            { re: /^(JT|JTE)/i, brand: '极兔', conf: 0.9 },
            { re: /^(DPK|DBL|DEBANG)/i, brand: '德邦', conf: 0.9 }
        ];
        for (var i = 0; i < prefixRules.length; i++) {
            if (prefixRules[i].re.test(upper)) {
                result.brand = prefixRules[i].brand;
                result.confidence = prefixRules[i].conf;
                return result;
            }
        }

        // 常见号段启发式（置信度较低）
        if (/^SF\d{10,}$/i.test(trackingNo) || /^[0-9]{12}$/.test(trackingNo) && trackingNo.indexOf('SF') === 0) {
            result.brand = '顺丰';
            result.confidence = 0.7;
            return result;
        }
        // 顺丰：12–15 位纯数字且以特定开头较少；SF + 数字更稳，上面已覆盖
        if (/^77\d{13}$/.test(trackingNo) || /^YT\d+/i.test(trackingNo)) {
            result.brand = '圆通';
            result.confidence = 0.65;
            return result;
        }
        if (/^75\d{13}$/.test(trackingNo) || /^ZTO/i.test(trackingNo)) {
            result.brand = '中通';
            result.confidence = 0.6;
            return result;
        }
        if (/^JD[A-Z0-9]+/i.test(trackingNo)) {
            // 京东不在品牌表，不强填
            return result;
        }

        return result;
    }

    function applyToSelect(selectEl, brand) {
        if (!selectEl || !brand) return false;
        var normalized = normalizeBrand(brand);
        if (!normalized) return false;
        var opts = selectEl.options;
        for (var i = 0; i < opts.length; i++) {
            if (opts[i].value === normalized) {
                selectEl.value = normalized;
                return true;
            }
        }
        return false;
    }

    global.TM_LogisticsDetect = {
        BRANDS: BRANDS.slice(),
        cleanTrackingNo: cleanTrackingNo,
        detectBrand: detectBrand,
        normalizeBrand: normalizeBrand,
        applyToSelect: applyToSelect
    };
})(typeof window !== 'undefined' ? window : this);
