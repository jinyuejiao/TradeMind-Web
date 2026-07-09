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

    function isPgObjectSerialization(attrs) {
        return attrs && typeof attrs === 'object' && !Array.isArray(attrs)
            && attrs.type === 'json' && Object.prototype.hasOwnProperty.call(attrs, 'value');
    }

    function parseSkuAttributes(raw) {
        var attrs = raw || {};
        if (typeof attrs === 'string') {
            try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
        }
        if (isPgObjectSerialization(attrs)) {
            try {
                var inner = typeof attrs.value === 'string' ? JSON.parse(attrs.value) : attrs.value;
                attrs = (inner && typeof inner === 'object' && !Array.isArray(inner)) ? inner : {};
            } catch (e) {
                attrs = {};
            }
        }
        if (Array.isArray(attrs)) {
            return {};
        }
        if (attrs && typeof attrs === 'object') {
            var keys = Object.keys(attrs);
            if (keys.length && keys.every(function (k) { return k === 'type' || k === 'value' || k === 'null'; })) {
                return {};
            }
        }
        return attrs && typeof attrs === 'object' ? attrs : {};
    }

    function formatSkuSpecLabel(sku) {
        if (!sku) return '';
        var label = sku.specDisplay || sku.spec_display || sku.attributes_display || sku.attributesDisplay || '';
        if (label) return String(label);
        var attrs = parseSkuAttributes(sku.attributes || sku.attrs);
        var keys = Object.keys(attrs).filter(function (k) {
            return k !== 'type' && k !== 'value' && k !== 'null';
        });
        if (!keys.length) return '';
        return keys.map(function (k) {
            var v = attrs[k];
            return v == null ? '' : String(v);
        }).filter(Boolean).join(' / ');
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
        formatSkuSpecLabel: formatSkuSpecLabel,
        cartesianFromSelection: cartesianFromSelection,
        whStockLookup: whStockLookup,
        getAllSpecDims: getAllSpecDims,
        skuMatchesSelection: skuMatchesSelection
    };
})();
