/**
 * AI 订单提取结果统一解析（文本 / 语音 ASR+LLM / 图片 VL 落库结构一致）
 * 输入为 ai_operation_records.ai_result 字符串或已解析对象。
 * 输出 { envelope, data }，data 含 customer_data、order_data、new_customers_found、new_products_found。
 */
(function (global) {
    'use strict';

    function safeJsonParse(text, fallback) {
        try {
            if (text == null || text === '') return fallback;
            return typeof text === 'string' ? JSON.parse(text) : text;
        } catch (e) {
            return fallback;
        }
    }

    function stripMarkdownJsonFence(text) {
        if (text == null || typeof text !== 'string') return text;
        let t = String(text).trim().replace(/^\uFEFF/, '');
        if (!t.startsWith('```')) return t;
        t = t.replace(/^```(?:json|JSON)?\s*\r?\n?/, '');
        const end = t.lastIndexOf('```');
        if (end >= 0) {
            t = t.slice(0, end);
        }
        return t.trim();
    }

    /** LLM 常在 result 外包 ```json … ```，失败时再尝试截取最外层 { … } */
    function parseResultPayloadToObject(rawResult) {
        if (rawResult == null) return null;
        if (typeof rawResult === 'object' && !Array.isArray(rawResult)) {
            return rawResult;
        }
        const s0 = String(rawResult).replace(/^\uFEFF/, '');
        const stripped = stripMarkdownJsonFence(s0.trim());
        let obj = safeJsonParse(stripped, null);
        if (obj && typeof obj === 'object') return obj;
        const first = stripped.indexOf('{');
        const last = stripped.lastIndexOf('}');
        if (first >= 0 && last > first) {
            obj = safeJsonParse(stripped.slice(first, last + 1), null);
        }
        return obj && typeof obj === 'object' ? obj : null;
    }

    function parseJsonField(value) {
        if (value == null) return null;
        if (typeof value === 'object' && !Array.isArray(value)) return value;
        const s = String(value).trim().replace(/^\uFEFF/, '');
        if (!s) return null;
        const fenced = stripMarkdownJsonFence(s);
        let parsed = safeJsonParse(fenced, null);
        if (typeof parsed === 'string') {
            parsed = safeJsonParse(stripMarkdownJsonFence(parsed), null);
        }
        return parsed && typeof parsed === 'object' ? parsed : null;
    }

    function normalizeEnvelopeRoot(rawAiResult) {
        if (rawAiResult == null || rawAiResult === '') {
            return {};
        }
        let raw = typeof rawAiResult === 'string' ? safeJsonParse(rawAiResult, {}) : rawAiResult;
        if (!raw || typeof raw !== 'object') {
            return {};
        }
        if (raw.data && typeof raw.data === 'object' && raw.result == null && raw.customer_data == null && raw.order_data == null) {
            return raw.data;
        }
        return raw;
    }

    /**
     * @param {*} rawAiResult 库中 aiResult 或接口返回
     * @returns {{ envelope: object, data: object }}
     */
    function TM_parseOrderExtractStructured(rawAiResult) {
        const envelope = normalizeEnvelopeRoot(rawAiResult);

        // 仅当根上已是扁平订单 JSON 且无 result 字段时短路（避免与 { result, orderInfo } 信封混淆）
        if ((envelope.result == null || envelope.result === '') && envelope.customer_data && envelope.order_data) {
            const data = {
                customer_data: envelope.customer_data,
                order_data: envelope.order_data,
                new_customers_found: Array.isArray(envelope.new_customers_found) ? envelope.new_customers_found : [],
                new_products_found: Array.isArray(envelope.new_products_found) ? envelope.new_products_found : []
            };
            return { envelope: envelope, data: data };
        }

        let data = {};
        const rawResult = envelope.result;
        if (rawResult != null) {
            const parsed = parseResultPayloadToObject(rawResult);
            if (parsed && typeof parsed === 'object') {
                Object.assign(data, parsed);
            }
        }

        const ci = parseJsonField(envelope.customerInfo != null ? envelope.customerInfo : envelope.customer_info);
        if (ci && typeof ci === 'object') {
            data.customer_data = Object.assign({}, data.customer_data || {}, ci);
        }
        const oi = parseJsonField(envelope.orderInfo != null ? envelope.orderInfo : envelope.order_info);
        if (oi && typeof oi === 'object') {
            const base = data.order_data && typeof data.order_data === 'object' ? data.order_data : {};
            data.order_data = Object.assign({}, base, oi);
            if (Array.isArray(oi.items)) {
                data.order_data.items = oi.items;
            }
        }
        const pi = parseJsonField(envelope.productInfo != null ? envelope.productInfo : envelope.product_info);
        if (Array.isArray(pi) && pi.length > 0) {
            data.new_products_found = pi;
        } else if (!Array.isArray(data.new_products_found)) {
            data.new_products_found = [];
        }

        const details = envelope.details && typeof envelope.details === 'object' ? envelope.details : {};
        const ncFromDetails = details.newCustomersFound != null ? details.newCustomersFound : details.new_customers_found;
        if (Array.isArray(ncFromDetails) && ncFromDetails.length > 0) {
            data.new_customers_found = ncFromDetails;
        }
        const npFromDetails = details.newProductsFound != null ? details.newProductsFound : details.new_products_found;
        if (Array.isArray(npFromDetails) && npFromDetails.length > 0 && (!Array.isArray(data.new_products_found) || data.new_products_found.length === 0)) {
            data.new_products_found = npFromDetails;
        }
        if (!Array.isArray(data.new_customers_found)) {
            data.new_customers_found = [];
        }
        if (!Array.isArray(data.new_products_found)) {
            data.new_products_found = [];
        }

        const ok = data.customer_data && data.order_data;
        return { envelope: envelope || {}, data: ok ? data : {} };
    }

    global.TM_safeJsonParseForOrderExtract = safeJsonParse;
    global.TM_parseOrderExtractStructured = TM_parseOrderExtractStructured;
})(typeof window !== 'undefined' ? window : this);
