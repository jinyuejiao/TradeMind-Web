/**
 * 主数据内存缓存：属性模板、SPU 详情、分类、仓库
 * 产品中心与极速开单共享，减少重复 HTTP 请求。
 */
(function () {
    'use strict';

    var TTL = {
        templates: 10 * 60 * 1000,
        spu: 2 * 60 * 1000,
        categories: 5 * 60 * 1000,
        warehouses: 5 * 60 * 1000
    };

    var state = {
        templates: { key: null, list: [], defaultId: null, loadedAt: 0 },
        categories: { list: [], loadedAt: 0 },
        warehouses: { list: [], loadedAt: 0 },
        spu: {}
    };

    function isFresh(loadedAt, ttl) {
        return loadedAt && (Date.now() - loadedAt) < ttl;
    }

    function spuCacheKey(spuId, warehouseId) {
        return String(spuId) + ':' + (warehouseId != null ? warehouseId : '');
    }

    window.TM_MasterDataCache = {
        TTL: TTL,

        invalidateSpu: function (spuId) {
            if (spuId == null) {
                state.spu = {};
                return;
            }
            Object.keys(state.spu).forEach(function (k) {
                if (k.indexOf(String(spuId) + ':') === 0) delete state.spu[k];
            });
        },

        invalidateAll: function () {
            state.templates = { key: null, list: [], defaultId: null, loadedAt: 0 };
            state.categories = { list: [], loadedAt: 0 };
            state.warehouses = { list: [], loadedAt: 0 };
            state.spu = {};
        },

        getCategories: async function (force) {
            if (!force && isFresh(state.categories.loadedAt, TTL.categories) && state.categories.list.length) {
                return state.categories.list;
            }
            if (!window.wrappedFetch) return [];
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/products/categories', { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                var list = data && data.data ? data.data : (Array.isArray(data) ? data : []);
                state.categories.list = list;
                state.categories.loadedAt = Date.now();
                return list;
            } catch (e) {
                return state.categories.list || [];
            }
        },

        getWarehouses: async function (force) {
            if (!force && isFresh(state.warehouses.loadedAt, TTL.warehouses) && state.warehouses.list.length) {
                return state.warehouses.list;
            }
            if (!window.wrappedFetch) return [];
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/products/warehouses', { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                var list = data && data.data ? data.data : (Array.isArray(data) ? data : []);
                state.warehouses.list = list;
                state.warehouses.loadedAt = Date.now();
                return list;
            } catch (e) {
                return state.warehouses.list || [];
            }
        },

        getAttributeTemplates: async function (industryVertical, force) {
            var iv = industryVertical || 'GENERAL';
            var cacheKey = iv.toUpperCase();
            if (!force && state.templates.key === cacheKey && isFresh(state.templates.loadedAt, TTL.templates)) {
                return { list: state.templates.list, defaultTemplateId: state.templates.defaultId };
            }
            if (!window.wrappedFetch) return { list: [], defaultTemplateId: null };
            var url = '/api/v1/rd/products/attribute-templates';
            if (iv && iv !== 'GENERAL') {
                url += '?industryVertical=' + encodeURIComponent(iv);
            }
            try {
                var resp = await window.wrappedFetch(url, { method: 'GET' });
                var res = await resp.json().catch(function () { return {}; });
                var list = res && res.success && Array.isArray(res.data) ? res.data : [];
                state.templates.key = cacheKey;
                state.templates.list = list;
                state.templates.defaultId = res && res.defaultTemplateId != null ? res.defaultTemplateId : null;
                state.templates.loadedAt = Date.now();
                return { list: list, defaultTemplateId: state.templates.defaultId };
            } catch (e) {
                return { list: state.templates.list || [], defaultTemplateId: state.templates.defaultId };
            }
        },

        getTemplateDetail: async function (templateId, force) {
            if (!templateId || !window.wrappedFetch) return null;
            var key = 'tpl:' + templateId;
            var cached = state.spu[key];
            if (!force && cached && isFresh(cached.loadedAt, TTL.templates)) {
                return cached.data;
            }
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/products/attribute-templates/' + templateId, { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                var detail = data && data.data ? data.data : data;
                state.spu[key] = { data: detail, loadedAt: Date.now() };
                return detail;
            } catch (e) {
                return null;
            }
        },

        getSpuDetail: async function (spuId, warehouseId, force) {
            if (!spuId || !window.wrappedFetch) return null;
            var key = spuCacheKey(spuId, warehouseId);
            var cached = state.spu[key];
            if (!force && cached && isFresh(cached.loadedAt, TTL.spu)) {
                return cached.data;
            }
            var qs = warehouseId != null ? ('?warehouseId=' + encodeURIComponent(warehouseId)) : '';
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/products/spu/' + spuId + qs, { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                var detail = data && data.data ? data.data : data;
                state.spu[key] = { data: detail, loadedAt: Date.now() };
                return detail;
            } catch (e) {
                return cached ? cached.data : null;
            }
        }
    };
})();
