/**
 * SKU 选品目录内存缓存（极速开单预载）
 */
(function () {
    'use strict';

    var CACHE_TTL_MS = 5 * 60 * 1000;
    var state = { rows: [], categories: [], categoryNames: {}, loadedAt: 0, warehouseId: null };

    function mapRow(r) {
        return {
            skuId: r.sku_id || r.skuId,
            spuId: r.spu_id || r.spuId,
            name: r.spu_name || r.spuName || r.name || '',
            specDisplay: r.spec_display || r.specDisplay || r.attributes_display || '',
            price: Number(r.price || 0),
            stock: Number(r.stock_qty != null ? r.stock_qty : (r.stock || 0)),
            coverUrl: r.cover_url || r.coverUrl || null,
            categoryId: r.category_id != null ? r.category_id : r.categoryId,
            legacyProductId: r.legacy_product_id || r.legacyProductId,
            trackExpiry: !!(r.track_expiry || r.trackExpiry),
            trackSerial: !!(r.track_serial || r.trackSerial),
            attributes: r.attributes || {}
        };
    }

    function buildCategories(rows) {
        var map = { 0: { id: 0, name: '全部' } };
        var names = state.categoryNames || {};
        rows.forEach(function (r) {
            var cid = r.categoryId != null ? r.categoryId : 0;
            if (!map[cid]) {
                map[cid] = { id: cid, name: names[cid] || ('分类#' + cid) };
            }
        });
        return Object.keys(map).map(function (k) { return map[k]; });
    }

    window.TM_SkuCatalogCache = {
        getRows: function () { return state.rows; },
        getCategories: function () { return state.categories; },

        isFresh: function (warehouseId) {
            if (!state.loadedAt || !state.rows.length) return false;
            if (Date.now() - state.loadedAt > CACHE_TTL_MS) return false;
            if (warehouseId != null && state.warehouseId !== warehouseId) return false;
            return true;
        },

        load: async function (warehouseId, force) {
            if (!force && window.TM_SkuCatalogCache.isFresh(warehouseId)) {
                return state.rows;
            }
            if (!window.wrappedFetch) return [];
            var qs = warehouseId != null ? ('?warehouseId=' + encodeURIComponent(warehouseId)) : '';
            var resp = await window.wrappedFetch('/api/v1/rd/products/skus/catalog' + qs, { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var raw = data && data.data ? data.data : (Array.isArray(data) ? data : []);
            state.rows = raw.map(mapRow);
            try {
                var catResp = await window.wrappedFetch('/api/v1/rd/products/categories', { method: 'GET' });
                var catData = await window.handleApiResponse(catResp);
                var catList = catData && catData.data ? catData.data : [];
                state.categoryNames = {};
                catList.forEach(function (c) {
                    var id = c.categoryId != null ? c.categoryId : c.category_id;
                    var name = c.categoryName || c.name || c.category_name;
                    if (id != null && name) state.categoryNames[id] = name;
                });
            } catch (e) { state.categoryNames = {}; }
            state.categories = buildCategories(state.rows);
            state.loadedAt = Date.now();
            state.warehouseId = warehouseId != null ? warehouseId : null;
            try {
                sessionStorage.setItem('tm_sku_catalog_cache', JSON.stringify({ t: state.loadedAt, wh: state.warehouseId, rows: state.rows }));
            } catch (e) { /* ignore */ }
            return state.rows;
        },

        filterByCategory: function (categoryId) {
            if (categoryId == null || categoryId === 0 || categoryId === '0') return state.rows;
            return state.rows.filter(function (r) { return String(r.categoryId) === String(categoryId); });
        },

        warmFromSession: function () {
            try {
                var raw = sessionStorage.getItem('tm_sku_catalog_cache');
                if (!raw) return false;
                var o = JSON.parse(raw);
                if (!o.rows || Date.now() - o.t > CACHE_TTL_MS) return false;
                state.rows = o.rows;
                state.loadedAt = o.t;
                state.warehouseId = o.wh;
                state.categories = buildCategories(state.rows);
                return true;
            } catch (e) {
                return false;
            }
        }
    };
})();
