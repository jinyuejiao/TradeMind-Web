/**
 * SKU 选品目录内存缓存（极速开单预载）
 */
(function () {
    'use strict';

    var CACHE_TTL_MS = 5 * 60 * 1000;
    var state = { rows: [], categories: [], categoryNames: {}, loadedAt: 0, warehouseId: null };

    function mapRow(r) {
        var cover = r.cover_url || r.coverUrl || null;
        if (cover && cover.indexOf('http') !== 0 && cover.indexOf('data:') !== 0) {
            cover = null;
        }
        var price = Number(r.price || 0);
        var attrs = r.attributes || {};
        if (window.TM_ProductDomain && window.TM_ProductDomain.parseSkuAttributes) {
            attrs = window.TM_ProductDomain.parseSkuAttributes(attrs);
        }
        return {
            skuId: r.sku_id || r.skuId,
            spuId: r.spu_id || r.spuId,
            name: r.spu_name || r.spuName || r.name || '',
            specDisplay: r.spec_display || r.specDisplay || r.attributes_display || '',
            price: price,
            stock: Number(r.stock_qty != null ? r.stock_qty : (r.stock || 0)),
            coverUrl: cover,
            categoryId: r.category_id != null ? r.category_id : r.categoryId,
            legacyProductId: r.legacy_product_id || r.legacyProductId,
            trackExpiry: !!(r.track_expiry || r.trackExpiry),
            trackSerial: !!(r.track_serial || r.trackSerial),
            attributes: attrs
        };
    }

    /**
     * 侧栏展示全量一级分类（来自分类 API），不以「有货 SKU」过滤；
     * 同时合并 SKU 上出现但 API 未返回的分类，避免漏项。
     */
    function buildCategories(rows, catList) {
        var map = { 0: { id: 0, name: '全部' } };
        var names = state.categoryNames || {};

        (catList || []).forEach(function (c) {
            if (!c) return;
            var id = c.categoryId != null ? c.categoryId
                : (c.category_id != null ? c.category_id : (c.id != null ? c.id : null));
            if (id == null || id === '' || Number(id) === 0) return;
            var name = c.categoryName || c.name || c.category_name || names[id] || ('分类#' + id);
            map[id] = { id: Number(id) || id, name: String(name) };
            names[id] = map[id].name;
        });

        (rows || []).forEach(function (r) {
            var cid = r.categoryId != null ? r.categoryId : null;
            if (cid == null || cid === '' || Number(cid) === 0) return;
            if (!map[cid]) {
                map[cid] = { id: Number(cid) || cid, name: names[cid] || ('分类#' + cid) };
            }
        });

        state.categoryNames = names;
        var list = Object.keys(map).map(function (k) { return map[k]; });
        list.sort(function (a, b) {
            if (Number(a.id) === 0) return -1;
            if (Number(b.id) === 0) return 1;
            return String(a.name).localeCompare(String(b.name), 'zh');
        });
        return list;
    }

    function normalizeRowAttrs(row) {
        if (!row) return row;
        if (window.TM_ProductDomain && window.TM_ProductDomain.parseSkuAttributes) {
            row.attributes = window.TM_ProductDomain.parseSkuAttributes(row.attributes);
        }
        return row;
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
                state.rows = state.rows.map(normalizeRowAttrs);
                return state.rows;
            }
            if (!window.wrappedFetch) return [];
            var qs = warehouseId != null ? ('?warehouseId=' + encodeURIComponent(warehouseId)) : '';
            var catalogPromise = window.wrappedFetch('/api/v1/rd/products/skus/catalog' + qs, { method: 'GET' })
                .then(function (resp) { return window.handleApiResponse(resp); });
            var catPromise = window.TM_MasterDataCache
                ? window.TM_MasterDataCache.getCategories(!!force)
                : window.wrappedFetch('/api/v1/rd/products/categories', { method: 'GET' })
                    .then(function (r) { return window.handleApiResponse(r); })
                    .then(function (d) { return d && d.data ? d.data : []; });

            var results = await Promise.all([catalogPromise, catPromise]);
            var data = results[0];
            var raw = data && data.data ? data.data : (Array.isArray(data) ? data : []);
            state.rows = raw.map(mapRow);
            var catList = results[1] || [];
            state.categoryNames = {};
            catList.forEach(function (c) {
                if (!c) return;
                var id = c.categoryId != null ? c.categoryId : c.category_id;
                var name = c.categoryName || c.name || c.category_name;
                if (id != null && name) state.categoryNames[id] = name;
            });
            state.categories = buildCategories(state.rows, catList);
            state.loadedAt = Date.now();
            state.warehouseId = warehouseId != null ? warehouseId : null;
            try {
                sessionStorage.setItem('tm_sku_catalog_cache_v2', JSON.stringify({
                    t: state.loadedAt,
                    wh: state.warehouseId,
                    rows: state.rows,
                    categories: state.categories,
                    categoryNames: state.categoryNames
                }));
            } catch (e) { /* ignore */ }
            return state.rows;
        },

        filterByCategory: function (categoryId) {
            if (categoryId == null || categoryId === 0 || categoryId === '0') return state.rows;
            return state.rows.filter(function (r) { return String(r.categoryId) === String(categoryId); });
        },

        groupBySpu: function (categoryId) {
            var rows = window.TM_SkuCatalogCache.filterByCategory(categoryId);
            var map = {};
            rows.forEach(function (r) {
                var sid = r.spuId != null ? String(r.spuId) : ('legacy-' + (r.legacyProductId || r.skuId));
                if (!map[sid]) {
                    map[sid] = {
                        spuId: r.spuId,
                        key: sid,
                        name: r.name,
                        coverUrl: r.coverUrl || null,
                        categoryId: r.categoryId,
                        skus: [],
                        minPrice: 0,
                        totalStock: 0,
                        hasVariants: false
                    };
                }
                var g = map[sid];
                g.skus.push(r);
                if (r.coverUrl && !g.coverUrl) g.coverUrl = r.coverUrl;
                var p = Number(r.price) || 0;
                if (p > 0) {
                    g.minPrice = g.minPrice > 0 ? Math.min(g.minPrice, p) : p;
                }
                g.totalStock += r.stock || 0;
                if (r.specDisplay) g.hasVariants = true;
            });
            return Object.keys(map).map(function (k) {
                var g = map[k];
                g.hasVariants = g.skus.length > 1 || g.hasVariants;
                return g;
            });
        },

        findSkuById: function (skuId) {
            var id = Number(skuId);
            return state.rows.find(function (r) { return Number(r.skuId) === id; }) || null;
        },

        warmFromSession: function () {
            try {
                var raw = sessionStorage.getItem('tm_sku_catalog_cache_v2')
                    || sessionStorage.getItem('tm_sku_catalog_cache');
                if (!raw) return false;
                var o = JSON.parse(raw);
                if (!o.rows || Date.now() - o.t > CACHE_TTL_MS) return false;
                state.rows = o.rows.map(normalizeRowAttrs);
                state.loadedAt = o.t;
                state.warehouseId = o.wh;
                state.categoryNames = o.categoryNames || {};
                if (o.categories && o.categories.length) {
                    state.categories = o.categories;
                } else {
                    // 旧缓存仅按有货 SKU 建分类，强制走完整加载
                    state.loadedAt = 0;
                    return false;
                }
                return true;
            } catch (e) {
                return false;
            }
        },

        invalidate: function () {
            state.rows = [];
            state.categories = [];
            state.categoryNames = {};
            state.loadedAt = 0;
            state.warehouseId = null;
            try {
                sessionStorage.removeItem('tm_sku_catalog_cache_v2');
                sessionStorage.removeItem('tm_sku_catalog_cache');
            } catch (e) { /* ignore */ }
        }
    };

    window.TM_notifyProductCatalogChanged = function () {
        window._tmCatalogDirty = true;
        if (window.TM_SkuCatalogCache && typeof window.TM_SkuCatalogCache.invalidate === 'function') {
            window.TM_SkuCatalogCache.invalidate();
        }
        if (window.TM_MasterDataCache && typeof window.TM_MasterDataCache.invalidateAll === 'function') {
            window.TM_MasterDataCache.invalidateAll();
        }
    };
})();
