/**
 * 欠货履约工作台：待调货 / 待发货 / 待进货
 * 入口：工作台「进行中业务单据」旁
 */
(function (global) {
    'use strict';

    var state = {
        date: '',
        warehouseId: '',
        tab: 'transfer',
        data: null,
        warehouses: [],
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

    async function loadData() {
        var dateEl = $('sf-date');
        var whEl = $('sf-warehouse');
        state.date = dateEl && dateEl.value ? dateEl.value : todayISO();
        state.warehouseId = whEl && whEl.value ? whEl.value : '';
        var qs = '?date=' + encodeURIComponent(state.date);
        if (state.warehouseId) qs += '&warehouseId=' + encodeURIComponent(state.warehouseId);

        var body = $('sf-list-body');
        if (body) {
            body.innerHTML = '<div class="py-12 text-center text-slate-400 text-sm"><i class="ph ph-spinner animate-spin text-xl"></i><p class="mt-2">加载中…</p></div>';
        }
        try {
            var resp = await global.wrappedFetch('/api/v1/rd/orders/shortage-workbench' + qs, { method: 'GET' });
            var wrap = await global.handleApiResponse(resp);
            state.data = (wrap && wrap.data) ? wrap.data : null;
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
        if (state.tab === 'transfer') {
            if (actionHint) actionHint.textContent = '可改实际调货数（默认=欠货量，可多调备货）';
            if (actionBtn) actionBtn.textContent = '确认调货';
        } else if (state.tab === 'ship') {
            if (actionHint) actionHint.textContent = '勾选后批量确认发货，仅更新物流/库存';
            if (actionBtn) actionBtn.textContent = '确认发货';
        } else {
            if (actionHint) actionHint.textContent = '按供应商拆分生成进货草稿';
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
        return String(line.itemId != null ? line.itemId : line.item_id);
    }

    function lineSuggestQty(line) {
        if (line.shipQty != null) return Number(line.shipQty) || 0;
        if (line.suggestQty != null) return Number(line.suggestQty) || 0;
        return Number(line.shortageQty) || 0;
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
        var groups = groupBySpuSku(lines);
        if (state.tab === 'transfer') {
            body.innerHTML = groups.map(function (spu) {
                return transferSpuHtml(spu);
            }).join('');
        } else {
            body.innerHTML = groups.map(function (spu) {
                return shipSpuHtml(spu);
            }).join('');
        }
        bindRowEvents(body);
    }

    function emptyHtml(tab) {
        var tip = tab === 'transfer' ? '暂无待调货欠货行' : (tab === 'ship' ? '暂无待发货明细' : '暂无待进货（全仓无货）明细');
        return '<div class="py-14 text-center px-6">' +
            '<div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300"><i class="ph ph-package text-2xl"></i></div>' +
            '<p class="text-sm font-bold text-slate-600">' + tip + '</p>' +
            '<p class="text-xs text-slate-400 mt-1">换日期或仓库再试；欠货开单后会出现在此</p></div>';
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
            '<p class="text-[10px] text-slate-400 truncate leading-tight">' + esc(line.orderCode || '') +
            (line.customerName ? ' · ' + esc(line.customerName) : '') +
            ' · 目标 ' + esc(line.targetWarehouseName || '-') +
            ' · 欠货 <span class="font-mono font-bold text-rose-600">' + esc(suggest) + '</span></p>' +
            '<div class="flex items-center gap-1.5 flex-nowrap">' +
            '<div class="flex-1 min-w-0">' + srcSelect + '</div>' +
            '<div class="flex items-center gap-1 shrink-0">' +
            '<label class="text-[10px] text-slate-400 whitespace-nowrap">调货</label>' +
            '<input type="number" min="1" max="' + esc(Math.max(1, avail)) + '" value="' + esc(avail > 0 ? Math.min(suggest, avail) : suggest) + '" ' +
            'data-sf-qty="' + esc(key) + '" data-sf-suggest="' + esc(suggest) + '" class="form-input form-input--compact text-xs font-mono w-[3.75rem] py-1">' +
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

    function shipLineControlsHtml(line) {
        var key = lineKey(line);
        var checked = state.selected.ship[key] ? 'checked' : '';
        var qty = lineSuggestQty(line);
        var plan = line.fulfillmentPlan || line.fulfillment_plan || '';
        var badge = plan === 'TRANSFERRED'
            ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-bold">已调待发</span>'
            : (line.lineKind === 'pending_ship'
                ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-bold">待发</span>'
                : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">欠货可发</span>');
        return '<div class="rounded-lg bg-white border border-slate-100 p-2.5" data-sf-row="' + esc(key) + '">' +
            '<div class="flex items-start gap-2">' +
            '<input type="checkbox" data-sf-check="' + esc(key) + '" data-sf-spu="' + esc(spuKeyOf(line)) + '" class="mt-0.5 rounded border-slate-300 text-brand-600" ' + checked + '>' +
            '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' + badge + '</div>' +
            '<p class="text-[10px] text-slate-400 mt-0.5 truncate">' + esc(line.orderCode || '') +
            (line.customerName ? ' · ' + esc(line.customerName) : '') + '</p>' +
            '<p class="text-[10px] text-slate-500 mt-0.5">发出仓 ' + esc(line.targetWarehouseName || line.sourceWarehouseName || '-') +
            ' · 数量 <span class="font-mono font-bold text-slate-800">' + esc(qty) + '</span></p>' +
            '</div></div></div>';
    }

    function shipSpuHtml(spu) {
        var skuBlocks = spu.skuList.map(function (sku) {
            var linesHtml = sku.lines.map(function (line) {
                return shipLineControlsHtml(line);
            }).join('');
            return '<div class="px-3 py-2 border-t border-slate-50 first:border-0">' +
                '<div class="flex items-center justify-between gap-2 mb-1.5">' +
                '<p class="text-xs font-bold text-slate-700"><span class="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">' +
                esc(sku.skuSpec) + '</span></p>' +
                '<p class="text-[10px] text-slate-400 shrink-0">待发 <span class="font-mono font-bold text-slate-700">' +
                esc(sku.qtyTotal) + '</span></p></div>' +
                '<div class="space-y-2">' + linesHtml + '</div></div>';
        }).join('');
        return '<div class="rounded-xl border border-slate-200 bg-white overflow-hidden mb-3" data-sf-spu="' + esc(spu.key) + '">' +
            spuHeaderHtml(spu, 'ship') + skuBlocks + '</div>';
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
                var skuBlocks = spu.skuList.map(function (sku) {
                    var rows = sku.lines.map(function (line) {
                        var key = lineKey(line);
                        var checked = state.selected.purchase[key] ? 'checked' : '';
                        var qty = lineSuggestQty(line);
                        return '<div class="flex items-start gap-2 py-2 border-t border-slate-50 first:border-0" data-sf-row="' + esc(key) + '">' +
                            '<input type="checkbox" data-sf-check="' + esc(key) + '" data-sf-supplier="' + esc(sid) + '" data-sf-spu="' + esc(spu.key) + '" class="mt-0.5 rounded border-slate-300 text-brand-600" ' + checked + '>' +
                            '<div class="min-w-0 flex-1">' +
                            '<p class="text-[10px] text-slate-400 truncate">' + esc(line.orderCode || '') +
                            (line.customerName ? ' · ' + esc(line.customerName) : '') + '</p>' +
                            '<div class="flex items-center gap-2 mt-1">' +
                            '<label class="text-[10px] text-slate-400">数量</label>' +
                            '<input type="number" min="1" value="' + esc(qty) + '" data-sf-qty="' + esc(key) + '" ' +
                            'class="form-input form-input--compact text-xs font-mono w-20 py-1">' +
                            '</div></div></div>';
                    }).join('');
                    return '<div class="mt-1">' +
                        '<p class="text-[11px] font-bold text-slate-600 mb-0.5"><span class="px-1.5 py-0.5 rounded bg-slate-100">' +
                        esc(sku.skuSpec) + '</span> · 欠货 <span class="font-mono text-rose-600">' + esc(sku.qtyTotal) + '</span></p>' +
                        rows + '</div>';
                }).join('');
                return '<div class="rounded-lg border border-slate-100 bg-slate-50/50 mt-2 overflow-hidden" data-sf-spu="' + esc(spu.key) + '">' +
                    '<div class="flex items-center gap-2 px-2.5 py-2 bg-white border-b border-slate-100">' +
                    '<input type="checkbox" data-sf-spu-check="' + esc(spu.key) + '" class="rounded border-slate-300 text-brand-600 shrink-0">' +
                    '<p class="text-xs font-bold text-slate-800 truncate flex-1">' + esc(spu.spuName) + '</p>' +
                    '<span class="text-[10px] text-slate-400 shrink-0">' + spu.skuList.length + ' 规格</span></div>' +
                    '<div class="px-2.5 pb-2">' + skuBlocks + '</div></div>';
            }).join('');
            var needSupplier = sid === 'none' || sid === '' || sid == null;
            return '<div class="rounded-xl border border-slate-200 bg-white p-3 mb-3" data-sf-group="' + esc(sid) + '">' +
                '<div class="flex items-center justify-between gap-2 mb-1">' +
                '<p class="text-xs font-bold text-slate-700"><i class="ph ph-truck text-brand-500"></i> ' +
                esc(g.supplierName || '未指定供应商') +
                ' <span class="text-slate-400 font-normal">(' + lines.length + ')</span></p>' +
                '<button type="button" class="text-[10px] font-bold text-brand-600" data-sf-select-group="' + esc(sid) + '">全选本组</button>' +
                '</div>' +
                (needSupplier
                    ? '<p class="text-[10px] text-amber-600 mb-1">本组无固定供应商，生成前请先在产品档案绑定，或稍后在进货单中指定</p>'
                    : '') +
                spuHtml + '</div>';
        }).join('');
        bindRowEvents(body);
        body.querySelectorAll('[data-sf-select-group]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sid = btn.getAttribute('data-sf-select-group');
                body.querySelectorAll('[data-sf-supplier="' + sid + '"]').forEach(function (cb) {
                    cb.checked = true;
                    state.selected.purchase[cb.getAttribute('data-sf-check')] = true;
                });
            });
        });
    }

    function bindRowEvents(body) {
        body.querySelectorAll('[data-sf-check]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var key = cb.getAttribute('data-sf-check');
                state.selected[state.tab][key] = !!cb.checked;
                syncSpuCheckbox(body, cb.getAttribute('data-sf-spu'));
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
        if (!body) return;
        body.querySelectorAll('[data-sf-check]').forEach(function (cb) {
            cb.checked = !!on;
            state.selected[state.tab][cb.getAttribute('data-sf-check')] = !!on;
        });
        body.querySelectorAll('[data-sf-spu-check]').forEach(function (cb) {
            cb.checked = !!on;
        });
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
        // 同仓同 SKU 累计校验，避免多行合计超库存
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
            var qty = line.shipQty != null ? line.shipQty
                : (line.suggestQty != null ? line.suggestQty : (line.shortageQty || 0));
            return {
                orderId: line.orderId,
                itemId: line.itemId,
                shippedQty: qty,
                // 已调拨待发：从目标仓发；否则优先源仓/筛选仓
                fromWarehouseId: (line.fulfillmentPlan === 'TRANSFERRED' || line.fulfillment_plan === 'TRANSFERRED')
                    ? (line.targetWarehouseId || warehouseId)
                    : (line.targetWarehouseId || line.sourceWarehouseId || warehouseId)
            };
        });
        try {
            var resp = await global.wrappedFetch('/api/v1/rd/orders/shortage-workbench/ship', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouseId: warehouseId,
                    remark: '欠货履约·' + (state.date || todayISO()),
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
        // 按供应商分组
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
            var qty = qtyInp ? (parseInt(qtyInp.value, 10) || 0) : (line.suggestQty || line.shortageQty || 0);
            groups[sid].lines.push({
                line: line,
                qty: qty,
                itemId: line.itemId
            });
        });

        var keys = Object.keys(groups);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i] === 'none') {
                notify('存在未指定供应商的明细，请先在产品档案绑定供应商，或取消勾选后重试', 'warning');
                return;
            }
        }

        var ok = true;
        if (global.TM_UI && global.TM_UI.confirm) {
            ok = await global.TM_UI.confirm({
                title: '转进货草稿',
                message: '将按 ' + keys.length + ' 个供应商分别生成进货草稿，是否继续？',
                confirmLabel: '生成草稿',
                cancelLabel: '取消'
            });
        }
        if (!ok) return;

        var successN = 0;
        var failMsgs = [];
        var purchaseDate = state.date || todayISO();

        for (var g = 0; g < keys.length; g++) {
            var group = groups[keys[g]];
            var items = [];
            var total = 0;
            var itemIds = [];
            group.lines.forEach(function (x) {
                if (x.qty <= 0) return;
                var price = Number(x.line.unitPrice) || 0;
                items.push({
                    productId: Number(x.line.productId),
                    skuId: x.line.sku_id != null ? x.line.sku_id : x.line.skuId,
                    quantity: x.qty,
                    unitPrice: price,
                    unitName: x.line.purchaseUnit || x.line.base_unit || '',
                    batchNo: ''
                });
                total += x.qty * price;
                itemIds.push(x.itemId);
            });
            if (!items.length) continue;
            try {
                var purchaseData = {
                    supplierId: group.supplierId,
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
                    supplierId: group.supplierId,
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

    function openModal() {
        var modal = $('shortage-fulfillment-modal');
        if (!modal) return;
        bindUi();
        if (!state.date) state.date = todayISO();
        var dateEl = $('sf-date');
        if (dateEl && !dateEl.value) dateEl.value = state.date;
        if (typeof global.TM_openUnifiedModal === 'function') {
            global.TM_openUnifiedModal(modal);
        } else {
            if (typeof global.TM_applyDialogShell === 'function') global.TM_applyDialogShell(modal);
            modal.classList.remove('hidden');
        }
        loadWarehouses().then(loadData);
    }

    function closeModal() {
        var modal = $('shortage-fulfillment-modal');
        if (!modal) return;
        if (typeof global.TM_closeUnifiedModal === 'function') {
            global.TM_closeUnifiedModal(modal);
        } else {
            modal.classList.add('hidden');
        }
    }

    function bindUi() {
        // 使用 onclick 赋值，避免 overlay 重同步后监听丢失，且可重复绑定不叠加
        document.querySelectorAll('[data-sf-tab]').forEach(function (btn) {
            btn.onclick = function () {
                state.tab = btn.getAttribute('data-sf-tab') || 'transfer';
                renderTabs();
                renderList();
            };
        });
        var refresh = $('sf-refresh-btn');
        if (refresh) refresh.onclick = function () { loadData(); };
        var action = $('sf-action-btn');
        if (action) action.onclick = function () { confirmAction(); };
        var allBtn = $('sf-select-all');
        if (allBtn) allBtn.onclick = function () { selectAllVisible(true); };
        var noneBtn = $('sf-select-none');
        if (noneBtn) noneBtn.onclick = function () { selectAllVisible(false); };
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
