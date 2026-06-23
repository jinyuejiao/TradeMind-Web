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

    function trimUnit(val) {
        if (val == null) return '';
        var s = String(val).trim();
        return s;
    }

    /** 订单行 v2：规格/批次/序列号归一 */
    function normalizeOrderItemVariant(item) {
        if (!item || typeof item !== 'object') return item;
        if (item.matched_sku_id != null) item.matched_sku_id = Number(item.matched_sku_id);
        if (item.matched_spu_id != null) item.matched_spu_id = Number(item.matched_spu_id);
        if (!item.matched_sku_id && item.matched_product_id) {
            item.matched_sku_id = Number(item.matched_product_id);
        }
        if (item.attributes_raw && typeof item.attributes_raw === 'object') {
            var parts = Object.keys(item.attributes_raw).map(function (k) {
                return item.attributes_raw[k];
            });
            item.attributes_display = parts.join(' / ');
        }
        if (!item.attributes_display && item.attributes_display !== '') {
            item.attributes_display = trimUnit(item.attributes_display || item.variant_summary || '');
        }
        return item;
    }

    function normalizeOrderItemBatch(item) {
        if (!item || typeof item !== 'object') return item;
        if (item.batch_no != null) item.batch_no = String(item.batch_no).trim();
        if (item.production_date != null) item.production_date = String(item.production_date).slice(0, 10);
        if (item.expiry_date != null) item.expiry_date = String(item.expiry_date).slice(0, 10);
        return item;
    }

    function normalizeOrderItemSerials(item) {
        if (!item || typeof item !== 'object') return item;
        if (item.serial_nos == null && item.serialNos != null) item.serial_nos = item.serialNos;
        if (typeof item.serial_nos === 'string') {
            item.serial_nos = item.serial_nos.split(/[\r\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        }
        if (!Array.isArray(item.serial_nos)) item.serial_nos = [];
        return item;
    }

    function normalizeOrderItemV2(item) {
        return normalizeOrderItemSerials(normalizeOrderItemBatch(normalizeOrderItemVariant(normalizeOrderItemUnit(item))));
    }

    function normalizeNewProductVariant(np) {
        if (!np || typeof np !== 'object') return np;
        normalizeNewProductUnits(np);
        if (np.track_variants != null) np.trackVariants = np.track_variants;
        if (np.track_expiry != null) np.trackExpiry = np.track_expiry;
        if (np.track_serial != null) np.trackSerial = np.track_serial;
        if (np.spu_name && !np.name) np.name = np.spu_name;
        return np;
    }

    /** 订单行单位归一 → item.unit */
    function normalizeOrderItemUnit(item) {
        if (!item || typeof item !== 'object') return item;
        var u = trimUnit(item.unit || item.unit_name || item.unitName
            || item.sales_unit || item.salesUnit || item.base_unit || item.baseUnit);
        if (u) item.unit = u;
        return item;
    }

    /**
     * 仅从 new_products_found 移除「订单行已关联有效 productId」的新产品。
     * 禁止仅凭名称与订单行一致就剔除（存草稿时订单行往往仅有 product_name_raw）。
     */
    function pruneResolvedNewProductsFromOrder(data) {
        if (!data || !Array.isArray(data.new_products_found) || !data.order_data || !Array.isArray(data.order_data.items)) {
            return;
        }
        var items = data.order_data.items;
        data.new_products_found = data.new_products_found.filter(function (np) {
            if (!np || typeof np !== 'object') return false;
            var npName = String(np.name || np.product_name || '').trim();
            var filedId = Number(
                np.saved_product_id != null ? np.saved_product_id
                    : (np.product_id != null ? np.product_id
                        : (np.matched_product_id != null ? np.matched_product_id : 0))
            );
            var linked = items.some(function (it) {
                if (!it || typeof it !== 'object') return false;
                var pid = it.matched_product_id != null ? Number(it.matched_product_id) : 0;
                if (!Number.isFinite(pid) || pid <= 0) return false;
                if (filedId > 0 && pid === filedId) return true;
                if (npName) {
                    var lineName = String(it.matched_product_name || it.product_name_raw || '').trim();
                    if (lineName && lineName === npName) return true;
                }
                return false;
            });
            return !linked;
        });
    }

    /** 新产品单位归一 → base_unit / sales_unit */
    function normalizeNewProductUnits(np) {
        if (!np || typeof np !== 'object') return np;
        var bu = trimUnit(np.base_unit || np.baseUnit || np.unit);
        if (bu) {
            np.base_unit = bu;
            np.baseUnit = bu;
        }
        var su = trimUnit(np.sales_unit || np.salesUnit);
        if (su) {
            np.sales_unit = su;
            np.salesUnit = su;
        } else if (bu) {
            np.sales_unit = bu;
            np.salesUnit = bu;
        }
        return np;
    }

    function syncNewProductUnitsFromOrderItems(data) {
        if (!data || !data.order_data || !Array.isArray(data.order_data.items)) return;
        if (!Array.isArray(data.new_products_found)) return;
        data.new_products_found.forEach(function (np) {
            normalizeNewProductUnits(np);
            if (trimUnit(np.base_unit || np.baseUnit)) return;
            var name = trimUnit(np.name || np.product_name || np.productName);
            if (!name) return;
            for (var i = 0; i < data.order_data.items.length; i++) {
                var it = data.order_data.items[i];
                var raw = trimUnit(it.product_name_raw || it.matched_product_name || it.name);
                if (raw === name && trimUnit(it.unit)) {
                    np.base_unit = it.unit;
                    np.baseUnit = it.unit;
                    if (!trimUnit(np.sales_unit || np.salesUnit)) {
                        np.sales_unit = it.unit;
                        np.salesUnit = it.unit;
                    }
                    break;
                }
            }
        });
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
            if (data.order_data && Array.isArray(data.order_data.items)) {
                data.order_data.items = data.order_data.items.map(normalizeOrderItemV2);
            }
            if (Array.isArray(data.new_products_found)) {
                data.new_products_found = data.new_products_found.map(normalizeNewProductVariant);
                syncNewProductUnitsFromOrderItems(data);
            }
            pruneResolvedNewProductsFromOrder(data);
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
        const details = envelope.details && typeof envelope.details === 'object' ? envelope.details : {};
        const productResolved = details.productResolved === true;
        const pi = parseJsonField(envelope.productInfo != null ? envelope.productInfo : envelope.product_info);
        if (Array.isArray(pi) && pi.length > 0) {
            data.new_products_found = pi;
        } else if (productResolved) {
            data.new_products_found = [];
        } else if (!Array.isArray(data.new_products_found)) {
            data.new_products_found = [];
        }
        const matchedId = data.customer_data && data.customer_data.matched_customer_id != null
            ? Number(data.customer_data.matched_customer_id)
            : 0;
        const customerAlreadyResolved = Number.isFinite(matchedId) && matchedId > 0;
        const ncFromDetails = details.newCustomersFound != null ? details.newCustomersFound : details.new_customers_found;
        if (!customerAlreadyResolved && Array.isArray(ncFromDetails) && ncFromDetails.length > 0) {
            data.new_customers_found = ncFromDetails;
        } else if (customerAlreadyResolved) {
            data.new_customers_found = [];
        }
        const npFromDetails = details.newProductsFound != null ? details.newProductsFound : details.new_products_found;
        if (Array.isArray(npFromDetails) && npFromDetails.length > 0 && !productResolved
            && (!Array.isArray(data.new_products_found) || data.new_products_found.length === 0)) {
            data.new_products_found = npFromDetails;
        }
        if (!Array.isArray(data.new_customers_found)) {
            data.new_customers_found = [];
        }
        if (!Array.isArray(data.new_products_found)) {
            data.new_products_found = [];
        }

        if (data.order_data && Array.isArray(data.order_data.items)) {
            data.order_data.items = data.order_data.items.map(function (item) {
                if (!item || typeof item !== 'object') return item;
                if (item.price_at_time == null || item.price_at_time === '' || Number(item.price_at_time) === 0) {
                    var p = item.unit_price != null ? item.unit_price : (item.price != null ? item.price : item.sale_price);
                    if (p != null && p !== '') item.price_at_time = Number(p);
                }
                if (item.quantity == null || item.quantity === '') {
                    item.quantity = item.qty != null ? item.qty : 1;
                }
                return normalizeOrderItemV2(item);
            });
        }
        if (Array.isArray(data.new_products_found)) {
            data.new_products_found = data.new_products_found.map(normalizeNewProductVariant);
            syncNewProductUnitsFromOrderItems(data);
        }
        pruneResolvedNewProductsFromOrder(data);

        const ok = data.customer_data && data.order_data;
        return { envelope: envelope || {}, data: ok ? data : {} };
    }

    global.TM_safeJsonParseForOrderExtract = safeJsonParse;
    global.TM_pruneResolvedNewProductsFromOrder = pruneResolvedNewProductsFromOrder;
    global.TM_parseOrderExtractStructured = TM_parseOrderExtractStructured;
    global.TM_normalizeOrderItemUnit = normalizeOrderItemUnit;
    global.TM_normalizeOrderItemV2 = normalizeOrderItemV2;
    global.TM_normalizeNewProductUnits = normalizeNewProductUnits;
    global.TM_normalizeNewProductVariant = normalizeNewProductVariant;
})(typeof window !== 'undefined' ? window : this);
