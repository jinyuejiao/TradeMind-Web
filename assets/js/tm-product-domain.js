/**
 * 产品领域共享工具：规格组合键、属性解析、笛卡尔积、分仓库存查找
 * 供规格弹窗、极速开单等模块复用，避免三处重复实现。
 */
(function () {
    'use strict';

    function comboKey(attrs) {
        if (!attrs) return '';
        return Object.keys(attrs).sort().map(function (k) {
            return k + ':' + attrs[k];
        }).join('|');
    }

    function parseSkuAttributes(raw) {
        var attrs = raw || {};
        if (typeof attrs === 'string') {
            try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
        }
        return attrs && typeof attrs === 'object' ? attrs : {};
    }

    function cartesianFromSelection(sel) {
        var keys = Object.keys(sel || {}).filter(function (k) {
            return sel[k] && sel[k].length;
        });
        if (!keys.length) return [];
        var result = [{}];
        keys.forEach(function (key) {
            var next = [];
            result.forEach(function (partial) {
                sel[key].forEach(function (val) {
                    var c = Object.assign({}, partial);
                    c[key] = val;
                    next.push(c);
                });
            });
            result = next;
        });
        return result;
    }

    function whStockLookup(whStocks, wid) {
        if (!whStocks || wid == null) return 0;
        if (whStocks[wid] != null) return parseInt(whStocks[wid], 10) || 0;
        var sk = String(wid);
        if (whStocks[sk] != null) return parseInt(whStocks[sk], 10) || 0;
        return 0;
    }

    function getAllSpecDims(skus) {
        var dims = {};
        (skus || []).forEach(function (sku) {
            var attrs = parseSkuAttributes(sku.attributes || sku.attrs);
            Object.keys(attrs).forEach(function (k) {
                if (!dims[k]) dims[k] = [];
                if (dims[k].indexOf(attrs[k]) < 0) dims[k].push(attrs[k]);
            });
        });
        if (!Object.keys(dims).length && skus && skus.length) {
            skus.forEach(function (sku) {
                var label = sku.specDisplay || sku.attributes_display || sku.attributesDisplay
                    || ('SKU#' + (sku.skuId || sku.sku_id));
                dims['规格'] = dims['规格'] || [];
                if (dims['规格'].indexOf(label) < 0) dims['规格'].push(label);
            });
        }
        return dims;
    }

    function skuMatchesSelection(sku, selection, partial) {
        var attrs = parseSkuAttributes(sku.attributes || sku.attrs);
        var selKeys = Object.keys(selection || {}).filter(function (k) { return selection[k]; });
        if (!selKeys.length) return false;
        for (var i = 0; i < selKeys.length; i++) {
            var k = selKeys[i];
            if (k === '规格') {
                var label = sku.specDisplay || sku.attributes_display || sku.attributesDisplay;
                if (label !== selection[k]) return false;
            } else if (String(attrs[k] || '') !== String(selection[k])) {
                return false;
            }
        }
        if (!partial) {
            var allDims = getAllSpecDims([sku]);
            if (selKeys.length < Object.keys(allDims).length) return false;
        }
        return true;
    }

    window.TM_ProductDomain = {
        comboKey: comboKey,
        parseSkuAttributes: parseSkuAttributes,
        cartesianFromSelection: cartesianFromSelection,
        whStockLookup: whStockLookup,
        getAllSpecDims: getAllSpecDims,
        skuMatchesSelection: skuMatchesSelection
    };
})();
