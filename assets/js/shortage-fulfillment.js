/**
 * 欠货履约工作台：待调货 / 待发货 / 待进货
 * 入口：工作台「进行中业务单据」旁
 */
(function (global) {
    'use strict';

    var LOGISTICS_BRANDS = ['顺丰', '中通', '圆通', '韵达', '申通', '极兔', '德邦', '自配送'];

    var state = {
        allTime: true,
        dateFrom: '',
        dateTo: '',
        warehouseId: '',
        tab: 'transfer',
        data: null,
        warehouses: [],
        suppliers: [],
        /** 未指定供应商组：本次转草稿时可选覆盖的供应商 ID（不改产品档案） */
        purchaseSupplierOverride: '',
        selected: {
            transfer: {},
            ship: {},
            purchase: {}
        }
    };

    function todayISO() {
        var d = new Date();
        var z = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function notify(msg, type) {
        if (global.TM_UI && typeof global.TM_UI.showNotification === 'function') {
            global.TM_UI.showNotification(msg, type || 'info');
        } else {
            console.log('[ShortageWorkbench]', type || 'info', msg);
        }
    }

    function $(id) {
        return document.getElementById(id);
    }

    function syncDateModeUi() {
        var allBtn = $('sf-date-all');
        var customBtn = $('sf-date-custom');
        var range = $('sf-date-range');
        if (allBtn) {
            allBtn.className = state.allTime
                ? 'flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-[11px] font-bold'
                : 'flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-bold hover:bg-slate-50';
        }
        if (customBtn) {
            customBtn.className = !state.allTime
                ? 'flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-[11px] font-bold'
                : 'flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-bold hover:bg-slate-50';
        }
        if (range) {
            range.classList.toggle('hidden', !!state.allTime);
        }
        var fromEl = $('sf-date-from');
        var toEl = $('sf-date-to');
        if (fromEl) fromEl.value = state.dateFrom || '';
        if (toEl) toEl.value = state.dateTo || '';
    }

    function readDateFilterFromUi() {
        var whEl = $('sf-warehouse');
        state.warehouseId = whEl && whEl.value ? whEl.value : '';
        if (state.allTime) {
            state.dateFrom = '';
            state.dateTo = '';
            return;
        }
        var fromEl = $('sf-date-from');
        var toEl = $('sf-date-to');
        state.dateFrom = fromEl && fromEl.value ? fromEl.value : '';
        state.dateTo = toEl && toEl.value ? toEl.value : '';
    }

    async function loadWarehouses() {
        try {
            var resp = await global.wrappedFetch('/api/v1/rd/products/warehouses', { method: 'GET' });
            var wrap = await global.handleApiResponse(resp);
            var list = (wrap && wrap.data) ? wrap.data : (Array.isArray(wrap) ? wrap : []);
            state.warehouses = (list || []).map(function (w) {
                return {
                    id: w.warehouseId != null ? w.warehouseId : w.id,
                    name: w.name || ('仓' + (w.warehouseId || w.id))
                };
            });
        } catch (e) {
            console.warn('[ShortageWorkbench] 仓库加载失败', e);
            state.warehouses = [];
        }
        var sel = $('sf-warehouse');
        if (!sel) return;
        var cur = state.warehouseId;
        sel.innerHTML = '<option value="">全部仓库</option>' + state.warehouses.map(function (w) {
            return '<option value="' + esc(w.id) + '"' + (String(cur) === String(w.id) ? ' selected' : '') + '>' + esc(w.name) + '</option>';
        }).join('');
    }

    async function loadSuppliers() {
        try {
            var resp = await global.wrappedFetch('/api/v1/supp/suppliers?all=true', { method: 'GET' });
            var wrap = await global.handleApiResponse(resp);
            var list = (wrap && wrap.data) ? wrap.data : (Array.isArray(wrap) ? wrap : []);
            if (list && !Array.isArray(list) && Array.isArray(list.list)) list = list.list;
            if (list && !Array.isArray(list) && Array.isArray(list.records)) list = list.records;
            state.suppliers = (list || []).map(function (s) {
                var id = s.supplierId != null ? s.supplierId : (s.supplier_id != null ? s.supplier_id : s.id);
                return {
                    id: id,
                    name: s.name || s.supplierName || ('供应商#' + id)
                };
            }).filter(function (s) { return s.id != null && s.id !== ''; });
        } catch (e) {
            console.warn('[ShortageWorkbench] 供应商加载失败', e);
            state.suppliers = [];
        }
    }

    function supplierOverrideSelectHtml(groupKey) {
        var cur = state.purchaseSupplierOverride || '';
        var opts = '<option value="">暂不指定（可稍后在进货单补填）</option>' +
            state.suppliers.map(function (s) {
                return '<option value="' + esc(s.id) + '"' +
                    (String(cur) === String(s.id) ? ' selected' : '') + '>' +
                    esc(s.name) + '</option>';
            }).join('');
        return '<div class="flex flex-wrap items-center gap-1.5 mb-2">' +
            '<label class="text-[10px] text-slate-500 whitespace-nowrap">本次进货供应商</label>' +
            '<select data-sf-supplier-override="' + esc(groupKey) + '" ' +
            'class="sf-compact-input form-input form-input--compact text-[11px] min-w-[8rem] max-w-full">' +
            opts + '</select>' +
            '</div>' +
            '<p class="text-[10px] text-slate-400 mb-1">小商户可无固定供应商：直接生成草稿即可，供应商非必填。</p>';
    }

    async function loadData() {
        readDateFilterFromUi();
        var qsParts = [];
        if (!state.allTime) {
            if (state.dateFrom) qsParts.push('dateFrom=' + encodeURIComponent(state.dateFrom));
            if (state.dateTo) qsParts.push('dateTo=' + encodeURIComponent(state.dateTo));
        }
        if (state.warehouseId) qsParts.push('warehouseId=' + encodeURIComponent(state.warehouseId));
        var qs = qsParts.length ? ('?' + qsParts.join('&')) : '';

        var body = $('sf-list-body');
        if (body) {
            body.innerHTML = '<div class="py-12 text-center text-slate-400 text-sm"><i class="ph ph-spinner animate-spin text-xl"></i><p class="mt-2">加载中…</p></div>';
        }
        try {
            var resp = await global.wrappedFetch('/api/v1/rd/orders/shortage-workbench' + qs, { method: 'GET' });
            var wrap = await global.handleApiResponse(resp);
            state.data = (wrap && wrap.data) ? wrap.data : null;
            if (state.data) {
                if (state.data.allTime === true) {
                    state.allTime = true;
                    state.dateFrom = '';
                    state.dateTo = '';
                } else if (state.data.dateFrom || state.data.dateTo) {
                    state.allTime = false;
                    state.dateFrom = state.data.dateFrom || '';
                    state.dateTo = state.data.dateTo || '';
                }
                syncDateModeUi();
                normalizePurchaseData(state.data);
            }
            state.selected = { transfer: {}, ship: {}, purchase: {} };
            renderTabs();
            renderList();
        } catch (e) {
            console.error('[ShortageWorkbench] 加载失败', e);
            if (body) {
                body.innerHTML = '<div class="py-12 text-center text-rose-500 text-sm">加载失败：' + esc(e.message || e) + '</div>';
            }
        }
    }

    function counts() {
        var c = (state.data && state.data.counts) ? state.data.counts : {};
        return {
            transfer: c.transfer || 0,
            ship: c.ship || 0,
            purchase: c.purchase || 0
        };
    }

    function renderTabs() {
        var c = counts();
        var map = {
            transfer: c.transfer,
            ship: c.ship,
            purchase: c.purchase
        };
        document.querySelectorAll('[data-sf-tab]').forEach(function (btn) {
            var tab = btn.getAttribute('data-sf-tab');
            var active = tab === state.tab;
            btn.className = active
                ? 'flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-brand-200 bg-brand-50 text-brand-700'
                : 'flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
            var badge = btn.querySelector('[data-sf-count]');
            if (badge) badge.textContent = String(map[tab] != null ? map[tab] : 0);
        });
        var actionHint = $('sf-action-hint');
        var actionBtn = $('sf-action-btn');
        var transferableBtn = $('sf-select-transferable');
        if (transferableBtn) {
            transferableBtn.classList.toggle('hidden', state.tab !== 'transfer');
        }
        if (state.tab === 'transfer') {
            if (actionHint) actionHint.textContent = '可改实际调货数（默认=欠货量，可多调备货）';
            if (actionBtn) actionBtn.textContent = '确认调货';
        } else if (state.tab === 'ship') {
            if (actionHint) actionHint.textContent = '勾选后批量确认发货；物流填品牌/单号，送车填司机/车牌';
            if (actionBtn) actionBtn.textContent = '确认发货';
        } else {
            if (actionHint) actionHint.textContent = '按供应商拆分生成进货草稿（无供应商亦可）';
            if (actionBtn) actionBtn.textContent = '转进货草稿';
        }
    }

    function currentLines() {
        if (!state.data) return [];
        if (state.tab === 'transfer') return state.data.transfer || [];
        if (state.tab === 'ship') return state.data.ship || [];
        return state.data.purchase || [];
    }

    function lineKey(line) {
        if (line && line.aggKey) return String(line.aggKey);
        return String(line.itemId != null ? line.itemId : line.item_id);
    }

    function lineSuggestQty(line) {
        if (line.shipQty != null) return Number(line.shipQty) || 0;
        if (line.suggestQty != null) return Number(line.suggestQty) || 0;
        return Number(line.shortageQty) || 0;
    }

    /** 待进货：基本单位缺口（聚合后） */
    function purchaseBaseNeed(line) {
        if (line.suggestBaseUnits != null) return Number(line.suggestBaseUnits) || 0;
        if (line.purchaseNeed != null) return Number(line.purchaseNeed) || 0;
        return Number(line.shortageQty) || 0;
    }

    /** 前端兜底：按进货单位换算比向上取整（后端已算好时直接用 suggestQty） */
    function purchaseSuggestQty(line) {
        if (line.suggestQty != null && line.aggKey) return Number(line.suggestQty) || 0;
        var base = purchaseBaseNeed(line);
        var ratio = Number(line.purchaseUnitRatio);
        if (!(ratio > 0)) ratio = 1;
        return Math.ceil(base / ratio) || 0;
    }

    /**
     * 若后端尚未返回 SKU 聚合行，前端按供应商+产品+SKU 聚合（建议量按换算比向上取整）。
     * 后端已聚合（含 aggKey）时直接使用。
     */
    function normalizePurchaseData(data) {
        if (!data) return;
        var raw = data.purchaseOrderLines || data.purchase || [];
        var alreadyAgg = Array.isArray(data.purchase) && data.purchase.length
            && data.purchase.every(function (l) { return !!l.aggKey; });
        if (alreadyAgg) {
            if (!data.purchaseGroups || !data.purchaseGroups.length) {
                data.purchaseGroups = groupPurchaseAggBySupplier(data.purchase);
            }
            if (data.counts) data.counts.purchase = data.purchase.length;
            return;
        }
        var agg = aggregatePurchaseLinesClient(raw);
        data.purchaseOrderLines = raw;
        data.purchase = agg;
        data.purchaseGroups = groupPurchaseAggBySupplier(agg);
        if (!data.counts) data.counts = {};
        data.counts.purchase = agg.length;
    }

    function aggregatePurchaseLinesClient(lines) {
        var map = {};
        var order = [];
        (lines || []).forEach(function (line) {
            var sid = line.supplierId != null ? line.supplierId : 'none';
            var pid = line.productId != null ? line.productId : 0;
            var sku = line.skuId != null ? line.skuId : (line.sku_id != null ? line.sku_id : 0);
            var key = 'agg:' + sid + ':' + pid + ':' + sku;
            if (!map[key]) {
                map[key] = {
                    aggKey: key,
                    supplierId: line.supplierId != null ? line.supplierId : null,
                    supplierName: line.supplierName || (line.supplierId != null ? ('供应商#' + line.supplierId) : '未指定供应商'),
                    productId: line.productId,
                    skuId: line.skuId != null ? line.skuId : line.sku_id,
                    spuId: line.spuId,
                    spuName: line.spuName || line.productName || '产品',
                    productName: line.productName,
                    skuSpec: line.skuSpec || line.sku_spec || '默认规格',
                    baseUnit: line.baseUnit || line.base_unit || '',
                    purchaseUnit: line.purchaseUnit || line.baseUnit || line.base_unit || '',
                    salePrice: line.salePrice,
                    purchasePrice: line.purchasePrice,
                    unitPrice: line.unitPrice,
                    purchaseUnitRatio: Number(line.purchaseUnitRatio) > 0 ? Number(line.purchaseUnitRatio) : 1,
                    suggestBaseUnits: 0,
                    purchaseNeed: 0,
                    shortageQty: 0,
                    transferableQty: 0,
                    partialGap: false,
                    sourceItemIds: [],
                    orderCount: 0
                };
                order.push(key);
            }
            var agg = map[key];
            var need = line.purchaseNeed != null ? Number(line.purchaseNeed)
                : (line.suggestQty != null ? Number(line.suggestQty) : (Number(line.shortageQty) || 0));
            if (!(need > 0)) need = 0;
            agg.suggestBaseUnits += need;
            agg.purchaseNeed += need;
            agg.shortageQty += Number(line.shortageQty) || need;
            agg.transferableQty += Number(line.transferableQty != null ? line.transferableQty
                : (line.maxOtherStock || 0)) || 0;
            agg.orderCount += 1;
            if (line.partialGap) agg.partialGap = true;
            if (Number(line.purchaseUnitRatio) > 0) agg.purchaseUnitRatio = Number(line.purchaseUnitRatio);
            var itemId = line.itemId != null ? line.itemId : line.item_id;
            if (itemId != null && agg.sourceItemIds.indexOf(itemId) < 0) {
                agg.sourceItemIds.push(itemId);
            }
        });
        return order.map(function (k) {
            var agg = map[k];
            var ratio = Number(agg.purchaseUnitRatio) > 0 ? Number(agg.purchaseUnitRatio) : 1;
            var suggestQty = Math.ceil(agg.suggestBaseUnits / ratio) || 0;
            if (suggestQty <= 0 && agg.suggestBaseUnits > 0) suggestQty = 1;
            agg.suggestQty = suggestQty;
            if (agg.sourceItemIds.length) agg.itemId = agg.sourceItemIds[0];
            return agg;
        });
    }

    function groupPurchaseAggBySupplier(aggLines) {
        var map = {};
        var order = [];
        (aggLines || []).forEach(function (line) {
            var sid = line.supplierId != null ? String(line.supplierId) : 'none';
            if (!map[sid]) {
                map[sid] = {
                    supplierId: line.supplierId != null ? line.supplierId : null,
                    supplierName: line.supplierName || '未指定供应商',
                    lines: []
                };
                order.push(sid);
            }
            map[sid].lines.push(line);
        });
        return order.map(function (sid) {
            var g = map[sid];
            g.lineCount = g.lines.length;
            return g;
        });
    }

    /** 部分可调双挂提示：可调 X / 需进 Y（需进为基本单位缺口） */
    function dualGapBadgeHtml(line) {
        var transferable = line.transferableQty != null ? Number(line.transferableQty)
            : (line.maxOtherStock != null ? Number(line.maxOtherStock) : 0);
        var shortage = Number(line.shortageQty) || 0;
        var isPartial = !!line.partialGap || (transferable > 0 && transferable < shortage);
        if (!isPartial) return '';
        var purchaseNeed = line.suggestBaseUnits != null ? Number(line.suggestBaseUnits)
            : (line.purchaseNeed != null ? Number(line.purchaseNeed)
                : Math.max(0, shortage - transferable));
        return '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">' +
            '可调 ' + esc(transferable) + ' / 需进 ' + esc(purchaseNeed) + '</span>';
    }

    function spuKeyOf(line) {
        if (line.spuId != null) return 'spu:' + line.spuId;
        if (line.productId != null) return 'p:' + line.productId;
        return 'name:' + (line.spuName || line.productName || 'unknown');
    }

    function skuKeyOf(line) {
        if (line.skuId != null) return 'sku:' + line.skuId;
        var spec = line.skuSpec || line.sku_spec || '';
        if (spec) return 'spec:' + spec;
        return 'none';
    }

    /** 扁平行 → SPU → SKU → 订单行 */
    function groupBySpuSku(lines) {
        var spuMap = {};
        var spuOrder = [];
        (lines || []).forEach(function (line) {
            var sk = spuKeyOf(line);
            if (!spuMap[sk]) {
                spuMap[sk] = {
                    key: sk,
                    spuId: line.spuId,
                    spuName: line.spuName || line.productName || '产品',
                    skus: {},
                    skuOrder: [],
                    lineCount: 0,
                    qtyTotal: 0
                };
                spuOrder.push(sk);
            }
            var spu = spuMap[sk];
            var kk = skuKeyOf(line);
            if (!spu.skus[kk]) {
                spu.skus[kk] = {
                    key: kk,
                    skuId: line.skuId,
                    skuSpec: line.skuSpec || line.sku_spec || '默认规格',
                    lines: [],
                    qtyTotal: 0
                };
                spu.skuOrder.push(kk);
            }
            var sku = spu.skus[kk];
            sku.lines.push(line);
            var q = lineSuggestQty(line);
            sku.qtyTotal += q;
            spu.qtyTotal += q;
            spu.lineCount += 1;
        });
        return spuOrder.map(function (sk) {
            var spu = spuMap[sk];
            spu.skuList = spu.skuOrder.map(function (kk) { return spu.skus[kk]; });
            return spu;
        });
    }

    function renderList() {
        var body = $('sf-list-body');
        if (!body) return;
        if (state.tab === 'purchase') {
            renderPurchaseGroups(body);
            return;
        }
        var lines = currentLines();
        if (!lines.length) {
            body.innerHTML = emptyHtml(state.tab);
            return;
        }
        if (state.tab === 'transfer') {
            var groups = groupBySpuSku(lines);
            body.innerHTML = groups.map(function (spu) {
                return transferSpuHtml(spu);
            }).join('');
        } else {
            body.innerHTML = groupShipByCustomer(lines).map(function (cust) {
                return shipCustomerHtml(cust);
            }).join('');
        }
        bindRowEvents(body);
        if (state.tab === 'ship') bindShipScanEvents(body);
    }

    function emptyHtml(tab) {
        var tip = tab === 'transfer' ? '暂无待调货欠货行'
            : (tab === 'ship' ? '暂无待发货明细' : '暂无待进货明细');
        return '<div class="py-14 text-center px-6">' +
            '<div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300"><i class="ph ph-package text-2xl"></i></div>' +
            '<p class="text-sm font-bold text-slate-600">' + tip + '</p>' +
            '<p class="text-xs text-slate-400 mt-1">换时间或仓库再试；欠货开单后会出现在此</p></div>';
    }

    function spuHeaderHtml(spu, tab) {
        var skuN = spu.skuList ? spu.skuList.length : 0;
        return '<div class="flex items-center gap-2 px-3 py-2.5 bg-slate-50/80 border-b border-slate-100">' +
            '<input type="checkbox" data-sf-spu-check="' + esc(spu.key) + '" class="rounded border-slate-300 text-brand-600 shrink-0" title="全选本产品">' +
            '<div class="min-w-0 flex-1">' +
            '<p class="text-sm font-bold text-slate-800 truncate">' + esc(spu.spuName) + '</p>' +
            '<p class="text-[10px] text-slate-400 mt-0.5">' + skuN + ' 个规格 · ' +
            (tab === 'ship' ? '待发' : '欠货') +
            '合计 <span class="font-mono font-bold text-rose-600">' + esc(spu.qtyTotal) + '</span></p>' +
            '</div></div>';
    }

    function transferLineControlsHtml(line) {
        var key = lineKey(line);
        var checked = state.selected.transfer[key] ? 'checked' : '';
        var suggest = lineSuggestQty(line);
        var avail = line.availableAtSource != null ? line.availableAtSource : 0;
        var opts = (line.sourceOptions || []).map(function (o) {
            var sel = String(o.warehouseId) === String(line.sourceWarehouseId) ? ' selected' : '';
            return '<option value="' + esc(o.warehouseId) + '"' + sel + ' data-avail="' + esc(o.available) + '">' +
                esc(o.warehouseName) + '（' + esc(o.available) + '）</option>';
        }).join('');
        var srcSelect = opts
            ? '<select data-sf-source="' + esc(key) + '" class="form-input form-input--compact text-[11px] py-1 w-full min-w-0" title="源仓库">' + opts + '</select>'
            : '<p class="text-[10px] text-rose-500 truncate">无可用源仓</p>';
        return '<div class="rounded-lg bg-white border border-slate-100 px-2.5 py-2" data-sf-row="' + esc(key) + '">' +
            '<div class="flex items-start gap-2">' +
            '<input type="checkbox" data-sf-check="' + esc(key) + '" data-sf-spu="' + esc(spuKeyOf(line)) + '" class="mt-1 rounded border-slate-300 text-brand-600 shrink-0" ' + checked + '>' +
            '<div class="min-w-0 flex-1 space-y-1.5">' +
            '<div class="flex flex-wrap items-center gap-1.5">' + dualGapBadgeHtml(line) + '</div>' +
            '<p class="text-[10px] text-slate-400 truncate leading-tight">' + esc(line.orderCode || '') +
            (line.customerName ? ' · ' + esc(line.customerName) : '') +
            ' · 目标 ' + esc(line.targetWarehouseName || '-') +
            ' · 欠货 <span class="font-mono font-bold text-rose-600">' + esc(line.shortageQty != null ? line.shortageQty : suggest) + '</span>' +
            (line.partialGap ? ' · 建议调 <span class="font-mono font-bold text-teal-700">' + esc(suggest) + '</span>' : '') +
            '</p>' +
            '<div class="flex items-center gap-1.5 flex-nowrap">' +
            '<div class="flex-1 min-w-0">' + srcSelect + '</div>' +
            '<div class="flex items-center gap-1 shrink-0">' +
            '<label class="text-[10px] text-slate-400 whitespace-nowrap">调货</label>' +
            '<input type="number" min="1" max="' + esc(Math.max(1, avail)) + '" value="' + esc(avail > 0 ? Math.min(suggest, avail) : suggest) + '" ' +
            'data-sf-qty="' + esc(key) + '" data-sf-suggest="' + esc(suggest) + '" class="sf-compact-input sf-compact-input--qty form-input form-input--compact text-xs font-mono text-center">' +
            '<span class="text-[10px] text-slate-400 whitespace-nowrap" data-sf-avail-label="' + esc(key) + '">/' + esc(avail) + '</span>' +
            '</div></div></div></div></div>';
    }

    function transferSpuHtml(spu) {
        var skuBlocks = spu.skuList.map(function (sku) {
            var linesHtml = sku.lines.map(function (line) {
                return transferLineControlsHtml(line);
            }).join('');
            return '<div class="px-3 py-2 border-t border-slate-50 first:border-0">' +
                '<div class="flex items-center justify-between gap-2 mb-1.5">' +
                '<p class="text-xs font-bold text-slate-700"><span class="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">' +
                esc(sku.skuSpec) + '</span></p>' +
                '<p class="text-[10px] text-slate-400 shrink-0">欠货 <span class="font-mono font-bold text-rose-600">' +
                esc(sku.qtyTotal) + '</span></p></div>' +
                '<div class="space-y-2">' + linesHtml + '</div></div>';
        }).join('');
        return '<div class="rounded-xl border border-slate-200 bg-white overflow-hidden mb-3" data-sf-spu="' + esc(spu.key) + '">' +
            spuHeaderHtml(spu, 'transfer') + skuBlocks + '</div>';
    }

    function fulfillmentTypeLabel(ft) {
        if (ft === 'LOGISTICS') return '物流';
        if (ft === 'DELIVERY_VEHICLE') return '送车';
        if (ft === 'DELIVERY_ADDRESS') return '送货上门';
        if (ft === 'SELF_PICKUP') return '自提';
        return ft || '';
    }

    function shipCustomerIdOf(line) {
        if (line.customerId != null && line.customerId !== '') return String(line.customerId);
        if (line.cust_id != null && line.cust_id !== '') return String(line.cust_id);
        return 'name:' + String(line.customerName || '未知客户');
    }

    function shipRecvFingerprint(line) {
        return [
            line.fulfillmentType || '',
            line.contactName || '',
            line.contactPhone || '',
            line.address || '',
            line.targetWarehouseId != null ? line.targetWarehouseId
                : (line.sourceWarehouseId != null ? line.sourceWarehouseId : '')
        ].join('|');
    }

    function shipMergeKey(line) {
        // DOM data-* / querySelector 安全键（避免引号与特殊字符打断选择器）
        return (shipCustomerIdOf(line) + '__' + (line.fulfillmentType || '') + '__' + shipRecvFingerprint(line))
            .replace(/["'\\<>]/g, '_')
            .replace(/\s+/g, ' ');
    }

    /** 客户 → 可合并发货组（同履约+同收货）→ 订单 → 产品行 */
    function groupShipByCustomer(lines) {
        var custMap = {};
        var custOrder = [];
        (lines || []).forEach(function (line) {
            var cid = shipCustomerIdOf(line);
            if (!custMap[cid]) {
                custMap[cid] = {
                    key: cid,
                    customerId: line.customerId != null ? line.customerId : line.cust_id,
                    customerName: line.customerName || '未知客户',
                    mergeMap: {},
                    mergeOrder: [],
                    qtyTotal: 0,
                    lineCount: 0
                };
                custOrder.push(cid);
            }
            var cust = custMap[cid];
            var mk = shipMergeKey(line);
            if (!cust.mergeMap[mk]) {
                cust.mergeMap[mk] = {
                    key: mk,
                    fulfillmentType: line.fulfillmentType || '',
                    contactName: line.contactName || '',
                    contactPhone: line.contactPhone || '',
                    address: line.address || '',
                    logisticsBrand: line.logisticsBrand || line.logisticsProvider || '',
                    trackingNo: line.trackingNo || '',
                    driverName: line.driverName || '',
                    vehiclePlate: line.vehiclePlate || '',
                    warehouseName: line.targetWarehouseName || line.sourceWarehouseName || '',
                    orderMap: {},
                    orderOrder: [],
                    lines: [],
                    qtyTotal: 0
                };
                cust.mergeOrder.push(mk);
            }
            var merge = cust.mergeMap[mk];
            merge.lines.push(line);
            var q = lineSuggestQty(line);
            merge.qtyTotal += q;
            cust.qtyTotal += q;
            cust.lineCount += 1;
            var oid = String(line.orderId != null ? line.orderId : (line.orderCode || ''));
            if (!merge.orderMap[oid]) {
                merge.orderMap[oid] = {
                    key: oid,
                    orderId: line.orderId,
                    orderCode: line.orderCode || ('订单' + oid),
                    lines: [],
                    qtyTotal: 0
                };
                merge.orderOrder.push(oid);
            }
            merge.orderMap[oid].lines.push(line);
            merge.orderMap[oid].qtyTotal += q;
        });
        return custOrder.map(function (cid) {
            var cust = custMap[cid];
            cust.mergeGroups = cust.mergeOrder.map(function (mk) {
                var mg = cust.mergeMap[mk];
                mg.orders = mg.orderOrder.map(function (oid) { return mg.orderMap[oid]; });
                return mg;
            });
            return cust;
        });
    }

    function shipRecvHtmlFromGroup(group) {
        var ft = group.fulfillmentType || '';
        var name = group.contactName || '';
        var phone = group.contactPhone || '';
        var addr = group.address || '';
        if (!name && !phone && !addr && !ft) return '';
        return '<p class="text-[10px] text-slate-500 mt-0.5 leading-snug">' +
            (ft ? '<span class="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-bold mr-1">' + esc(fulfillmentTypeLabel(ft)) + '</span>' : '') +
            (name ? esc(name) : '') +
            (phone ? ' · ' + esc(phone) : '') +
            (addr ? '<br><span class="text-slate-400">' + esc(addr) + '</span>' : '') +
            '</p>';
    }

    function shipEditHtmlForMerge(group) {
        var key = group.key;
        var ft = group.fulfillmentType || '';
        if (ft === 'LOGISTICS') {
            var preBrand = '';
            if (global.TM_LogisticsDetect && typeof global.TM_LogisticsDetect.normalizeBrand === 'function') {
                preBrand = global.TM_LogisticsDetect.normalizeBrand(group.logisticsBrand || '') || '';
            } else {
                preBrand = group.logisticsBrand || '';
            }
            var brands = LOGISTICS_BRANDS.map(function (b) {
                var sel = (preBrand === b) ? ' selected' : '';
                return '<option value="' + esc(b) + '"' + sel + '>' + esc(b) + '</option>';
            }).join('');
            return '<div class="mt-1.5 flex flex-col gap-1.5 min-w-0" data-sf-ship-edit="' + esc(key) + '">' +
                '<div class="flex flex-col sm:flex-row gap-1.5 min-w-0">' +
                '<select data-sf-log-brand="' + esc(key) + '" class="form-input form-input--compact text-[11px] py-1 min-w-0 flex-1" title="物流品牌">' +
                '<option value="">物流品牌</option>' + brands + '</select>' +
                '<div class="flex gap-1 min-w-0 flex-[1.4]">' +
                '<input type="text" data-sf-log-tracking="' + esc(key) + '" value="' + esc(group.trackingNo || '') + '" ' +
                'placeholder="运单号（可扫码）" class="form-input form-input--compact text-[11px] py-1 min-w-0 flex-1" ' +
                'autocomplete="off" inputmode="text">' +
                '<button type="button" data-sf-scan-tracking="' + esc(key) + '" ' +
                'class="shrink-0 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-brand-600 hover:bg-brand-50" ' +
                'title="扫码填入运单号并识别物流">' +
                '<i class="ph ph-barcode"></i> 扫码</button>' +
                '</div></div></div>';
        }
        if (ft === 'DELIVERY_VEHICLE') {
            return '<div class="mt-1.5 flex flex-col sm:flex-row gap-1.5 min-w-0" data-sf-ship-edit="' + esc(key) + '">' +
                '<input type="text" data-sf-driver="' + esc(key) + '" value="' + esc(group.driverName || '') + '" ' +
                'placeholder="司机" class="form-input form-input--compact text-[11px] py-1 min-w-0 flex-1">' +
                '<input type="text" data-sf-plate="' + esc(key) + '" value="' + esc(group.vehiclePlate || '') + '" ' +
                'placeholder="车牌" class="form-input form-input--compact text-[11px] py-1 min-w-0 flex-1"></div>';
        }
        return '';
    }

    function applyTrackingAndDetect(key, raw) {
        var body = $('sf-list-body');
        if (!body) return;
        var trackEl = body.querySelector('[data-sf-log-tracking="' + key + '"]');
        var brandEl = body.querySelector('[data-sf-log-brand="' + key + '"]');
        var cleaned = raw;
        var detected = null;
        if (global.TM_LogisticsDetect) {
            detected = global.TM_LogisticsDetect.detectBrand(raw);
            cleaned = detected.trackingNo || global.TM_LogisticsDetect.cleanTrackingNo(raw);
        } else {
            cleaned = String(raw || '').trim();
        }
        if (trackEl) trackEl.value = cleaned || '';
        if (brandEl && detected && detected.brand && detected.confidence >= 0.6) {
            if (global.TM_LogisticsDetect.applyToSelect(brandEl, detected.brand)) {
                notify('已识别为' + detected.brand, 'success');
            }
        } else if (cleaned && brandEl && !(brandEl.value)) {
            notify('已填入运单号，请选择物流品牌', 'info');
        }
    }

    function scanTrackingForShip(key) {
        if (!global.TmSerialCapture || typeof global.TmSerialCapture.open !== 'function') {
            notify('扫码组件未加载', 'error');
            return;
        }
        global.TmSerialCapture.open({
            mode: 'tracking',
            expectedQty: 1,
            onComplete: function (serials) {
                if (serials && serials.length) {
                    applyTrackingAndDetect(key, serials[0]);
                }
            }
        });
    }

    function bindShipScanEvents(body) {
        if (!body) return;
        body.querySelectorAll('[data-sf-scan-tracking]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                scanTrackingForShip(btn.getAttribute('data-sf-scan-tracking'));
            });
        });
        body.querySelectorAll('[data-sf-log-tracking]').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var key = inp.getAttribute('data-sf-log-tracking');
                if (!inp.value) return;
                applyTrackingAndDetect(key, inp.value);
            });
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var key = inp.getAttribute('data-sf-log-tracking');
                    applyTrackingAndDetect(key, inp.value);
                }
            });
        });
    }

    function shipProductLineHtml(line, custKey, mergeKey) {
        var key = lineKey(line);
        var checked = state.selected.ship[key] ? 'checked' : '';
        var qty = lineSuggestQty(line);
        var plan = line.fulfillmentPlan || line.fulfillment_plan || '';
        var badge = plan === 'TRANSFERRED'
            ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-bold">已调待发</span>'
            : (plan === 'PARTIAL_TRANSFER' || line.lineKind === 'transferred_ready'
                ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-bold">部分已调</span>'
                : (line.lineKind === 'pending_ship'
                    ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-bold">待发</span>'
                    : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">欠货可发</span>'));
        var prod = line.spuName || line.productName || '产品';
        var spec = line.skuSpec || line.sku_spec || '';
        return '<div class="rounded-lg bg-white border border-slate-100 px-2.5 py-2" data-sf-row="' + esc(key) + '">' +
            '<div class="flex items-start gap-2">' +
            '<input type="checkbox" data-sf-check="' + esc(key) + '" data-sf-cust="' + esc(custKey) + '" data-sf-merge="' + esc(mergeKey) + '" class="mt-0.5 rounded border-slate-300 text-brand-600 shrink-0" ' + checked + '>' +
            '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' + badge +
            '<span class="text-xs font-bold text-slate-800 truncate">' + esc(prod) + '</span>' +
            (spec ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">' + esc(spec) + '</span>' : '') +
            '</div>' +
            '<p class="text-[10px] text-slate-500 mt-0.5">数量 <span class="font-mono font-bold text-slate-800">' + esc(qty) + '</span>' +
            (line.targetWarehouseName || line.sourceWarehouseName
                ? ' · 发出仓 ' + esc(line.targetWarehouseName || line.sourceWarehouseName)
                : '') +
            '</p></div></div></div>';
    }

    function shipMergeGroupHtml(merge, custKey) {
        var orderBlocks = merge.orders.map(function (ord) {
            var linesHtml = ord.lines.map(function (line) {
                return shipProductLineHtml(line, custKey, merge.key);
            }).join('');
            return '<div class="mt-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">' +
                '<p class="text-[11px] font-bold text-slate-600 mb-1.5 truncate">' +
                '<i class="ph ph-receipt text-slate-400"></i> ' + esc(ord.orderCode) +
                ' · 待发 <span class="font-mono text-slate-800">' + esc(ord.qtyTotal) + '</span></p>' +
                '<div class="space-y-1.5">' + linesHtml + '</div></div>';
        }).join('');
        var multiOrderHint = merge.orders.length > 1
            ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-bold">可合并发货 · ' + merge.orders.length + ' 单</span>'
            : '';
        return '<div class="px-3 py-2.5 border-t border-slate-100" data-sf-merge-block="' + esc(merge.key) + '">' +
            '<div class="flex items-start gap-2 mb-1">' +
            '<input type="checkbox" data-sf-merge-check="' + esc(merge.key) + '" class="mt-1 rounded border-slate-300 text-brand-600 shrink-0" title="全选本组合并发货">' +
            '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' + multiOrderHint +
            (merge.warehouseName ? '<span class="text-[10px] text-slate-400">仓 ' + esc(merge.warehouseName) + '</span>' : '') +
            '<span class="text-[10px] text-slate-400 ml-auto">合计 <span class="font-mono font-bold text-slate-700">' + esc(merge.qtyTotal) + '</span></span></div>' +
            shipRecvHtmlFromGroup(merge) +
            shipEditHtmlForMerge(merge) +
            '</div></div>' + orderBlocks + '</div>';
    }

    function shipCustomerHtml(cust) {
        var mergeHtml = cust.mergeGroups.map(function (mg) {
            return shipMergeGroupHtml(mg, cust.key);
        }).join('');
        return '<div class="rounded-xl border border-slate-200 bg-white overflow-hidden mb-3" data-sf-cust="' + esc(cust.key) + '">' +
            '<div class="flex items-center gap-2 px-3 py-2.5 bg-slate-50/80 border-b border-slate-100">' +
            '<input type="checkbox" data-sf-cust-check="' + esc(cust.key) + '" class="rounded border-slate-300 text-brand-600 shrink-0" title="全选本客户">' +
            '<div class="min-w-0 flex-1">' +
            '<p class="text-sm font-bold text-slate-800 truncate">' + esc(cust.customerName) + '</p>' +
            '<p class="text-[10px] text-slate-400 mt-0.5">' + cust.lineCount + ' 行 · 待发合计 ' +
            '<span class="font-mono font-bold text-rose-600">' + esc(cust.qtyTotal) + '</span>' +
            (cust.mergeGroups.length > 1 ? ' · ' + cust.mergeGroups.length + ' 组收货' : '') +
            '</p></div></div>' + mergeHtml + '</div>';
    }

    /** 待进货行：数量 / 单位 / 单价（水平紧凑，对齐进货单据字段） */
    function purchaseLineFieldsHtml(line, key, qty) {
        var unit = line.purchaseUnit || line.baseUnit || line.base_unit || '';
        var baseUnit = line.baseUnit || line.base_unit || '';
        // 占位价；渲染后由 applyPurchaseUnitPricesStrategy 按进货单据策略回填
        var price = line.unitPrice != null ? line.unitPrice
            : (line.purchasePrice != null ? line.purchasePrice : (line.salePrice != null ? line.salePrice : 0));
        var priceNum = Number(price);
        if (isNaN(priceNum) || priceNum < 0) priceNum = 0;
        var priceStr = priceNum.toFixed(2);
        var unitOpts = '';
        var seen = {};
        [unit, baseUnit].forEach(function (u) {
            var t = String(u || '').trim();
            if (!t || seen[t]) return;
            seen[t] = true;
            var sel = t === String(unit || '').trim() ? ' selected' : '';
            unitOpts += '<option value="' + esc(t) + '"' + sel + '>' + esc(t) + '</option>';
        });
        if (!unitOpts) {
            unitOpts = '<option value="">—</option>';
        }
        var pid = line.productId != null ? line.productId : '';
        var sid = line.skuId != null ? line.skuId : (line.sku_id != null ? line.sku_id : '');
        return '<div class="sf-purchase-fields flex items-center gap-1.5 mt-1.5 flex-nowrap min-w-0">' +
            '<label class="text-[10px] text-slate-400 whitespace-nowrap shrink-0">数量</label>' +
            '<input type="number" min="1" step="1" value="' + esc(qty) + '" data-sf-qty="' + esc(key) + '" ' +
            'class="sf-compact-input sf-compact-input--qty form-input form-input--compact text-xs font-mono text-center" inputmode="numeric" title="进货数量">' +
            '<label class="text-[10px] text-slate-400 whitespace-nowrap shrink-0">单位</label>' +
            '<select data-sf-unit="' + esc(key) + '" data-sf-product="' + esc(pid) + '" data-sf-sku="' + esc(sid) + '" ' +
            'class="sf-compact-input sf-compact-input--unit form-input form-input--compact text-[11px]" title="进货单位">' +
            unitOpts + '</select>' +
            '<label class="text-[10px] text-slate-400 whitespace-nowrap shrink-0">单价</label>' +
            '<input type="number" min="0" step="0.01" value="' + esc(priceStr) + '" data-sf-price="' + esc(key) + '" ' +
            'data-sf-product="' + esc(pid) + '" data-sf-sku="' + esc(sid) + '" data-sf-autofill="1" ' +
            'class="sf-compact-input sf-compact-input--price form-input form-input--compact text-xs font-mono text-right" inputmode="decimal" title="进货单价（最近进货价，否则售价×单位换算）">' +
            '</div>';
    }

    /**
     * 与进货单据一致：POST /api/v1/supp/purchases/last-unit-prices
     * 有历史进货 → 最近进货价（按单位换算）；无历史 → 售价 × 进货单位换算比 / 销售单位换算比
     */
    async function applyPurchaseUnitPricesStrategy(body, onlyKey) {
        if (!body || typeof global.wrappedFetch !== 'function') return;
        var priceInputs = onlyKey
            ? body.querySelectorAll('[data-sf-price="' + onlyKey + '"]')
            : body.querySelectorAll('[data-sf-price]');
        if (!priceInputs.length) return;
        var lines = [];
        var meta = [];
        Array.prototype.forEach.call(priceInputs, function (priceEl) {
            if (!priceEl || priceEl.dataset.userEdited === '1') return;
            var key = priceEl.getAttribute('data-sf-price');
            var unitEl = body.querySelector('[data-sf-unit="' + key + '"]');
            var productId = Number(priceEl.getAttribute('data-sf-product')
                || (unitEl && unitEl.getAttribute('data-sf-product')) || 0);
            if (!(productId > 0)) return;
            var skuRaw = priceEl.getAttribute('data-sf-sku')
                || (unitEl && unitEl.getAttribute('data-sf-sku')) || '';
            var skuId = skuRaw !== '' && !isNaN(Number(skuRaw)) ? Number(skuRaw) : null;
            var unitName = unitEl ? String(unitEl.value || '').trim() : '';
            var line = { productId: productId, unitName: unitName };
            if (skuId != null && skuId > 0) line.skuId = skuId;
            lines.push(line);
            meta.push({ key: key, productId: productId, skuId: skuId, unitName: unitName, priceEl: priceEl });
        });
        if (!lines.length) return;
        try {
            var resp = await global.wrappedFetch('/api/v1/supp/purchases/last-unit-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines: lines })
            });
            var wrap = global.handleApiResponse
                ? await global.handleApiResponse(resp)
                : await resp.json();
            var data = wrap && wrap.data ? wrap.data : (wrap || {});
            meta.forEach(function (m) {
                if (!m.priceEl || m.priceEl.dataset.userEdited === '1') return;
                var keyFull = String(m.productId)
                    + (m.skuId != null ? ':' + m.skuId : '')
                    + (m.unitName ? ':' + m.unitName : '');
                var last = data[keyFull] != null ? data[keyFull]
                    : (data[String(m.productId)] != null ? data[String(m.productId)] : data[m.productId]);
                if (last != null && Number(last) > 0) {
                    m.priceEl.value = Number(last).toFixed(2);
                    m.priceEl.dataset.autofill = '1';
                }
            });
        } catch (e) {
            console.warn('[ShortageWorkbench] 进货单价策略查询失败', e);
        }
    }

    function bindPurchasePriceEvents(body) {
        body.querySelectorAll('[data-sf-price]').forEach(function (inp) {
            inp.addEventListener('input', function () {
                inp.dataset.userEdited = '1';
            });
        });
        body.querySelectorAll('[data-sf-unit]').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var key = sel.getAttribute('data-sf-unit');
                var priceEl = body.querySelector('[data-sf-price="' + key + '"]');
                if (priceEl) {
                    // 换单位后按策略重算（除非用户已手改价）
                    if (priceEl.dataset.userEdited !== '1') {
                        applyPurchaseUnitPricesStrategy(body, key);
                    }
                }
            });
        });
    }

    function renderPurchaseGroups(body) {
        var groups = (state.data && state.data.purchaseGroups) ? state.data.purchaseGroups : [];
        if (!groups.length) {
            body.innerHTML = emptyHtml('purchase');
            return;
        }
        body.innerHTML = groups.map(function (g) {
            var sid = g.supplierId != null ? g.supplierId : 'none';
            var lines = g.lines || [];
            var spuGroups = groupBySpuSku(lines);
            var spuHtml = spuGroups.map(function (spu) {
                // 已按 SKU 聚合：每个规格一行，不再展开客户/订单
                var skuBlocks = spu.skuList.map(function (sku) {
                    var line = sku.lines[0] || {};
                    var key = lineKey(line);
                    var checked = state.selected.purchase[key] ? 'checked' : '';
                    var qty = purchaseSuggestQty(line);
                    var baseNeed = purchaseBaseNeed(line);
                    var baseUnit = line.baseUnit || line.base_unit || '';
                    var purchaseUnit = line.purchaseUnit || baseUnit || '';
                    var orderN = line.orderCount != null ? Number(line.orderCount) : sku.lines.length;
                    return '<div class="mt-1 flex items-start gap-2 py-2 border-t border-slate-50 first:border-0" data-sf-row="' + esc(key) + '">' +
                        '<input type="checkbox" data-sf-check="' + esc(key) + '" data-sf-supplier="' + esc(sid) + '" data-sf-spu="' + esc(spu.key) + '" class="mt-0.5 rounded border-slate-300 text-brand-600 shrink-0" ' + checked + '>' +
                        '<div class="min-w-0 flex-1">' +
                        '<div class="flex flex-wrap items-center gap-1.5 mb-0.5">' +
                        '<span class="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-bold text-slate-600">' + esc(sku.skuSpec) + '</span>' +
                        '<span class="text-[10px] text-slate-500">欠货 <span class="font-mono text-rose-600 font-bold">' + esc(baseNeed) + '</span>' +
                        (baseUnit ? ' ' + esc(baseUnit) : '') + '</span>' +
                        (purchaseUnit && String(purchaseUnit) !== String(baseUnit)
                            ? '<span class="text-[10px] text-slate-400">→ 建议 <span class="font-mono text-brand-600 font-bold">' + esc(qty) + '</span> ' + esc(purchaseUnit) + '</span>'
                            : '') +
                        dualGapBadgeHtml(line) +
                        (line.partialGap
                            ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold">部分缺口</span>'
                            : '') +
                        (orderN > 1
                            ? '<span class="text-[9px] text-slate-400">覆盖 ' + esc(orderN) + ' 笔订单</span>'
                            : '') +
                        '</div>' +
                        purchaseLineFieldsHtml(line, key, qty) +
                        '</div></div>';
                }).join('');
                return '<div class="rounded-lg border border-slate-100 bg-slate-50/50 mt-2 overflow-hidden" data-sf-spu="' + esc(spu.key) + '">' +
                    '<div class="flex items-center gap-2 px-2.5 py-2 bg-white border-b border-slate-100">' +
                    '<input type="checkbox" data-sf-spu-check="' + esc(spu.key) + '" class="rounded border-slate-300 text-brand-600 shrink-0">' +
                    '<p class="text-xs font-bold text-slate-800 truncate flex-1">' + esc(spu.spuName) + '</p>' +
                    '<span class="text-[10px] text-slate-400 shrink-0">' + spu.skuList.length + ' 规格</span></div>' +
                    '<div class="px-2.5 pb-2">' + skuBlocks + '</div></div>';
            }).join('');
            var needSupplier = sid === 'none' || sid === '' || sid == null;
            var groupTitle = needSupplier ? '散采 / 未指定供应商' : (g.supplierName || '未指定供应商');
            return '<div class="rounded-xl border border-slate-200 bg-white p-3 mb-3" data-sf-group="' + esc(sid) + '">' +
                '<div class="flex items-center justify-between gap-2 mb-1">' +
                '<p class="text-xs font-bold text-slate-700"><i class="ph ph-truck text-brand-500"></i> ' +
                esc(groupTitle) +
                ' <span class="text-slate-400 font-normal">(' + lines.length + ')</span></p>' +
                '<button type="button" class="text-[10px] font-bold text-brand-600" data-sf-select-group="' + esc(sid) + '">全选本组</button>' +
                '</div>' +
                (needSupplier ? supplierOverrideSelectHtml(sid) : '') +
                spuHtml + '</div>';
        }).join('');
        bindRowEvents(body);
        bindPurchasePriceEvents(body);
        applyPurchaseUnitPricesStrategy(body);
        body.querySelectorAll('[data-sf-select-group]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sid = btn.getAttribute('data-sf-select-group');
                body.querySelectorAll('[data-sf-supplier="' + sid + '"]').forEach(function (cb) {
                    cb.checked = true;
                    state.selected.purchase[cb.getAttribute('data-sf-check')] = true;
                });
            });
        });
        body.querySelectorAll('[data-sf-supplier-override]').forEach(function (sel) {
            sel.addEventListener('change', function () {
                state.purchaseSupplierOverride = String(sel.value || '');
            });
        });
    }

    function bindRowEvents(body) {
        body.querySelectorAll('[data-sf-check]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var key = cb.getAttribute('data-sf-check');
                state.selected[state.tab][key] = !!cb.checked;
                syncSpuCheckbox(body, cb.getAttribute('data-sf-spu'));
                syncMergeCheckbox(body, cb.getAttribute('data-sf-merge'));
                syncCustCheckbox(body, cb.getAttribute('data-sf-cust'));
            });
        });
        body.querySelectorAll('[data-sf-spu-check]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var spuKey = cb.getAttribute('data-sf-spu-check');
                var on = !!cb.checked;
                body.querySelectorAll('[data-sf-check][data-sf-spu="' + spuKey + '"]').forEach(function (child) {
                    child.checked = on;
                    state.selected[state.tab][child.getAttribute('data-sf-check')] = on;
                });
            });
            syncSpuCheckbox(body, cb.getAttribute('data-sf-spu-check'));
        });
        body.querySelectorAll('[data-sf-cust-check]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var custKey = cb.getAttribute('data-sf-cust-check');
                var on = !!cb.checked;
                body.querySelectorAll('[data-sf-check][data-sf-cust="' + custKey + '"]').forEach(function (child) {
                    child.checked = on;
                    state.selected[state.tab][child.getAttribute('data-sf-check')] = on;
                });
                body.querySelectorAll('[data-sf-merge-check]').forEach(function (mcb) {
                    var custRoot = mcb.closest('[data-sf-cust]');
                    if (custRoot && custRoot.getAttribute('data-sf-cust') === custKey) {
                        mcb.checked = on;
                    }
                });
            });
            syncCustCheckbox(body, cb.getAttribute('data-sf-cust-check'));
        });
        body.querySelectorAll('[data-sf-merge-check]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var mergeKey = cb.getAttribute('data-sf-merge-check');
                var on = !!cb.checked;
                body.querySelectorAll('[data-sf-check][data-sf-merge="' + mergeKey + '"]').forEach(function (child) {
                    child.checked = on;
                    state.selected[state.tab][child.getAttribute('data-sf-check')] = on;
                    syncCustCheckbox(body, child.getAttribute('data-sf-cust'));
                });
            });
            syncMergeCheckbox(body, cb.getAttribute('data-sf-merge-check'));
        });
        body.querySelectorAll('[data-sf-source]').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var key = sel.getAttribute('data-sf-source');
                var opt = sel.options[sel.selectedIndex];
                var avail = opt && opt.getAttribute('data-avail') != null
                    ? (parseInt(opt.getAttribute('data-avail'), 10) || 0)
                    : 0;
                var qtyInp = body.querySelector('[data-sf-qty="' + key + '"]');
                var label = body.querySelector('[data-sf-avail-label="' + key + '"]');
                if (label) label.textContent = '/' + avail;
                if (qtyInp) {
                    qtyInp.max = String(Math.max(1, avail));
                    var suggest = parseInt(qtyInp.getAttribute('data-sf-suggest'), 10) || 0;
                    var cur = parseInt(qtyInp.value, 10) || 0;
                    var next = avail > 0 ? Math.min(Math.max(cur, 1), avail) : cur;
                    if (suggest > 0 && cur > avail) next = Math.min(suggest, avail);
                    qtyInp.value = String(next > 0 ? next : (avail > 0 ? Math.min(suggest, avail) : suggest));
                }
            });
        });
    }

    function syncSpuCheckbox(body, spuKey) {
        if (!body || !spuKey) return;
        var spuCb = body.querySelector('[data-sf-spu-check="' + spuKey + '"]');
        if (!spuCb) return;
        var children = body.querySelectorAll('[data-sf-check][data-sf-spu="' + spuKey + '"]');
        if (!children.length) return;
        var allOn = true;
        children.forEach(function (c) {
            if (!c.checked) allOn = false;
        });
        spuCb.checked = allOn;
    }

    function syncMergeCheckbox(body, mergeKey) {
        if (!body || !mergeKey) return;
        var mergeCb = body.querySelector('[data-sf-merge-check="' + mergeKey + '"]');
        if (!mergeCb) return;
        var children = body.querySelectorAll('[data-sf-check][data-sf-merge="' + mergeKey + '"]');
        if (!children.length) return;
        var allOn = true;
        children.forEach(function (c) {
            if (!c.checked) allOn = false;
        });
        mergeCb.checked = allOn;
    }

    function syncCustCheckbox(body, custKey) {
        if (!body || !custKey) return;
        var custCb = body.querySelector('[data-sf-cust-check="' + custKey + '"]');
        if (!custCb) return;
        var children = body.querySelectorAll('[data-sf-check][data-sf-cust="' + custKey + '"]');
        if (!children.length) return;
        var allOn = true;
        children.forEach(function (c) {
            if (!c.checked) allOn = false;
        });
        custCb.checked = allOn;
    }

    function selectedLinesForTab() {
        var lines = currentLines();
        var sel = state.selected[state.tab] || {};
        var body = $('sf-list-body');
        return lines.filter(function (line) {
            var key = lineKey(line);
            var cb = body ? body.querySelector('[data-sf-check="' + key + '"]') : null;
            if (cb) return cb.checked;
            return !!sel[key];
        });
    }

    function selectAllVisible(on) {
        var body = $('sf-list-body');
        if (!body) return 0;
        var n = 0;
        body.querySelectorAll('[data-sf-check]').forEach(function (cb) {
            cb.checked = !!on;
            state.selected[state.tab][cb.getAttribute('data-sf-check')] = !!on;
            if (on) n++;
        });
        body.querySelectorAll('[data-sf-spu-check], [data-sf-cust-check], [data-sf-merge-check]').forEach(function (cb) {
            cb.checked = !!on;
        });
        return n;
    }

    function selectTransferableVisible() {
        var body = $('sf-list-body');
        if (!body) return 0;
        var lines = currentLines();
        var transferableKeys = {};
        lines.forEach(function (line) {
            var avail = line.availableAtSource != null ? Number(line.availableAtSource) : 0;
            if (avail > 0) transferableKeys[lineKey(line)] = true;
        });
        var n = 0;
        body.querySelectorAll('[data-sf-check]').forEach(function (cb) {
            var key = cb.getAttribute('data-sf-check');
            var on = !!transferableKeys[key];
            cb.checked = on;
            state.selected[state.tab][key] = on;
            if (on) n++;
        });
        body.querySelectorAll('[data-sf-spu-check]').forEach(function (cb) {
            syncSpuCheckbox(body, cb.getAttribute('data-sf-spu-check'));
        });
        return n;
    }

    function linesForPrint() {
        var picked = selectedLinesForTab();
        if (picked.length) return picked;
        return currentLines().slice();
    }

    function warehouseNameById(id) {
        if (id == null || id === '') return '全部仓库';
        var found = state.warehouses.find(function (w) { return String(w.id) === String(id); });
        return found ? found.name : ('仓' + id);
    }

    function dateRangeLabel() {
        if (state.allTime || (!state.dateFrom && !state.dateTo)) return '全部时间';
        if (state.dateFrom && state.dateTo) return state.dateFrom + ' ~ ' + state.dateTo;
        if (state.dateFrom) return state.dateFrom + ' 起';
        return '至 ' + state.dateTo;
    }

    function buildShipPrintDocs(lines) {
        var shopName = (global.TM_Tenant && global.TM_Tenant.shopName) ||
            (global.__TM_TENANT && global.__TM_TENANT.name) ||
            'TradeMind 商户';
        var docs = [];
        var groups = groupShipByCustomer(lines || []);
        groups.forEach(function (cust) {
            (cust.mergeGroups || []).forEach(function (merge) {
                (merge.orders || []).forEach(function (ord) {
                    var printLines = (ord.lines || []).map(function (line) {
                        var src = line.sourceWarehouseName || '';
                        var tgt = line.targetWarehouseName || '';
                        return {
                            productName: line.spuName || line.productName || '产品',
                            specDisplay: line.skuSpec || line.sku_spec || '',
                            quantity: lineSuggestQty(line),
                            unitName: '',
                            warehouseRoute: tgt || src || '-'
                        };
                    });
                    if (!printLines.length) return;
                    var totalQty = printLines.reduce(function (s, L) {
                        return s + (Number(L.quantity) || 0);
                    }, 0);
                    docs.push({
                        merchant: { name: shopName, footerText: '欠货履约·发货清单' },
                        counterparty: {
                            name: cust.customerName || '客户',
                            contactName: merge.contactName || '',
                            contactPhone: merge.contactPhone || '',
                            address: merge.address || ''
                        },
                        templateColumns: ['productName', 'specDisplay', 'quantity', 'warehouseRoute'],
                        lines: printLines,
                        summary: { lineCount: printLines.length, totalAmount: null, totalQty: totalQty },
                        meta: {
                            docType: 'SHIP_PICK_LIST',
                            docNo: ord.orderCode || ('ORD-' + (ord.orderId || '')),
                            createdAt: todayISO(),
                            dateRange: dateRangeLabel(),
                            warehouseFilter: warehouseNameById(state.warehouseId),
                            fulfillmentType: fulfillmentTypeLabel(merge.fulfillmentType || '')
                        }
                    });
                });
            });
        });
        return docs;
    }

    function buildPickListDoc(lines) {
        var docType = state.tab === 'ship' ? 'SHIP_PICK_LIST'
            : (state.tab === 'transfer' ? 'TRANSFER_PICK_LIST' : 'SHORTAGE_FULFILLMENT_LIST');
        var titleHint = state.tab === 'ship' ? '发货' : (state.tab === 'transfer' ? '调货' : '进货');
        var isPurchase = state.tab === 'purchase';
        var printLines = (lines || []).map(function (line) {
            var qty = isPurchase ? purchaseSuggestQty(line) : lineSuggestQty(line);
            var unit = isPurchase
                ? (line.purchaseUnit || line.baseUnit || line.base_unit || '')
                : '';
            var src = line.sourceWarehouseName || '';
            var tgt = line.targetWarehouseName || '';
            var route = state.tab === 'transfer'
                ? ((src || '-') + ' → ' + (tgt || '-'))
                : (tgt || src || '-');
            var baseNeed = isPurchase ? purchaseBaseNeed(line) : null;
            return {
                productName: line.spuName || line.productName || '产品',
                specDisplay: line.skuSpec || line.sku_spec || '',
                quantity: qty,
                unitName: unit,
                warehouseRoute: route,
                orderCode: isPurchase
                    ? (line.orderCount > 1 ? ('覆盖' + line.orderCount + '笔') : '')
                    : (line.orderCode || ''),
                customerName: isPurchase
                    ? (baseNeed != null ? ('欠货' + baseNeed + (line.baseUnit ? line.baseUnit : '')) : '')
                    : (line.customerName || '')
            };
        });
        var shopName = (global.TM_Tenant && global.TM_Tenant.shopName) ||
            (global.__TM_TENANT && global.__TM_TENANT.name) ||
            'TradeMind 商户';
        return {
            merchant: { name: shopName, footerText: '欠货履约·' + titleHint + '清单' },
            counterparty: { name: '欠货履约工作台' },
            templateColumns: isPurchase
                ? ['productName', 'specDisplay', 'quantity', 'warehouseRoute']
                : ['productName', 'specDisplay', 'quantity', 'warehouseRoute', 'customerName', 'orderCode'],
            lines: printLines,
            summary: { lineCount: printLines.length, totalAmount: null },
            meta: {
                docType: docType,
                docNo: 'SF-' + titleHint + '-' + todayISO().replace(/-/g, ''),
                createdAt: todayISO(),
                dateRange: dateRangeLabel(),
                warehouseFilter: warehouseNameById(state.warehouseId)
            }
        };
    }

    function printPickList() {
        var lines = linesForPrint();
        if (!lines.length) {
            notify('当前无可打印明细', 'warning');
            return;
        }
        if (state.tab === 'ship') {
            var shipDocs = buildShipPrintDocs(lines);
            if (!shipDocs.length) {
                notify('当前无可打印明细', 'warning');
                return;
            }
            if (global.TM_PrintPreview && typeof global.TM_PrintPreview.open === 'function') {
                global.TM_PrintPreview.open({
                    docType: 'SHIP_PICK_LIST',
                    docId: shipDocs[0].meta.docNo,
                    documents: shipDocs,
                    document: shipDocs[0]
                });
                return;
            }
            if (global.TM_Print && typeof global.TM_Print.print === 'function') {
                global.TM_Print.print({
                    docType: 'SHIP_PICK_LIST',
                    docId: shipDocs[0].meta.docNo,
                    documents: shipDocs,
                    document: shipDocs[0],
                    skipPreview: true
                });
                return;
            }
            notify('打印模块未加载', 'error');
            return;
        }
        var doc = buildPickListDoc(lines);
        if (global.TM_PrintPreview && typeof global.TM_PrintPreview.open === 'function') {
            global.TM_PrintPreview.open({
                docType: doc.meta.docType,
                docId: doc.meta.docNo,
                document: doc
            });
            return;
        }
        if (global.TM_Print && typeof global.TM_Print.print === 'function') {
            global.TM_Print.print({
                docType: doc.meta.docType,
                docId: doc.meta.docNo,
                document: doc,
                skipPreview: true
            });
            return;
        }
        notify('打印模块未加载', 'error');
    }

    async function confirmAction() {
        if (state.tab === 'transfer') return doTransfer();
        if (state.tab === 'ship') return doShip();
        return doPurchase();
    }

    async function doTransfer() {
        var body = $('sf-list-body');
        var picked = selectedLinesForTab();
        if (!picked.length) {
            notify('请先勾选要调货的明细', 'warning');
            return;
        }
        var lines = [];
        for (var i = 0; i < picked.length; i++) {
            var line = picked[i];
            var key = lineKey(line);
            var qtyInp = body.querySelector('[data-sf-qty="' + key + '"]');
            var srcSel = body.querySelector('[data-sf-source="' + key + '"]');
            var qty = qtyInp ? (parseInt(qtyInp.value, 10) || 0) : (line.suggestQty || 0);
            var src = srcSel ? (parseInt(srcSel.value, 10) || null) : line.sourceWarehouseId;
            var target = line.targetWarehouseId;
            if (!src || !target || qty <= 0) {
                notify('行「' + (line.productName || key) + '」源仓或数量无效', 'warning');
                return;
            }
            var avail = line.availableAtSource != null ? line.availableAtSource : 0;
            if (srcSel) {
                var opt = (line.sourceOptions || []).find(function (o) {
                    return String(o.warehouseId) === String(src);
                });
                if (opt) avail = opt.available;
            }
            if (qty > avail) {
                notify('「' + (line.productName || '') + '」调货数超过源仓库存 ' + avail, 'warning');
                return;
            }
            lines.push({
                itemId: line.itemId,
                orderId: line.orderId,
                productId: line.productId,
                skuId: line.skuId != null ? line.skuId : line.sku_id,
                sourceWarehouseId: src,
                targetWarehouseId: target,
                quantity: qty
            });
        }
        var used = {};
        for (var j = 0; j < lines.length; j++) {
            var L = lines[j];
            var uk = String(L.sourceWarehouseId) + ':' + String(L.productId) + ':' + String(L.skuId || 0);
            used[uk] = (used[uk] || 0) + L.quantity;
        }
        for (var j2 = 0; j2 < picked.length; j2++) {
            var pl = picked[j2];
            var pk = lineKey(pl);
            var pSrc = body.querySelector('[data-sf-source="' + pk + '"]');
            var srcId = pSrc ? (parseInt(pSrc.value, 10) || null) : pl.sourceWarehouseId;
            var uk2 = String(srcId) + ':' + String(pl.productId) + ':' + String(pl.skuId || pl.sku_id || 0);
            var need = used[uk2] || 0;
            var optAvail = pl.availableAtSource != null ? Number(pl.availableAtSource) : 0;
            if (pSrc) {
                var optEl = pSrc.options[pSrc.selectedIndex];
                if (optEl && optEl.getAttribute('data-avail') != null) {
                    optAvail = parseInt(optEl.getAttribute('data-avail'), 10) || 0;
                } else {
                    var found = (pl.sourceOptions || []).find(function (o) {
                        return String(o.warehouseId) === String(srcId);
                    });
                    if (found) optAvail = Number(found.available) || 0;
                }
            }
            if (need > optAvail) {
                notify('「' + (pl.spuName || pl.productName || '') + ' ' + (pl.skuSpec || '') +
                    '」勾选合计 ' + need + ' 超过源仓库存 ' + optAvail + '，请调低数量', 'warning');
                return;
            }
        }
        var ok = true;
        if (global.TM_UI && global.TM_UI.confirm) {
            ok = await global.TM_UI.confirm({
                title: '确认调货',
                message: '将按实际数量调拨 ' + lines.length + ' 行到履约仓，是否继续？',
                confirmLabel: '确认调货',
                cancelLabel: '取消'
            });
        }
        if (!ok) return;
        try {
            var resp = await global.wrappedFetch('/api/v1/rd/orders/shortage-workbench/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines: lines })
            });
            var wrap = await global.handleApiResponse(resp);
            var data = wrap && wrap.data ? wrap.data : {};
            summarizeResult('调货', data);
            await loadData();
            if (typeof global.loadInProgressOrders === 'function') global.loadInProgressOrders();
        } catch (e) {
            notify('调货失败：' + (e.message || e), 'error');
        }
    }

    async function doShip() {
        var body = $('sf-list-body');
        var picked = selectedLinesForTab();
        if (!picked.length) {
            notify('请先勾选要发货的明细', 'warning');
            return;
        }
        var ok = true;
        if (global.TM_UI && global.TM_UI.confirm) {
            ok = await global.TM_UI.confirm({
                title: '确认发货',
                message: '将批量发货 ' + picked.length + ' 行（只更新物流/库存，不自动记账）。',
                confirmLabel: '确认发货',
                cancelLabel: '取消'
            });
        }
        if (!ok) return;
        var warehouseId = state.warehouseId ? parseInt(state.warehouseId, 10) : null;
        var lines = picked.map(function (line) {
            var mergeKey = shipMergeKey(line);
            var qty = line.shipQty != null ? line.shipQty
                : (line.suggestQty != null ? line.suggestQty : (line.shortageQty || 0));
            var ft = line.fulfillmentType || '';
            var payload = {
                orderId: line.orderId,
                itemId: line.itemId,
                shippedQty: qty,
                fromWarehouseId: (line.fulfillmentPlan === 'TRANSFERRED' || line.fulfillment_plan === 'TRANSFERRED')
                    ? (line.targetWarehouseId || warehouseId)
                    : (line.targetWarehouseId || line.sourceWarehouseId || warehouseId)
            };
            if (ft === 'LOGISTICS') {
                var brandEl = body ? body.querySelector('[data-sf-log-brand="' + mergeKey + '"]') : null;
                var trackEl = body ? body.querySelector('[data-sf-log-tracking="' + mergeKey + '"]') : null;
                payload.shipmentType = 'EXPRESS';
                payload.logisticsBrand = brandEl ? brandEl.value : (line.logisticsBrand || '');
                var rawTrack = trackEl ? trackEl.value.trim() : (line.trackingNo || '');
                payload.trackingNo = (global.TM_LogisticsDetect && global.TM_LogisticsDetect.cleanTrackingNo)
                    ? global.TM_LogisticsDetect.cleanTrackingNo(rawTrack) : rawTrack;
                if (payload.logisticsBrand && global.TM_LogisticsDetect && global.TM_LogisticsDetect.normalizeBrand) {
                    payload.logisticsBrand = global.TM_LogisticsDetect.normalizeBrand(payload.logisticsBrand)
                        || payload.logisticsBrand;
                }
            } else if (ft === 'DELIVERY_VEHICLE') {
                var driverEl = body ? body.querySelector('[data-sf-driver="' + mergeKey + '"]') : null;
                var plateEl = body ? body.querySelector('[data-sf-plate="' + mergeKey + '"]') : null;
                payload.shipmentType = 'VEHICLE';
                payload.driverName = driverEl ? driverEl.value.trim() : (line.driverName || '');
                payload.vehiclePlate = plateEl ? plateEl.value.trim() : (line.vehiclePlate || '');
            }
            return payload;
        });
        try {
            var remarkDate = state.allTime ? todayISO()
                : (state.dateFrom || state.dateTo || todayISO());
            var resp = await global.wrappedFetch('/api/v1/rd/orders/shortage-workbench/ship', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouseId: warehouseId,
                    remark: '欠货履约·' + remarkDate,
                    lines: lines
                })
            });
            var wrap = await global.handleApiResponse(resp);
            var data = wrap && wrap.data ? wrap.data : {};
            summarizeResult('发货', data);
            await loadData();
            if (typeof global.loadInProgressOrders === 'function') global.loadInProgressOrders();
        } catch (e) {
            notify('发货失败：' + (e.message || e), 'error');
        }
    }

    async function doPurchase() {
        var body = $('sf-list-body');
        var picked = selectedLinesForTab();
        if (!picked.length) {
            notify('请先勾选要转进货的明细', 'warning');
            return;
        }
        var groups = {};
        picked.forEach(function (line) {
            var sid = line.supplierId != null ? String(line.supplierId) : 'none';
            if (!groups[sid]) {
                groups[sid] = {
                    supplierId: line.supplierId != null ? line.supplierId : null,
                    supplierName: line.supplierName || '未指定供应商',
                    lines: []
                };
            }
            var key = lineKey(line);
            var qtyInp = body.querySelector('[data-sf-qty="' + key + '"]');
            var qty = qtyInp ? (parseInt(qtyInp.value, 10) || 0)
                : purchaseSuggestQty(line);
            var sourceIds = Array.isArray(line.sourceItemIds) && line.sourceItemIds.length
                ? line.sourceItemIds.slice()
                : (line.itemId != null ? [line.itemId] : []);
            groups[sid].lines.push({
                line: line,
                qty: qty,
                sourceItemIds: sourceIds
            });
        });

        var keys = Object.keys(groups);

        // 未指定组：可用组内下拉临时指定供应商；仍可不选，直接生成无供应商草稿
        var overrideSel = body.querySelector('[data-sf-supplier-override="none"]');
        var overrideId = overrideSel ? String(overrideSel.value || '').trim() : (state.purchaseSupplierOverride || '');
        if (groups.none) {
            if (overrideId && !isNaN(Number(overrideId)) && Number(overrideId) > 0) {
                groups.none.supplierId = Number(overrideId);
                var foundSup = state.suppliers.find(function (s) { return String(s.id) === String(overrideId); });
                groups.none.supplierName = foundSup ? foundSup.name : ('供应商#' + overrideId);
            } else {
                groups.none.supplierId = null;
                groups.none.supplierName = '散采 / 未指定';
            }
        }

        var unassignedN = groups.none && groups.none.supplierId == null ? 1 : 0;
        var ok = true;
        if (global.TM_UI && global.TM_UI.confirm) {
            var msg = '将生成 ' + keys.length + ' 张进货草稿';
            if (unassignedN) {
                msg += '（含无供应商草稿，可稍后在进货单中补填）';
            }
            msg += '，是否继续？';
            ok = await global.TM_UI.confirm({
                title: '转进货草稿',
                message: msg,
                confirmLabel: '生成草稿',
                cancelLabel: '取消'
            });
        }
        if (!ok) return;

        var successN = 0;
        var failMsgs = [];
        var purchaseDate = state.dateFrom || todayISO();

        for (var g = 0; g < keys.length; g++) {
            var group = groups[keys[g]];
            var items = [];
            var total = 0;
            var itemIds = [];
            group.lines.forEach(function (x) {
                if (x.qty <= 0) return;
                var key = lineKey(x.line);
                var priceInp = body.querySelector('[data-sf-price="' + key + '"]');
                var unitSel = body.querySelector('[data-sf-unit="' + key + '"]');
                var price = priceInp ? (parseFloat(priceInp.value) || 0)
                    : (Number(x.line.unitPrice) || Number(x.line.purchasePrice) || 0);
                var unitName = unitSel ? String(unitSel.value || '').trim()
                    : (x.line.purchaseUnit || x.line.baseUnit || x.line.base_unit || '');
                // 聚合行：每 SKU 一条进货明细
                items.push({
                    productId: Number(x.line.productId),
                    skuId: x.line.sku_id != null ? x.line.sku_id : x.line.skuId,
                    quantity: x.qty,
                    unitPrice: price,
                    unitName: unitName,
                    batchNo: ''
                });
                total += x.qty * price;
                (x.sourceItemIds || []).forEach(function (id) {
                    if (id != null && itemIds.indexOf(id) < 0) itemIds.push(id);
                });
            });
            if (!items.length) continue;
            try {
                var sidForSave = group.supplierId != null ? Number(group.supplierId) : null;
                var purchaseData = {
                    supplierId: sidForSave,
                    purchaseStatus: 'DRAFT',
                    purchaseDate: purchaseDate,
                    totalAmount: total,
                    paidAmount: 0,
                    warehouseId: state.warehouseId ? Number(state.warehouseId) : null,
                    items: items
                };
                var requestData = {
                    purchase: purchaseData,
                    items: items,
                    supplierId: sidForSave,
                    purchaseStatus: 'DRAFT',
                    purchaseDate: purchaseDate,
                    totalAmount: total
                };
                var resp = await global.wrappedFetch('/api/v1/supp/purchases/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });
                var wrap = await global.handleApiResponse(resp);
                var purchase = (wrap && wrap.data) ? wrap.data : wrap;
                var purchaseId = purchase && (purchase.purchaseId || purchase.purchase_id || purchase.id);
                var purchaseCode = purchase && (purchase.purchaseCode || purchase.purchase_code || '');
                if (!purchaseId) {
                    failMsgs.push((group.supplierName || '') + '：未返回进货单号');
                    continue;
                }
                var markResp = await global.wrappedFetch('/api/v1/rd/orders/shortage-workbench/mark-purchased', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        purchaseId: Number(purchaseId),
                        purchaseCode: purchaseCode || String(purchaseId),
                        itemIds: itemIds
                    })
                });
                await global.handleApiResponse(markResp);
                successN++;
            } catch (e) {
                failMsgs.push((group.supplierName || '') + '：' + (e.message || e));
            }
        }

        if (successN > 0) {
            notify('已生成 ' + successN + ' 张进货草稿' + (failMsgs.length ? '，失败 ' + failMsgs.length : ''), failMsgs.length ? 'warning' : 'success');
        } else {
            notify('转进货失败：' + (failMsgs[0] || '未知错误'), 'error');
        }
        if (failMsgs.length) console.warn('[ShortageWorkbench] 转进货部分失败', failMsgs);
        await loadData();
        if (typeof global.loadInProgressOrders === 'function') global.loadInProgressOrders();
    }

    function summarizeResult(label, data) {
        var ok = data.successCount != null ? data.successCount : 0;
        var fail = data.failedCount != null ? data.failedCount : 0;
        var msg = label + '完成：成功 ' + ok + (fail ? '，失败 ' + fail : '');
        if (fail && data.failed && data.failed.length) {
            var first = data.failed[0];
            msg += '。例：' + (first.message || '');
        }
        notify(msg, fail ? 'warning' : 'success');
    }

    function setListExpanded(expand) {
        var modal = $('shortage-fulfillment-modal');
        var btn = $('sf-list-expand-btn');
        if (!modal) return;
        var on = expand != null ? !!expand : !modal.classList.contains('tm-sf-modal--list-expanded');
        modal.classList.toggle('tm-sf-modal--list-expanded', on);
        if (btn) {
            btn.classList.toggle('is-expanded', on);
            btn.title = on ? '恢复默认布局' : '展开列表';
            btn.setAttribute('aria-label', on ? '恢复默认布局' : '展开列表区域');
        }
    }

    function openModal() {
        var modal = $('shortage-fulfillment-modal');
        if (!modal) return;
        bindUi();
        setListExpanded(false);
        state.allTime = true;
        state.dateFrom = '';
        state.dateTo = '';
        syncDateModeUi();
        if (typeof global.TM_openUnifiedModal === 'function') {
            global.TM_openUnifiedModal(modal);
        } else {
            if (typeof global.TM_applyDialogShell === 'function') global.TM_applyDialogShell(modal);
            modal.classList.remove('hidden');
        }
        state.purchaseSupplierOverride = '';
        Promise.all([loadWarehouses(), loadSuppliers()]).then(loadData);
    }

    function closeModal() {
        var modal = $('shortage-fulfillment-modal');
        if (!modal) return;
        setListExpanded(false);
        if (typeof global.TM_closeUnifiedModal === 'function') {
            global.TM_closeUnifiedModal(modal);
        } else {
            modal.classList.add('hidden');
        }
    }

    function bindUi() {
        document.querySelectorAll('[data-sf-tab]').forEach(function (btn) {
            btn.onclick = function () {
                state.tab = btn.getAttribute('data-sf-tab') || 'transfer';
                renderTabs();
                renderList();
            };
        });
        var expandBtn = $('sf-list-expand-btn');
        if (expandBtn) expandBtn.onclick = function () { setListExpanded(); };
        var refresh = $('sf-refresh-btn');
        if (refresh) refresh.onclick = function () { loadData(); };
        var action = $('sf-action-btn');
        if (action) action.onclick = function () { confirmAction(); };
        var allBtn = $('sf-select-all');
        if (allBtn) {
            allBtn.onclick = function () {
                var n = selectAllVisible(true);
                notify('已选 ' + n + ' 行', 'success');
            };
        }
        var transferableBtn = $('sf-select-transferable');
        if (transferableBtn) {
            transferableBtn.onclick = function () {
                var n = selectTransferableVisible();
                notify(n > 0 ? ('已选可调 ' + n + ' 行') : '暂无可调行', n > 0 ? 'success' : 'info');
            };
        }
        var noneBtn = $('sf-select-none');
        if (noneBtn) noneBtn.onclick = function () { selectAllVisible(false); };
        var printBtn = $('sf-print-btn');
        if (printBtn) printBtn.onclick = function () { printPickList(); };

        var dateAll = $('sf-date-all');
        if (dateAll) {
            dateAll.onclick = function () {
                state.allTime = true;
                state.dateFrom = '';
                state.dateTo = '';
                syncDateModeUi();
                loadData();
            };
        }
        var dateCustom = $('sf-date-custom');
        if (dateCustom) {
            dateCustom.onclick = function () {
                state.allTime = false;
                if (!state.dateFrom && !state.dateTo) {
                    state.dateFrom = todayISO();
                    state.dateTo = todayISO();
                }
                syncDateModeUi();
                loadData();
            };
        }
        var fromEl = $('sf-date-from');
        if (fromEl) {
            fromEl.onchange = function () {
                state.allTime = false;
                state.dateFrom = fromEl.value || '';
                syncDateModeUi();
                loadData();
            };
        }
        var toEl = $('sf-date-to');
        if (toEl) {
            toEl.onchange = function () {
                state.allTime = false;
                state.dateTo = toEl.value || '';
                syncDateModeUi();
                loadData();
            };
        }
        var whEl = $('sf-warehouse');
        if (whEl) {
            whEl.onchange = function () {
                state.warehouseId = whEl.value || '';
                loadData();
            };
        }
    }

    global.TM_ShortageFulfillment = {
        open: openModal,
        close: closeModal,
        refresh: loadData
    };
    global.openShortageFulfillment = openModal;
    global.closeShortageFulfillment = closeModal;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindUi);
    } else {
        bindUi();
    }
})(window);
