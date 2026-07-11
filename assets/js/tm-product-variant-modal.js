/**
 * 产品规格属性独立弹窗：模板/自定义规格 → 笛卡尔积组合 → 分仓库存
 */
(function () {
    'use strict';
    var PM = window.ProductModule;
    if (!PM) return;

    PM._variantMatrixSelection = PM._variantMatrixSelection || {};
    PM._customAttrRows = PM._customAttrRows || [];
    PM._variantComboDraft = PM._variantComboDraft || [];
    PM._variantMatrixConfirmed = false;

    function comboKey(attrs) {
        if (window.TM_ProductDomain && window.TM_ProductDomain.comboKey) {
            return window.TM_ProductDomain.comboKey(attrs);
        }
        if (!attrs) return '';
        return Object.keys(attrs).sort().map(function (k) {
            return k + ':' + attrs[k];
        }).join('|');
    }

    function whStockLookup(whStocks, wid) {
        if (window.TM_ProductDomain && window.TM_ProductDomain.whStockLookup) {
            return window.TM_ProductDomain.whStockLookup(whStocks, wid);
        }
        if (!whStocks || wid == null) return 0;
        if (whStocks[wid] != null) return parseInt(whStocks[wid], 10) || 0;
        var sk = String(wid);
        if (whStocks[sk] != null) return parseInt(whStocks[sk], 10) || 0;
        return 0;
    }

    function getEnabledDraftRows() {
        return (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; });
    }

    function getSpuDefaultPrice() {
        var inp = PM.el('detail-product-price', 'product-price-input');
        if (inp && String(inp.value).trim() !== '') {
            var p = parseFloat(inp.value);
            if (!isNaN(p) && p >= 0) return p;
        }
        var cp = PM.currentProduct || {};
        if (cp.price != null && cp.price !== '') {
            var n = Number(cp.price);
            if (!isNaN(n) && n >= 0) return n;
        }
        return 0;
    }

    function normalizeComboPriceOverride(raw, spuDefault) {
        if (raw == null || raw === '') return null;
        var n = Number(raw);
        if (isNaN(n) || n < 0) return null;
        if (Math.abs(n - spuDefault) < 0.001) return null;
        return n;
    }

    function effectiveComboPrice(row) {
        var spuDefault = getSpuDefaultPrice();
        if (row && row.priceOverride != null && row.priceOverride !== '') {
            var n = Number(row.priceOverride);
            if (!isNaN(n) && n >= 0) return n;
        }
        return spuDefault;
    }

    function findDraftRowByComboKey(key) {
        if (!key) return null;
        var rows = getEnabledDraftRows();
        for (var i = 0; i < rows.length; i++) {
            if (comboKey(rows[i].attrs) === key) return rows[i];
        }
        return null;
    }

    function cloneComboRow(prev, attrs, key) {
        return {
            key: key,
            attrs: attrs,
            enabled: prev.enabled !== false,
            stock: prev.stock != null ? prev.stock : 0,
            warehouseStocks: prev.warehouseStocks ? Object.assign({}, prev.warehouseStocks) : {},
            coverUrl: prev.coverUrl || null,
            coverPreview: prev.coverPreview || null,
            imageFile: prev.imageFile || null,
            skuId: prev.skuId || null,
            priceOverride: prev.priceOverride != null ? prev.priceOverride : null
        };
    }

    PM.syncComboDraftFromDom = function () {
        var tbody = document.getElementById('tm-variant-combo-tbody');
        if (!tbody) return;
        tbody.querySelectorAll('.tm-variant-wh-qty').forEach(function (inp) {
            var ck = inp.getAttribute('data-combo-key');
            var whId = parseInt(inp.getAttribute('data-wh'), 10);
            var row = findDraftRowByComboKey(ck);
            if (!row || isNaN(whId)) return;
            row.warehouseStocks = row.warehouseStocks || {};
            row.warehouseStocks[whId] = Math.max(0, parseInt(inp.value, 10) || 0);
        });
        tbody.querySelectorAll('.tm-variant-row-stock').forEach(function (inp) {
            var ck = inp.getAttribute('data-combo-key');
            var row = findDraftRowByComboKey(ck);
            if (!row) return;
            row.stock = Math.max(0, parseInt(inp.value, 10) || 0);
        });
        var spuDefault = getSpuDefaultPrice();
        tbody.querySelectorAll('.tm-variant-row-price').forEach(function (inp) {
            var ck = inp.getAttribute('data-combo-key');
            var row = findDraftRowByComboKey(ck);
            if (!row) return;
            row.priceOverride = normalizeComboPriceOverride(inp.value, spuDefault);
        });
    };

    function findComboDomInput(className, comboKeyVal, whId) {
        var tbody = document.getElementById('tm-variant-combo-tbody');
        if (!tbody) return null;
        var nodes = tbody.querySelectorAll('.' + className);
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].getAttribute('data-combo-key') !== comboKeyVal) continue;
            if (whId != null) {
                if (parseInt(nodes[i].getAttribute('data-wh'), 10) === whId) return nodes[i];
            } else {
                return nodes[i];
            }
        }
        return null;
    }

    function cartesianFromSelection(sel) {
        if (window.TM_ProductDomain && window.TM_ProductDomain.cartesianFromSelection) {
            return window.TM_ProductDomain.cartesianFromSelection(sel);
        }
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

    PM.comboKeyFromAttrs = comboKey;

    var MAX_VARIANT_COMBOS = 200;
    var _comboGenTimer = null;

    function debouncedGenerateVariantCombos() {
        if (_comboGenTimer) clearTimeout(_comboGenTimer);
        _comboGenTimer = setTimeout(function () {
            _comboGenTimer = null;
            PM.generateVariantCombos();
        }, 280);
    }

    PM.getVariantTemplateAttrsBox = function () {
        var modalBox = document.getElementById('tm-variant-modal-template-attrs');
        if (modalBox && modalBox.querySelector('.tm-matrix-val')) return modalBox;
        return PM.el('detail-variant-matrix');
    };

    PM.syncVariantSelectionFromDom = function () {
        var box = PM.getVariantTemplateAttrsBox();
        if (!box) return;
        var byAttr = {};
        box.querySelectorAll('.tm-matrix-val').forEach(function (cb) {
            var attr = cb.getAttribute('data-attr');
            if (!attr) return;
            if (!byAttr[attr]) byAttr[attr] = [];
            if (cb.checked && byAttr[attr].indexOf(cb.value) < 0) byAttr[attr].push(cb.value);
        });
        Object.keys(byAttr).forEach(function (k) {
            PM._variantMatrixSelection[k] = byAttr[k];
        });
    };

    PM.generateVariantCombos = function () {
        PM.syncVariantSelectionFromDom();
        PM.syncCustomAttrsToMatrix();
        PM.syncComboDraftFromDom();
        PM.rebuildVariantCombosFromSelection();
        PM.renderVariantComboTable();
    };

    PM.rebuildVariantCombosFromSelection = function () {
        PM.syncCustomAttrsToMatrix();
        PM.syncComboDraftFromDom();
        var sel = PM._variantMatrixSelection || {};
        var dimKeys = Object.keys(sel).filter(function (k) { return sel[k] && sel[k].length; });
        var estimated = 1;
        for (var di = 0; di < dimKeys.length; di++) {
            estimated *= sel[dimKeys[di]].length;
            if (estimated > MAX_VARIANT_COMBOS) break;
        }
        if (estimated > MAX_VARIANT_COMBOS) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(
                    '规格组合过多（' + estimated + '），请检查是否有重复规格名或未完成的输入',
                    'warning'
                );
            }
            return;
        }
        var combos = cartesianFromSelection(sel);
        var oldMap = {};
        (PM._variantComboDraft || []).forEach(function (row) {
            if (row && row.attrs) {
                var k = comboKey(row.attrs);
                if (!oldMap[k]) oldMap[k] = row;
            }
        });
        PM._variantComboDraft = combos.map(function (attrs) {
            var key = comboKey(attrs);
            var prev = oldMap[key];
            if (prev) {
                return cloneComboRow(prev, attrs, key);
            }
            return {
                key: key,
                attrs: attrs,
                enabled: true,
                stock: 0,
                warehouseStocks: {},
                coverUrl: null,
                coverPreview: null,
                imageFile: null,
                skuId: null,
                priceOverride: null
            };
        });
    };

    PM.renderVariantComboTable = function () {
        PM.syncComboDraftFromDom();
        var tbody = document.getElementById('tm-variant-combo-tbody');
        var thead = document.getElementById('tm-variant-combo-head');
        if (!tbody) return;
        var whs = PM.warehouses || [];
        if (thead) {
            thead.innerHTML = '<th class="px-3 py-2 min-w-[8rem]">规格组合</th>'
                + '<th class="px-2 py-2 text-center w-14">图</th>'
                + '<th class="px-2 py-2 text-right whitespace-nowrap w-20">售价</th>'
                + whs.map(function (w) {
                    return '<th class="px-2 py-2 text-right whitespace-nowrap">' + PM.escHtmlText(w.name || w.warehouseName || '仓') + '</th>';
                }).join('')
                + '<th class="px-2 py-2 text-right">合计</th><th class="px-2 py-2 w-10"></th>';
        }
        var spuDefault = getSpuDefaultPrice();
        var spuPh = spuDefault > 0 ? String(spuDefault) : 'SPU价';
        var rows = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; });
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="' + (5 + whs.length) + '" class="px-3 py-8 text-center text-slate-400 text-xs">请在上方勾选规格取值，点击「生成组合」或勾选后自动生成</td></tr>';
            PM.updateVariantComboSummary();
            return;
        }
        tbody.innerHTML = rows.map(function (row) {
            var rowKey = comboKey(row.attrs);
            var keyAttr = PM.escHtmlAttr(rowKey);
            var label = Object.keys(row.attrs).map(function (k) {
                return k + '：' + row.attrs[k];
            }).join(' · ');
            var imgSrc = row.coverPreview || row.coverUrl || '';
            var imgCell = '<td class="px-2 py-2 text-center">'
                + '<label class="tm-variant-img-btn relative inline-flex w-10 h-10 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 overflow-hidden cursor-pointer hover:border-brand-300" title="上传 SKU 图片（限1张）">'
                + (imgSrc
                    ? ('<img src="' + imgSrc.replace(/"/g, '&quot;') + '" class="w-full h-full object-cover" alt="" />')
                    : '<i class="ph ph-camera text-slate-400 text-lg"></i>')
                + '<input type="file" accept="image/*" class="hidden tm-variant-img-input" data-combo-key="' + keyAttr + '" />'
                + '</label></td>';
            var priceVal = row.priceOverride != null && row.priceOverride !== '' ? String(row.priceOverride) : '';
            var priceCell = '<td class="px-2 py-2"><input type="number" min="0" step="0.01" class="tm-variant-row-price form-input w-20 text-xs font-mono text-right py-1" data-combo-key="' + keyAttr + '" value="' + PM.escHtmlAttr(priceVal) + '" placeholder="' + PM.escHtmlAttr(spuPh) + '" title="留空则使用 SPU 销售价 ' + PM.escHtmlAttr(spuPh) + '" /></td>';
            var whCells = whs.map(function (w) {
                var wid = w.id != null ? w.id : w.warehouseId;
                var v = whStockLookup(row.warehouseStocks, wid);
                return '<td class="px-2 py-2"><input type="number" min="0" step="1" class="tm-variant-wh-qty form-input w-16 text-xs font-mono text-right py-1" data-combo-key="' + keyAttr + '" data-wh="' + wid + '" value="' + v + '" /></td>';
            }).join('');
            return '<tr class="tm-variant-combo-row border-b border-slate-50 hover:bg-slate-50/80" data-combo-key="' + keyAttr + '">'
                + '<td class="px-3 py-2 text-xs text-slate-700 font-medium max-w-[10rem]">' + PM.escHtmlText(label) + '</td>'
                + imgCell
                + priceCell
                + whCells
                + '<td class="px-2 py-2"><input type="number" min="0" step="1" class="tm-variant-row-stock form-input w-16 text-xs font-mono text-right py-1" data-combo-key="' + keyAttr + '" value="' + (row.stock || 0) + '" /></td>'
                + '<td class="px-2 py-2 text-center"><button type="button" class="tm-variant-row-del text-red-400 hover:text-red-600 p-1" data-combo-key="' + keyAttr + '" title="移除此组合"><i class="ph ph-trash text-sm"></i></button></td>'
                + '</tr>';
        }).join('');
        tbody.querySelectorAll('.tm-variant-img-input').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var file = inp.files && inp.files[0];
                PM.onVariantComboImageSelect(inp.getAttribute('data-combo-key'), file);
            });
        });
        tbody.querySelectorAll('.tm-variant-wh-qty').forEach(function (inp) {
            inp.addEventListener('input', function () {
                PM.onVariantComboWhChange(inp.getAttribute('data-combo-key'), parseInt(inp.getAttribute('data-wh'), 10), inp.value);
            });
        });
        tbody.querySelectorAll('.tm-variant-row-stock').forEach(function (inp) {
            inp.addEventListener('input', function () {
                PM.onVariantComboStockChange(inp.getAttribute('data-combo-key'), inp.value);
            });
        });
        tbody.querySelectorAll('.tm-variant-row-price').forEach(function (inp) {
            inp.addEventListener('input', function () {
                PM.onVariantComboPriceChange(inp.getAttribute('data-combo-key'), inp.value);
            });
        });
        tbody.querySelectorAll('.tm-variant-row-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                PM.removeVariantComboRow(btn.getAttribute('data-combo-key'));
            });
        });
        PM.updateVariantComboSummary();
    };

    PM.onVariantComboImageSelect = async function (comboKeyVal, file) {
        PM.syncComboDraftFromDom();
        var row = findDraftRowByComboKey(comboKeyVal);
        if (!row) return;
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('单张图片不超过 5MB', 'warning');
            }
            return;
        }
        row.imageFile = file;
        if (row.coverPreview && row.coverPreview.indexOf('blob:') === 0) {
            try { URL.revokeObjectURL(row.coverPreview); } catch (e) { /* ignore */ }
        }
        row.coverPreview = URL.createObjectURL(file);
        var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        if (row.skuId && spuId && window.wrappedFetch) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('spuId', String(spuId));
            fd.append('skuId', String(row.skuId));
            fd.append('mediaType', 'COVER');
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/products/media/upload', { method: 'POST', body: fd });
                var body = await resp.json().catch(function () { return {}; });
                if (resp.ok && body && body.success !== false && body.data) {
                    row.coverUrl = body.data.url || row.coverPreview;
                    row.imageFile = null;
                    if (typeof PM.syncSkuCoversFromVariantDraft === 'function') {
                        PM.syncSkuCoversFromVariantDraft();
                    }
                    if (typeof PM.renderMediaGrid === 'function') {
                        PM.renderMediaGrid();
                    }
                    if (window.TM_UI && window.TM_UI.showNotification) {
                        window.TM_UI.showNotification('SKU 图片已上传', 'success');
                    }
                }
            } catch (e) { /* 保存后统一上传 */ }
        }
        PM.renderVariantComboTable();
    };

    PM.uploadPendingSkuMedia = async function (spuId) {
        var pending = (PM._variantComboDraft || []).filter(function (r) {
            return r.enabled !== false && r.imageFile;
        });
        if (!spuId || !pending.length || !window.wrappedFetch) return true;
        var errors = [];
        var skuMap = {};
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/spu/' + spuId, { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var detail = data && data.data ? data.data : data;
            var skus = detail && detail.skus ? detail.skus : [];
            skus.forEach(function (sku) {
                var attrs = sku.attributes || {};
                if (typeof attrs === 'string') {
                    try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
                }
                var key = comboKey(attrs);
                if (key) skuMap[key] = sku.skuId || sku.sku_id;
            });
        } catch (e) {
            errors.push('加载 SKU 列表失败');
            PM._lastSkuMediaUploadErrors = errors;
            return false;
        }
        var allOk = true;
        for (var i = 0; i < pending.length; i++) {
            var row = pending[i];
            var sid = row.skuId || skuMap[comboKey(row.attrs)];
            if (!sid) {
                errors.push('未匹配到 SKU：' + Object.values(row.attrs || {}).join('/'));
                allOk = false;
                continue;
            }
            var fd = new FormData();
            fd.append('file', row.imageFile);
            fd.append('spuId', String(spuId));
            fd.append('skuId', String(sid));
            fd.append('mediaType', 'COVER');
            try {
                var upResp = await window.wrappedFetch('/api/v1/rd/products/media/upload', { method: 'POST', body: fd });
                var upBody = await upResp.json().catch(function () { return {}; });
                if (upResp.ok && upBody && upBody.success !== false) {
                    row.skuId = sid;
                    row.imageFile = null;
                    row.coverUrl = upBody.data && upBody.data.url ? upBody.data.url : row.coverUrl;
                } else {
                    allOk = false;
                    errors.push((upBody && upBody.message) || 'SKU 图片上传失败');
                }
            } catch (err) {
                allOk = false;
                errors.push(err && err.message ? err.message : 'SKU 图片上传失败');
            }
        }
        PM._lastSkuMediaUploadErrors = errors;
        return allOk;
    };

    PM.onVariantComboWhChange = function (comboKeyVal, whId, val) {
        var row = findDraftRowByComboKey(comboKeyVal);
        if (!row) return;
        row.warehouseStocks = row.warehouseStocks || {};
        row.warehouseStocks[whId] = Math.max(0, parseInt(val, 10) || 0);
        var sum = 0;
        Object.keys(row.warehouseStocks).forEach(function (k) {
            sum += Math.max(0, parseInt(row.warehouseStocks[k], 10) || 0);
        });
        row.stock = sum;
        var stockInp = findComboDomInput('tm-variant-row-stock', comboKeyVal);
        if (stockInp) stockInp.value = String(sum);
        PM.updateVariantComboSummary();
    };

    PM.onVariantComboStockChange = function (comboKeyVal, val) {
        var row = findDraftRowByComboKey(comboKeyVal);
        if (!row) return;
        var qty = Math.max(0, parseInt(val, 10) || 0);
        row.stock = qty;
        var whs = PM.warehouses || [];
        if (whs.length === 1) {
            var wid = whs[0].id != null ? whs[0].id : whs[0].warehouseId;
            row.warehouseStocks = row.warehouseStocks || {};
            row.warehouseStocks[wid] = qty;
            var whInp = findComboDomInput('tm-variant-wh-qty', comboKeyVal, wid);
            if (whInp) whInp.value = String(qty);
        }
        PM.updateVariantComboSummary();
    };

    PM.onVariantComboPriceChange = function (comboKeyVal, val) {
        var row = findDraftRowByComboKey(comboKeyVal);
        if (!row) return;
        row.priceOverride = normalizeComboPriceOverride(val, getSpuDefaultPrice());
    };

    PM.removeVariantComboRow = function (comboKeyVal) {
        var row = findDraftRowByComboKey(comboKeyVal);
        if (!row) return;
        row.enabled = false;
        PM.renderVariantComboTable();
    };

    PM.updateVariantComboSummary = function () {
        var el = document.getElementById('tm-variant-combo-summary');
        if (!el) return;
        var active = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; });
        var totalStock = active.reduce(function (s, r) { return s + (parseInt(r.stock, 10) || 0); }, 0);
        el.textContent = active.length ? ('共 ' + active.length + ' 个有效组合 · 合计库存 ' + totalStock + ' ' + (PM.getBaseUnitLabel ? PM.getBaseUnitLabel() : '件')) : '';
    };

    PM.syncVariantStockToMainForm = function () {
        var active = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; });
        var totalStock = active.reduce(function (s, r) { return s + (parseInt(r.stock, 10) || 0); }, 0);
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        if (stockInput) {
            PM._stockSyncLock = true;
            stockInput.value = String(totalStock);
            PM._stockSyncLock = false;
        }
        var whAgg = {};
        active.forEach(function (row) {
            var ws = row.warehouseStocks || {};
            Object.keys(ws).forEach(function (wid) {
                whAgg[wid] = (whAgg[wid] || 0) + (parseInt(ws[wid], 10) || 0);
            });
        });
        PM.getWarehouseStockInputs().forEach(function (inp) {
            var wid = inp.getAttribute('data-warehouse-id');
            if (wid && whAgg[wid] != null) {
                inp.value = String(whAgg[wid]);
            }
        });
        PM._variantMatrixConfirmed = active.length > 0;
        PM.updateVariantEntrySummary();
    };

    PM.updateVariantEntrySummary = function () {
        var el = PM.el('detail-variant-entry-summary');
        if (!el) return;
        var tv = PM.el('detail-track-variants');
        var capSv = document.getElementById('cap-summary-variants');
        if (!tv || !tv.checked) {
            el.textContent = '未启用多规格';
            if (capSv) capSv.textContent = '未启用规格';
            return;
        }
        if (!PM._variantMatrixConfirmed) {
            el.textContent = '已启用，点击「编辑」配置规格';
            if (capSv) capSv.textContent = '已启用多规格';
            return;
        }
        var active = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; });
        var total = active.reduce(function (s, r) { return s + (parseInt(r.stock, 10) || 0); }, 0);
        var txt = '已配置 ' + active.length + ' 个规格组合 · 合计库存 ' + total;
        el.textContent = txt;
        if (capSv) capSv.textContent = '已启用多规格';
    };

    PM.toggleVariantComboExpanded = function (expand) {
        var modal = document.getElementById('product-variant-modal');
        var panel = modal && modal.querySelector('.tm-variant-modal__panel');
        var btn = document.getElementById('tm-variant-combo-expand-btn');
        if (!modal || !panel) return;
        var on = expand != null ? !!expand : !panel.classList.contains('tm-variant-modal--combo-expanded');
        panel.classList.toggle('tm-variant-modal--combo-expanded', on);
        if (btn) {
            btn.classList.toggle('is-expanded', on);
            btn.title = on ? '恢复默认布局' : '展开编辑区域';
            btn.setAttribute('aria-label', on ? '恢复默认布局' : '展开 SKU 编辑区域');
        }
    };

    PM.bindVariantComboExpandBtn = function () {
        var btn = document.getElementById('tm-variant-combo-expand-btn');
        if (!btn || btn.__tmExpandBound) return;
        btn.__tmExpandBound = true;
        btn.addEventListener('click', function () {
            PM.toggleVariantComboExpanded();
        });
    };

    PM.splitVariantSelectionByTemplate = function (templateNames) {
        templateNames = templateNames || {};
        var customRows = PM._customAttrRows || [];
        Object.keys(PM._variantMatrixSelection || {}).forEach(function (k) {
            if (templateNames[k]) return;
            var vals = PM._variantMatrixSelection[k] || [];
            if (!vals.length) {
                delete PM._variantMatrixSelection[k];
                return;
            }
            var row = customRows.find(function (r) { return r.name === k; });
            if (!row) {
                customRows.push({ name: k, values: vals.slice(), asCommon: false });
            } else {
                vals.forEach(function (v) {
                    if (row.values.indexOf(v) < 0) row.values.push(v);
                });
            }
            delete PM._variantMatrixSelection[k];
        });
        PM._customAttrRows = customRows;
    };

    PM.rebuildVariantSelectionFromComboDraft = function () {
        var sel = {};
        (PM._variantComboDraft || []).forEach(function (row) {
            if (!row || row.enabled === false || !row.attrs) return;
            Object.keys(row.attrs).forEach(function (k) {
                if (!sel[k]) sel[k] = [];
                var v = String(row.attrs[k]);
                if (sel[k].indexOf(v) < 0) sel[k].push(v);
            });
        });
        if (Object.keys(sel).length) {
            PM._variantMatrixSelection = sel;
        }
    };

    PM.rebuildCustomAttrRowsFromComboDraft = function () {
        var templateNames = PM.getTemplateMatrixAttrNames ? PM.getTemplateMatrixAttrNames() : {};
        var sel = PM._variantMatrixSelection || {};
        var customRows = [];
        Object.keys(sel).forEach(function (k) {
            if (templateNames[k]) return;
            if (sel[k] && sel[k].length) {
                customRows.push({ name: k, values: sel[k].slice(), asCommon: false });
            }
        });
        PM._customAttrRows = customRows;
        Object.keys(sel).forEach(function (k) {
            if (!templateNames[k]) {
                delete PM._variantMatrixSelection[k];
            }
        });
    };

    PM.renderVariantModalTemplateChecks = function () {
        var box = document.getElementById('tm-variant-modal-template-attrs');
        if (!box || !box.innerHTML) box = PM.el('detail-variant-matrix');
        if (!box || !box.innerHTML) return;
        var sel = PM._variantMatrixSelection || {};
        box.querySelectorAll('.tm-matrix-val').forEach(function (cb) {
            var attr = cb.getAttribute('data-attr');
            var val = cb.value;
            cb.checked = !!(sel[attr] && sel[attr].some(function (sv) { return String(sv) === String(val); }));
            if (!cb.__tmVarBound) {
                cb.__tmVarBound = true;
                cb.addEventListener('change', function () {
                    PM.syncVariantSelectionFromDom();
                    PM.syncCustomAttrsToMatrix();
                    PM.generateVariantCombos();
                    PM.renderVariantComboTable();
                });
            }
        });
    };

    PM.loadVariantDraftFromSpu = async function (spuId, opts) {
        opts = opts || {};
        if (!spuId) return false;
        var session = opts.session;
        if (PM._variantDraftSpuId != null && String(PM._variantDraftSpuId) !== String(spuId)) {
            PM._variantComboDraft = [];
            PM._variantMatrixConfirmed = false;
            PM._variantMatrixSelection = {};
            PM._customAttrRows = [];
        }
        if (!opts.force && PM._variantDraftSpuId === spuId && PM._variantComboDraft && PM._variantComboDraft.length) {
            return true;
        }
        try {
            var detail = opts.cachedDetail;
            if (!detail && window.TM_MasterDataCache) {
                detail = await window.TM_MasterDataCache.getSpuDetail(spuId, null, !!opts.force);
            }
            if (!detail && window.wrappedFetch) {
                var resp = await window.wrappedFetch('/api/v1/rd/products/spu/' + spuId, { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                detail = data && data.data ? data.data : data;
            }
            if (!detail || !detail.skus || !detail.skus.length) {
                if (PM.shouldApplyProductDetailLoad && !PM.shouldApplyProductDetailLoad(session, spuId)) {
                    return false;
                }
                PM._variantComboDraft = [];
                PM._variantDraftSpuId = null;
                PM._variantMatrixConfirmed = false;
                return false;
            }
            if (PM.shouldApplyProductDetailLoad && !PM.shouldApplyProductDetailLoad(session, spuId)) {
                return false;
            }
            var skus = detail.skus;
            var variantSkus = skus.filter(function (s) {
                var attrs = s.attributes || {};
                if (typeof attrs === 'string') {
                    try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
                }
                var disp = s.attributesDisplay || s.attributes_display || '';
                return Object.keys(attrs).length > 0 || (disp && String(disp).trim().length > 0);
            });
            if (variantSkus.length <= 1 && skus.length <= 1) {
                if (PM.shouldApplyProductDetailLoad && !PM.shouldApplyProductDetailLoad(session, spuId)) {
                    return false;
                }
                return false;
            }
            if (!variantSkus.length && skus.length > 1) {
                variantSkus = skus.slice();
            }
            if (!variantSkus.length) {
                if (PM.shouldApplyProductDetailLoad && !PM.shouldApplyProductDetailLoad(session, spuId)) {
                    return false;
                }
                return false;
            }

            PM._variantMatrixSelection = {};
            PM._customAttrRows = [];
            var templateAttrNames = {};
            var tplSel = PM.el('detail-variant-template');
            if (tplSel && tplSel.value) {
                try {
                    var tplId = tplSel.value;
                    var tDetail = null;
                    if (window.TM_MasterDataCache && window.TM_MasterDataCache.getTemplateDetail) {
                        tDetail = await window.TM_MasterDataCache.getTemplateDetail(tplId, { spuId: spuId });
                    } else if (!opts.skipTemplateFetch && window.wrappedFetch) {
                        var tResp = await window.wrappedFetch('/api/v1/rd/products/attribute-templates/' + tplId + '?spuId=' + encodeURIComponent(spuId), { method: 'GET' });
                        var tData = await window.handleApiResponse(tResp);
                        tDetail = tData && tData.data ? tData.data : tData;
                    }
                    if (tDetail) {
                        (tDetail.definitions || []).forEach(function (d) {
                            if (d.name) templateAttrNames[d.name] = true;
                        });
                    }
                } catch (e) { /* ignore */ }
            }
            if (PM.shouldApplyProductDetailLoad && !PM.shouldApplyProductDetailLoad(session, spuId)) {
                return false;
            }

            variantSkus.forEach(function (sku) {
                var attrs = sku.attributes || {};
                if (typeof attrs === 'string') {
                    try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
                }
                Object.keys(attrs).forEach(function (k) {
                    var v = String(attrs[k]);
                    if (!templateAttrNames[k]) {
                        var row = PM._customAttrRows.find(function (r) { return r.name === k; });
                        if (!row) {
                            PM._customAttrRows.push({ name: k, values: [v], asCommon: false });
                        } else if (row.values.indexOf(v) < 0) {
                            row.values.push(v);
                        }
                        return;
                    }
                    if (!PM._variantMatrixSelection[k]) PM._variantMatrixSelection[k] = [];
                    if (PM._variantMatrixSelection[k].indexOf(v) < 0) PM._variantMatrixSelection[k].push(v);
                });
            });

            if (PM.shouldApplyProductDetailLoad && !PM.shouldApplyProductDetailLoad(session, spuId)) {
                return false;
            }
            PM._variantComboDraft = variantSkus.map(function (sku) {
                var attrs = sku.attributes || {};
                if (typeof attrs === 'string') {
                    try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
                }
                var whRaw = sku.warehouseStocks || sku.warehouse_stocks || {};
                var whStocks = {};
                if (whRaw && typeof whRaw === 'object') {
                    Object.keys(whRaw).forEach(function (k) {
                        var nk = /^\d+$/.test(String(k)) ? parseInt(k, 10) : k;
                        whStocks[nk] = parseInt(whRaw[k], 10) || 0;
                    });
                }
                var stock = parseInt(sku.stock, 10) || 0;
                if (!stock) {
                    Object.keys(whStocks).forEach(function (k) { stock += whStocks[k] || 0; });
                }
                var cover = sku.coverUrl || sku.cover_url || null;
                var skuPrice = sku.price != null ? Number(sku.price) : null;
                var spuDefault = getSpuDefaultPrice();
                var priceOverride = null;
                if (skuPrice != null && !isNaN(skuPrice) && skuPrice >= 0) {
                    if (spuDefault <= 0 || Math.abs(skuPrice - spuDefault) >= 0.001) {
                        priceOverride = skuPrice;
                    }
                }
                return {
                    key: comboKey(attrs),
                    attrs: attrs,
                    enabled: true,
                    stock: stock,
                    warehouseStocks: whStocks,
                    coverUrl: cover,
                    coverPreview: cover,
                    imageFile: null,
                    skuId: sku.skuId || sku.sku_id,
                    priceOverride: priceOverride
                };
            });
            PM.rebuildVariantSelectionFromComboDraft();
            PM.splitVariantSelectionByTemplate(templateAttrNames);
            PM.rebuildCustomAttrRowsFromComboDraft();
            PM._variantMatrixConfirmed = PM._variantComboDraft.length > 0;
            PM._variantDraftSpuId = spuId;
            PM.renderCustomAttrRows();
            PM.updateVariantEntrySummary();
            return PM._variantComboDraft.length > 0;
        } catch (e) {
            console.warn('[VariantModal] 加载已有规格失败', e);
            return false;
        }
    };

    PM.openVariantMatrixModal = async function () {
        PM.toggleVariantComboExpanded(false);
        var modal = document.getElementById('product-variant-modal');
        if (!modal) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('规格弹窗未加载，请刷新页面后重试', 'warning');
            }
            return;
        }
        var tv = PM.el('detail-track-variants');
        if (tv && !tv.checked) {
            tv.checked = true;
            if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
        }
        PM.syncVariantMatrixPanelVisibility();
        if (!PM.warehouses || !PM.warehouses.length) {
            await PM.loadWarehouses();
        }
        if (typeof PM.loadAttributeTemplates === 'function') {
            await PM.loadAttributeTemplates();
        }
        var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        var draftLoaded = false;
        var hasConfirmedLocalDraft = spuId && PM._variantDraftSpuId === spuId
            && PM._variantMatrixConfirmed && PM._variantComboDraft && PM._variantComboDraft.length;
        if (spuId && typeof PM.loadVariantDraftFromSpu === 'function') {
            if (!hasConfirmedLocalDraft) {
                draftLoaded = await PM.loadVariantDraftFromSpu(spuId, { force: true });
            } else {
                draftLoaded = true;
            }
        }
        var hasComboDraft = PM._variantComboDraft && PM._variantComboDraft.length;
        if (hasComboDraft) {
            PM.rebuildVariantSelectionFromComboDraft();
        }
        var tplSel = PM.el('detail-variant-template');
        var modalTpl = document.getElementById('tm-variant-modal-template');
        if (tplSel && modalTpl) {
            modalTpl.innerHTML = tplSel.innerHTML;
            if (!tplSel.value && PM._defaultAttributeTemplateId) {
                var defEffective = PM.resolveEffectiveTemplateId
                    ? PM.resolveEffectiveTemplateId(PM._defaultAttributeTemplateId)
                    : PM._defaultAttributeTemplateId;
                tplSel.value = String(defEffective);
            }
            if (tplSel.value && PM.resolveEffectiveTemplateId) {
                var eff = PM.resolveEffectiveTemplateId(tplSel.value);
                if (eff) tplSel.value = String(eff);
            }
            modalTpl.value = tplSel.value;
        }
        if (typeof PM.updateActiveTemplateNameLabel === 'function') {
            PM.updateActiveTemplateNameLabel();
        }
        if (tplSel && tplSel.value) {
            await PM.loadVariantMatrixFromTemplate(tplSel.value, { preserve: hasComboDraft || draftLoaded });
        }
        if (hasComboDraft) {
            PM.rebuildVariantSelectionFromComboDraft();
            PM.rebuildCustomAttrRowsFromComboDraft();
        }
        PM.renderVariantModalTemplateIntoModal();
        PM.renderCustomAttrRowsInModal();
        if (hasComboDraft || draftLoaded) {
            PM.renderVariantComboTable();
        } else {
            PM.generateVariantCombos();
        }
        PM.bindVariantComboExpandBtn();
        var genBtn = document.getElementById('tm-variant-generate-btn');
        if (genBtn && !genBtn.__tmBound) {
            genBtn.__tmBound = true;
            genBtn.addEventListener('click', function () {
                PM.generateVariantCombos();
                if (window.TM_UI && window.TM_UI.showNotification) {
                    var n = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; }).length;
                    window.TM_UI.showNotification(n ? ('已生成 ' + n + ' 个 SKU 组合') : '请先勾选规格取值', n ? 'success' : 'warning');
                }
            });
        }
        if (typeof window.TM_openUnifiedModal === 'function') {
            window.TM_openUnifiedModal(modal, { variant: 'sheet' });
        } else {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
    };

    PM.renderVariantModalTemplateIntoModal = function () {
        var src = PM.el('detail-variant-matrix');
        var dst = document.getElementById('tm-variant-modal-template-attrs');
        if (src && dst) {
            dst.innerHTML = src.innerHTML;
            PM.renderVariantModalTemplateChecks();
        }
    };

    PM.bindCustomAttrRowEventsInModal = function (list) {
        if (!list) return;
        list.querySelectorAll('.tm-custom-attr-name, .tm-custom-attr-values').forEach(function (inp) {
            inp.addEventListener('input', function () {
                PM.syncCustomAttrsToMatrix();
                debouncedGenerateVariantCombos();
            });
            inp.addEventListener('compositionend', function () {
                PM.syncCustomAttrsToMatrix();
                debouncedGenerateVariantCombos();
            });
        });
        list.querySelectorAll('.tm-custom-attr-common').forEach(function (cb) {
            cb.addEventListener('change', function () {
                PM.syncCustomAttrRowsFromDom(list);
                PM.syncCustomAttrsToMatrix();
            });
        });
        list.querySelectorAll('.tm-custom-attr-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                PM.syncCustomAttrRowsFromDom(list);
                var i = parseInt(btn.getAttribute('data-idx'), 10);
                if (!isNaN(i)) {
                    PM._customAttrRows.splice(i, 1);
                    PM.renderCustomAttrRowsInModal({ fromMemory: true });
                    PM.syncCustomAttrsToMatrix();
                    PM.generateVariantCombos();
                }
            });
        });
    };

    PM.renderCustomAttrRowsInModal = function (opts) {
        opts = opts || {};
        var list = document.getElementById('tm-variant-modal-custom-list');
        if (!list) return;
        if (!opts.fromMemory && list.querySelector('.tm-custom-attr-row')) {
            PM.syncCustomAttrRowsFromDom(list);
        }
        PM.renderCustomAttrRows();
        var srcList = PM.el('detail-custom-attrs-list');
        if (srcList) list.innerHTML = srcList.innerHTML;
        PM.bindCustomAttrRowEventsInModal(list);
        var addBtn = document.getElementById('tm-variant-modal-add-custom');
        if (addBtn && !addBtn.__tmBound) {
            addBtn.__tmBound = true;
            addBtn.addEventListener('click', function () {
                PM.syncCustomAttrRowsFromDom(list);
                PM._customAttrRows.push({ name: '', values: [], asCommon: false });
                PM.renderCustomAttrRowsInModal({ fromMemory: true });
            });
        }
    };

    PM.closeVariantMatrixModal = function () {
        PM.toggleVariantComboExpanded(false);
        var modal = document.getElementById('product-variant-modal');
        if (!modal) return;
        if (typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else {
            modal.classList.add('hidden');
        }
    };

    PM.confirmVariantMatrixModal = function () {
        PM.syncComboDraftFromDom();
        PM.syncCustomAttrRowsFromDom();
        var active = getEnabledDraftRows();
        if (!active.length) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请至少保留一个规格组合', 'warning');
            }
            return;
        }
        PM.syncVariantStockToMainForm();
        PM._variantMatrixConfirmed = true;
        PM.updateVariantEntrySummary();
        if (typeof PM.syncSkuCoversFromVariantDraft === 'function') {
            PM.syncSkuCoversFromVariantDraft();
        }
        if (typeof PM.renderMediaGrid === 'function') {
            PM.renderMediaGrid();
        }
        PM.closeVariantMatrixModal();
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification('规格属性已确认，库存已同步', 'success');
        }
    };

    var _buildVariantMatrixPayload = PM.buildVariantMatrixPayload;
    PM.buildVariantMatrixPayload = function () {
        var tv = PM.el('detail-track-variants');
        if (!tv || !tv.checked) return null;
        if (!PM._variantMatrixConfirmed) {
            return _buildVariantMatrixPayload ? _buildVariantMatrixPayload.call(PM) : null;
        }
        PM.syncComboDraftFromDom();
        PM.syncCustomAttrRowsFromDom();
        PM.syncCustomAttrsToMatrix();
        var tplSel = PM.el('detail-variant-template');
        var templateId = tplSel && tplSel.value ? parseInt(tplSel.value, 10) : null;
        var selected = PM._variantMatrixSelection || {};
        var filtered = {};
        Object.keys(selected).forEach(function (k) {
            if (selected[k] && selected[k].length) filtered[k] = selected[k].slice();
        });
        if (!Object.keys(filtered).length) return null;
        var whs = PM.warehouses || [];
        var spuDefault = getSpuDefaultPrice();
        var skuCombos = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; }).map(function (row) {
            var whItems = [];
            whs.forEach(function (w) {
                var wid = w.id != null ? w.id : w.warehouseId;
                var q = whStockLookup(row.warehouseStocks, wid);
                if (q > 0) {
                    whItems.push({ warehouseId: wid, quantity: q });
                }
            });
            var combo = {
                attributes: row.attrs,
                stock: parseInt(row.stock, 10) || 0,
                warehouseStocks: whItems,
                enabled: true
            };
            var price = row.priceOverride != null && row.priceOverride !== '' ? Number(row.priceOverride) : null;
            if (price != null && !isNaN(price) && price >= 0) {
                combo.price = price;
            }
            return combo;
        });
        return {
            templateId: templateId || null,
            selectedValues: filtered,
            skuCombos: skuCombos,
            defaultPrice: spuDefault > 0 ? spuDefault : null,
            customAttributePolicies: (PM._customAttrRows || []).filter(function (row) {
                return row.name && String(row.name).trim();
            }).map(function (row) {
                return {
                    name: String(row.name).trim(),
                    values: (row.values || []).slice(),
                    asCommon: false
                };
            })
        };
    };

    PM.updateVariantMatrixPreview = function () {
        PM.updateVariantEntrySummary();
        var preview = PM.el('detail-variant-matrix-preview');
        if (preview) {
            var active = (PM._variantComboDraft || []).filter(function (r) { return r.enabled !== false; });
            preview.textContent = active.length ? ('已配置 ' + active.length + ' 个组合（在弹窗中编辑）') : '';
        }
    };

    PM.syncVariantMatrixPanelVisibility = function () {
        var tv = PM.el('detail-track-variants');
        var openBtn = PM.el('detail-variant-open-btn');
        var panel = PM.el('product-variant-matrix-panel');
        if (panel) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
        }
        if (openBtn && tv) {
            var show = !!tv.checked;
            openBtn.classList.toggle('opacity-0', !show);
            openBtn.classList.toggle('pointer-events-none', !show);
            openBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
        if (typeof PM.updateVariantEntrySummary === 'function') {
            PM.updateVariantEntrySummary();
        }
    };

    PM.bindVariantModalTriggers = function () {
        var tv = PM.el('detail-track-variants');
        if (!tv || tv.dataset.tmVarModalBound === '1') return;
        tv.dataset.tmVarModalBound = '1';
        tv.addEventListener('change', function () {
            PM.syncVariantMatrixPanelVisibility();
            if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
            if (!tv.checked) {
                PM._variantMatrixConfirmed = false;
                PM._variantComboDraft = [];
                PM._variantDraftSpuId = null;
                PM.updateVariantEntrySummary();
            }
        });
    };

    window.openProductVariantModal = function () {
        if (PM.openVariantMatrixModal) PM.openVariantMatrixModal();
    };
    window.closeProductVariantModal = function () {
        if (PM.closeVariantMatrixModal) PM.closeVariantMatrixModal();
    };
    window.confirmProductVariantModal = function () {
        if (PM.confirmVariantMatrixModal) PM.confirmVariantMatrixModal();
    };
})();
