/**
 * 极速开单：全屏选品 + 订单弹窗 + 发货方式 + 行业扩展（批次/序列号）
 */
(function () {
    'use strict';

    var cart = new Map();
    var activeCategory = 0;
    var batchCache = new Map();
    var variantSheetSpu = null;
    var variantSheetDetail = null;
    var variantSheetSelection = {};
    var variantSheetQty = 1;

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) window.TM_UI.showNotification(msg, type || 'info');
        else if (window.showToast) window.showToast(msg);
        else alert(msg);
    }

    function industryCaps() {
        var p = window.TM_WorkbenchProfile || {};
        var c = p.capabilities || {};
        return {
            allowExpiry: !!c.allowExpiry,
            allowSerial: !!c.allowSerial,
            vertical: p.industryVertical || 'GENERAL'
        };
    }

    function getCartLine(skuId) {
        var k = String(skuId);
        if (!cart.has(k)) {
            cart.set(k, { qty: 0, batchId: null, serialText: '' });
        }
        return cart.get(k);
    }

    function cartCount() {
        var n = 0;
        cart.forEach(function (line) { n += line.qty || 0; });
        return n;
    }

    function cartLines() {
        var rows = window.TM_SkuCatalogCache ? window.TM_SkuCatalogCache.getRows() : [];
        var out = [];
        cart.forEach(function (line, skuId) {
            if (!line.qty || line.qty <= 0) return;
            var row = rows.find(function (r) { return String(r.skuId) === String(skuId); });
            if (row) out.push({ row: row, line: line, qty: line.qty });
        });
        return out;
    }

    function needsBatch(row) {
        if (!row) return false;
        var caps = industryCaps();
        return !!(row.trackExpiry || (caps.allowExpiry && caps.vertical === 'FOOD'));
    }

    function needsSerial(row) {
        if (!row) return false;
        var caps = industryCaps();
        return !!(row.trackSerial || (caps.allowSerial && caps.vertical === 'DIGITAL_3C'));
    }

    function parseSerialText(text) {
        if (!text) return [];
        return String(text).split(/[\s,，;；\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function applyIndustryUi(root) {
        if (window.TM_IndustryUI) {
            window.TM_IndustryUI.apply(root || document.body, window.TM_WorkbenchProfile);
        }
    }

    function closeRapidOrderModal() {
        if (window.TM_ScanRouter && typeof window.TM_ScanRouter.clearContext === 'function') {
            window.TM_ScanRouter.clearContext();
        }
        var modal = document.getElementById('rapid-order-modal');
        if (!modal) return;
        if (typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        if (typeof window.TM_ensureShellOverlayVisible === 'function') {
            window.TM_ensureShellOverlayVisible();
        }
    }

    function getCustomerLookupMap() {
        if (window.customerLookupById && Object.keys(window.customerLookupById).length) {
            return window.customerLookupById;
        }
        try {
            if (window.parent && window.parent !== window && window.parent.customerLookupById) {
                return window.parent.customerLookupById;
            }
        } catch (e) { /* ignore */ }
        return window.customerMapCache || window.customersCache || {};
    }

    async function fetchCustomersForRop() {
        if (typeof window.loadCustomerList === 'function') {
            await window.loadCustomerList();
        }
        var map = getCustomerLookupMap();
        if (map && Object.keys(map).length) return map;
        if (!window.wrappedFetch) return {};
        try {
            var resp = await window.wrappedFetch('/api/v1/crm/customers', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
            var out = {};
            list.forEach(function (c) {
                var cid = c.cust_id || c.custId || c.id;
                var name = c.name || c.customerName || c.customer_name || '';
                if (cid && name) out[String(cid)] = { id: Number(cid), name: String(name).trim() };
            });
            window.customerLookupById = out;
            return out;
        } catch (e) {
            console.warn('[RapidOrder] 加载客户失败', e);
            return {};
        }
    }

    async function fetchWarehousesForRop() {
        if (!window.wrappedFetch) return [];
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/warehouses', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            return data && data.data ? data.data : (Array.isArray(data) ? data : []);
        } catch (e) {
            console.warn('[RapidOrder] 加载仓库失败', e);
            return [];
        }
    }

    function findSkuRowFromScan(code, decodeResult) {
        var rows = window.TM_SkuCatalogCache ? window.TM_SkuCatalogCache.getRows() : [];
        if (decodeResult && decodeResult.match) {
            var m = decodeResult.match;
            var skuId = m.sku_id || m.skuId;
            var prodId = m.product_id || m.legacy_product_id;
            if (skuId) {
                var hit = rows.find(function (r) { return String(r.skuId) === String(skuId); });
                if (hit) return hit;
            }
            if (prodId) {
                return rows.find(function (r) { return String(r.legacyProductId) === String(prodId); });
            }
        }
        if (!code) return null;
        return rows.find(function (r) {
            return String(r.skuCode || r.sku_code || '') === String(code);
        }) || null;
    }

    async function handleRapidOrderScan(code, decodeResult) {
        var modal = document.getElementById('rapid-order-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        var row = findSkuRowFromScan(code, decodeResult);
        if (!row && window.TM_SkuCatalogCache) {
            var wh = document.getElementById('rop-warehouse');
            var whId = wh && wh.value ? parseInt(wh.value, 10) : null;
            await window.TM_SkuCatalogCache.load(whId, true);
            row = findSkuRowFromScan(code, decodeResult);
        }
        if (!row) {
            notify('未识别条码：' + code, 'error');
            return;
        }
        var line = getCartLine(row.skuId);
        line.qty = (line.qty || 0) + 1;
        updateCartUi();
        await renderOrderLines();
        notify('已添加 ' + row.name, 'success');
    }

    function bindScanRouterForRapidOrder() {
        if (!window.TM_ScanRouter || typeof window.TM_ScanRouter.setContext !== 'function') return;
        window.TM_ScanRouter.setContext({
            name: 'RAPID_ORDER',
            minLength: 3,
            onScan: function (code, decodeResult) {
                handleRapidOrderScan(code, decodeResult);
            }
        });
    }

    function ensurePickerDom() {
        if (document.getElementById('rapid-order-picker')) return;
        var el = document.createElement('div');
        el.id = 'rapid-order-picker';
        el.className = 'hidden';
        el.innerHTML =
            '<div class="rop-header">' +
            '<button type="button" id="rop-back" class="text-sm font-bold text-slate-500">← 返回</button>' +
            '<span class="text-sm font-bold text-slate-800">选择产品</span>' +
            '<button type="button" id="rop-done" class="text-sm font-bold text-teal-600">选好了</button>' +
            '</div>' +
            '<div class="rop-body">' +
            '<nav class="rop-categories" id="rop-categories"></nav>' +
            '<div class="rop-list" id="rop-list"></div>' +
            '</div>' +
            '<button type="button" class="rop-cart-fab" id="rop-cart-fab" aria-label="购物车">' +
            '<i class="ph ph-shopping-cart text-xl"></i>' +
            '<span class="rop-cart-fab__badge" id="rop-cart-badge">0</span></button>' +
            '<div class="rop-cart-sheet" id="rop-cart-sheet">' +
            '<div class="rop-cart-sheet__head flex justify-between"><span>已选商品</span>' +
            '<button type="button" id="rop-cart-close" class="text-slate-400 text-xs">关闭</button></div>' +
            '<div id="rop-cart-list" class="p-3 space-y-2 max-h-[40vh] overflow-y-auto"></div></div>' +
            '<div class="rop-variant-sheet hidden" id="rop-variant-sheet">' +
            '<div class="rop-variant-sheet__mask" id="rop-variant-mask"></div>' +
            '<div class="rop-variant-sheet__panel">' +
            '<div class="rop-variant-sheet__head"><span class="font-bold text-sm">确认款式</span>' +
            '<button type="button" id="rop-variant-close" class="p-1 text-slate-400"><i class="ph ph-x text-lg"></i></button></div>' +
            '<div class="rop-variant-sheet__body" id="rop-variant-body"></div>' +
            '<button type="button" id="rop-variant-confirm" class="rop-variant-sheet__confirm">确定</button></div></div>';
        document.body.appendChild(el);
        el.querySelector('#rop-back').addEventListener('click', closePicker);
        el.querySelector('#rop-done').addEventListener('click', confirmPicker);
        el.querySelector('#rop-cart-fab').addEventListener('click', toggleCartSheet);
        el.querySelector('#rop-cart-close').addEventListener('click', function () {
            document.getElementById('rop-cart-sheet').classList.remove('is-open');
        });
        var vClose = document.getElementById('rop-variant-close');
        var vMask = document.getElementById('rop-variant-mask');
        var vConfirm = document.getElementById('rop-variant-confirm');
        if (vClose) vClose.addEventListener('click', closeVariantSheet);
        if (vMask) vMask.addEventListener('click', closeVariantSheet);
        if (vConfirm) vConfirm.addEventListener('click', confirmVariantSheet);
    }

    function ensureOrderModal() {
        var existing = document.getElementById('rapid-order-modal');
        if (existing && !existing.querySelector('.rop-modal-form-grid')) {
            existing.remove();
            existing = null;
        }
        if (existing) return;
        var modal = document.createElement('div');
        modal.id = 'rapid-order-modal';
        modal.className = 'tm-unified-mobile-modal rop-modal-shell hidden fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-8';
        modal.innerHTML =
            '<div class="rop-modal-panel tm-document-modal bg-white w-full shadow-xl flex flex-col min-h-0">' +
            '<header class="rop-modal-header px-4 py-3 border-b flex justify-between items-center shrink-0">' +
            '<h3 class="font-bold text-slate-800">⚡ 极速开单</h3>' +
            '<div class="flex items-center gap-1">' +
            '<button type="button" id="rop-scan-camera" class="p-2 hover:bg-slate-100 rounded-full text-teal-600" title="相机扫码加 SKU"><i class="ph ph-camera text-lg"></i></button>' +
            '<button type="button" id="rop-modal-close" class="p-2 -mr-2 hover:bg-slate-100 rounded-full" aria-label="关闭">' +
            '<i class="ph ph-x text-lg text-slate-400"></i></button></div></header>' +
            '<main class="rop-modal-body p-4 space-y-3 flex-1 min-h-0 overflow-y-auto">' +
            '<div class="rop-modal-form-grid">' +
            '<div class="rop-field"><label class="text-[10px] font-bold text-slate-400">客户</label>' +
            '<select id="rop-customer" class="form-input form-input--compact w-full text-xs font-bold mt-0.5"></select></div>' +
            '<div class="rop-field"><label class="text-[10px] font-bold text-slate-400">开单仓</label>' +
            '<select id="rop-warehouse" class="form-input form-input--compact w-full text-xs mt-0.5"></select></div>' +
            '<div class="rop-field"><label class="text-[10px] font-bold text-slate-400">收款账户</label>' +
            '<select id="rop-account" class="form-input form-input--compact w-full text-xs mt-0.5"></select></div>' +
            '<div class="rop-field"><label class="text-[10px] font-bold text-slate-400">发货方式</label>' +
            '<select id="rop-fulfillment-type" class="form-input form-input--compact w-full text-xs mt-0.5">' +
            '<option value="SELF_PICKUP">自提（默认）</option>' +
            '<option value="LOGISTICS">发物流</option>' +
            '<option value="DELIVERY_ADDRESS">送指定地点</option>' +
            '<option value="DELIVERY_VEHICLE">送车</option></select></div>' +
            '<div id="rop-logistics-panel" class="rop-fulfillment-panel rop-field-full hidden space-y-2 p-2 rounded-lg bg-slate-50 border border-slate-100">' +
            '<select id="rop-logistics-provider" class="form-input form-input--compact w-full text-xs">' +
            '<option value="">选择物流商</option>' +
            '<option value="SF">顺丰</option><option value="YTO">圆通</option><option value="ZTO">中通</option>' +
            '<option value="STO">申通</option><option value="YD">韵达</option><option value="JD">京东</option>' +
            '<option value="OTHER">其他</option></select>' +
            '<div class="flex gap-2"><input id="rop-tracking-no" class="form-input form-input--compact flex-1 text-xs font-mono" placeholder="运单号" />' +
            '<button type="button" id="rop-scan-tracking" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 shrink-0">扫码</button></div></div>' +
            '<div id="rop-address-panel" class="rop-fulfillment-panel rop-field-full hidden space-y-2 p-2 rounded-lg bg-slate-50 border border-slate-100">' +
            '<input id="rop-addr-contact" class="form-input form-input--compact w-full text-xs" placeholder="联系人" />' +
            '<input id="rop-addr-phone" class="form-input form-input--compact w-full text-xs" placeholder="电话" />' +
            '<input id="rop-addr-detail" class="form-input form-input--compact w-full text-xs" placeholder="详细地址" />' +
            '<input id="rop-addr-vehicle" class="form-input form-input--compact w-full text-xs hidden" placeholder="车牌号" />' +
            '<input id="rop-addr-driver-name" class="form-input form-input--compact w-full text-xs hidden" placeholder="司机姓名" />' +
            '<input id="rop-addr-driver-phone" class="form-input form-input--compact w-full text-xs hidden" placeholder="司机电话" />' +
            '<input id="rop-addr-ship-from" class="form-input form-input--compact w-full text-xs hidden" placeholder="发货地址" /></div>' +
            '</div>' +
            '<p class="text-[10px] text-amber-600 hidden" data-tm-cap-expiry>食品行业：含批次商品请在明细中选择批次</p>' +
            '<p class="text-[10px] text-indigo-600 hidden" data-tm-cap-serial>3C 行业：可在明细中填写序列号（逗号分隔）</p>' +
            '<button type="button" id="rop-open-picker" class="w-full py-2.5 rounded-xl border-2 border-dashed border-teal-200 text-teal-600 text-xs font-bold">' +
            '+ 选择产品</button>' +
            '<div id="rop-lines" class="text-xs space-y-2 min-h-[2rem]"></div>' +
            '<div class="text-right font-mono font-bold text-slate-800 sticky bottom-0 bg-white pt-2">合计 <span id="rop-total">¥0.00</span></div>' +
            '</main>' +
            '<footer class="rop-modal-footer p-4 border-t shrink-0">' +
            '<button type="button" id="rop-submit" class="w-full py-3 rounded-xl bg-teal-500 text-white font-bold text-sm">提交订单</button></footer></div>';
        document.body.appendChild(modal);
        modal.querySelector('#rop-modal-close').addEventListener('click', closeRapidOrderModal);
        modal.querySelector('#rop-open-picker').addEventListener('click', openPicker);
        modal.querySelector('#rop-submit').addEventListener('click', submitOrder);
        modal.querySelector('#rop-fulfillment-type').addEventListener('change', syncFulfillmentPanel);
        var scanBtn = modal.querySelector('#rop-scan-tracking');
        if (scanBtn) {
            scanBtn.addEventListener('click', scanTrackingNo);
        }
        var camBtn = modal.querySelector('#rop-scan-camera');
        if (camBtn) {
            camBtn.addEventListener('click', function () {
                if (!window.TM_ScanCamera) {
                    notify('相机扫码未加载', 'error');
                    return;
                }
                window.TM_ScanCamera.open({
                    context: 'RAPID_ORDER',
                    onScan: function (code, decodeResult) {
                        handleRapidOrderScan(code, decodeResult);
                    }
                });
            });
        }
        modal.querySelector('#rop-warehouse').addEventListener('change', function () {
            batchCache.clear();
            renderOrderLines();
        });
        applyIndustryUi(modal);
    }

    function formatStockDisplay(stock) {
        var n = Number(stock);
        if (isNaN(n)) n = 0;
        if (n < 0) return '欠货 ' + Math.abs(n);
        return '库存 ' + n;
    }

    function syncFulfillmentPanel() {
        var type = document.getElementById('rop-fulfillment-type').value;
        var addrPanel = document.getElementById('rop-address-panel');
        var logPanel = document.getElementById('rop-logistics-panel');
        var veh = document.getElementById('rop-addr-vehicle');
        var driverName = document.getElementById('rop-addr-driver-name');
        var driverPhone = document.getElementById('rop-addr-driver-phone');
        var shipFrom = document.getElementById('rop-addr-ship-from');
        if (logPanel) logPanel.classList.toggle('hidden', type !== 'LOGISTICS');
        if (addrPanel) {
            var needAddr = type === 'DELIVERY_ADDRESS' || type === 'DELIVERY_VEHICLE';
            addrPanel.classList.toggle('hidden', !needAddr);
        }
        var isVehicle = type === 'DELIVERY_VEHICLE';
        if (veh) veh.classList.toggle('hidden', !isVehicle);
        if (driverName) driverName.classList.toggle('hidden', !isVehicle);
        if (driverPhone) driverPhone.classList.toggle('hidden', !isVehicle);
        if (shipFrom) shipFrom.classList.toggle('hidden', !isVehicle);
    }

    function scanTrackingNo() {
        if (!window.TmSerialCapture || typeof window.TmSerialCapture.open !== 'function') {
            notify('扫码组件未加载', 'error');
            return;
        }
        window.TmSerialCapture.open({
            mode: 'tracking',
            expectedQty: 1,
            onComplete: function (serials) {
                var inp = document.getElementById('rop-tracking-no');
                if (inp && serials && serials.length) inp.value = serials[0];
            }
        });
    }

    async function fetchAccountsForRop() {
        if (typeof window.loadBizAccounts === 'function') {
            await window.loadBizAccounts();
        }
        return window.bizAccountsList || [];
    }

    async function confirmShortageIfNeeded(lines) {
        var shortages = lines.filter(function (x) {
            var stock = Number(x.row.stock != null ? x.row.stock : 0);
            return stock < x.qty;
        });
        if (!shortages.length) return true;
        var msg = shortages.map(function (x) {
            var stock = Number(x.row.stock != null ? x.row.stock : 0);
            var lack = x.qty - Math.max(0, stock);
            return x.row.name + '：需 ' + x.qty + '，可用 ' + stock + '，欠 ' + lack;
        }).join('\n');
        var fullMsg = '以下商品库存不足，是否欠货开单？\n\n' + msg;
        if (window.TM_UI && typeof window.TM_UI.confirm === 'function') {
            return window.TM_UI.confirm({ title: '库存不足', message: fullMsg, confirmLabel: '欠货开单', cancelLabel: '返回修改' });
        }
        if (window.TmConfirm && typeof window.TmConfirm.open === 'function') {
            return new Promise(function (resolve) {
                window.TmConfirm.open({
                    title: '库存不足',
                    message: fullMsg,
                    confirmLabel: '欠货开单',
                    cancelLabel: '返回修改',
                    onConfirm: function () { resolve(true); },
                    onCancel: function () { resolve(false); }
                });
            });
        }
        return window.confirm(fullMsg);
    }

    function renderCategories() {
        var nav = document.getElementById('rop-categories');
        if (!nav || !window.TM_SkuCatalogCache) return;
        var cats = window.TM_SkuCatalogCache.getCategories();
        nav.innerHTML = cats.map(function (c) {
            return '<button type="button" class="rop-cat-btn' + (c.id === activeCategory ? ' is-active' : '') +
                '" data-cid="' + c.id + '">' + c.name + '</button>';
        }).join('');
        nav.querySelectorAll('.rop-cat-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeCategory = parseInt(btn.dataset.cid, 10) || 0;
                renderCategories();
                renderProductList();
            });
        });
    }

    function getSpuCartLines(spuKey) {
        var out = [];
        cart.forEach(function (line, skuId) {
            if (!line.qty || line.qty <= 0) return;
            var row = window.TM_SkuCatalogCache.findSkuById(skuId);
            if (!row) return;
            var sid = row.spuId != null ? String(row.spuId) : ('legacy-' + (row.legacyProductId || row.skuId));
            if (sid === spuKey) out.push({ row: row, line: line, qty: line.qty });
        });
        return out;
    }

    function closeVariantSheet() {
        var sheet = document.getElementById('rop-variant-sheet');
        if (sheet) sheet.classList.add('hidden');
        variantSheetSpu = null;
        variantSheetDetail = null;
        variantSheetSelection = {};
        variantSheetQty = 1;
    }

    async function openVariantSheet(spuGroup) {
        variantSheetSpu = spuGroup;
        variantSheetSelection = {};
        variantSheetQty = 1;
        var sheet = document.getElementById('rop-variant-sheet');
        if (!sheet) return;
        sheet.classList.remove('hidden');
        var body = document.getElementById('rop-variant-body');
        if (body) body.innerHTML = '<p class="text-center text-slate-400 text-xs py-8">加载规格…</p>';
        var whEl = document.getElementById('rop-warehouse');
        var whId = whEl && whEl.value ? parseInt(whEl.value, 10) : null;
        try {
            if (spuGroup.spuId && window.TM_MasterDataCache) {
                variantSheetDetail = await window.TM_MasterDataCache.getSpuDetail(spuGroup.spuId, whId);
            } else if (spuGroup.spuId && window.wrappedFetch) {
                var qs = whId ? ('?warehouseId=' + whId) : '';
                var resp = await window.wrappedFetch('/api/v1/rd/products/spu/' + spuGroup.spuId + qs, { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                variantSheetDetail = data && data.data ? data.data : data;
            } else {
                variantSheetDetail = { skus: spuGroup.skus };
            }
        } catch (e) {
            variantSheetDetail = { skus: spuGroup.skus };
        }
        if (!variantSheetDetail || !variantSheetDetail.skus || !variantSheetDetail.skus.length) {
            variantSheetDetail = { skus: spuGroup.skus };
        }
        renderVariantSheetBody();
    }

    function normalizeSkuAttrs(sku) {
        if (window.TM_ProductDomain && window.TM_ProductDomain.parseSkuAttributes) {
            return window.TM_ProductDomain.parseSkuAttributes(sku.attributes || sku.attrs);
        }
        var attrs = sku.attributes || sku.attrs || {};
        if (typeof attrs === 'string') {
            try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
        }
        return attrs || {};
    }

    function getSkuCoverUrl(sku, fallback) {
        if (!sku) return fallback || null;
        return sku.coverUrl || sku.cover_url || fallback || null;
    }

    function getAllSpecDims(skus) {
        var dims = {};
        skus.forEach(function (sku) {
            var attrs = normalizeSkuAttrs(sku);
            Object.keys(attrs).forEach(function (k) {
                if (!dims[k]) dims[k] = [];
                if (dims[k].indexOf(attrs[k]) < 0) dims[k].push(attrs[k]);
            });
        });
        if (!Object.keys(dims).length && skus.length) {
            skus.forEach(function (sku) {
                var label = sku.specDisplay || sku.attributes_display || sku.attributesDisplay || ('SKU#' + (sku.skuId || sku.sku_id));
                dims['规格'] = dims['规格'] || [];
                if (dims['规格'].indexOf(label) < 0) dims['规格'].push(label);
            });
        }
        return dims;
    }

    function skuMatchesSelection(sku, selection, partial) {
        var attrs = normalizeSkuAttrs(sku);
        var selKeys = Object.keys(selection).filter(function (k) { return selection[k]; });
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
            var dimCount = Object.keys(allDims).length;
            if (selKeys.length < dimCount) return false;
        }
        return true;
    }

    function isSpecValueAvailable(dim, val, selection, skus) {
        var test = Object.assign({}, selection);
        test[dim] = val;
        return skus.some(function (sku) { return skuMatchesSelection(sku, test, true); });
    }

    function resolveBestDisplaySku(selection, skus) {
        var exact = null;
        var selKeys = Object.keys(selection).filter(function (k) { return selection[k]; });
        if (!selKeys.length) return skus[0] || null;
        for (var i = 0; i < skus.length; i++) {
            if (skuMatchesSelection(skus[i], selection, false)) {
                exact = skus[i];
                break;
            }
        }
        if (exact) return exact;
        var best = null;
        var bestScore = -1;
        skus.forEach(function (sku) {
            var score = 0;
            var attrs = normalizeSkuAttrs(sku);
            selKeys.forEach(function (k) {
                if (k === '规格') {
                    var label = sku.specDisplay || sku.attributes_display || sku.attributesDisplay;
                    if (label === selection[k]) score++;
                } else if (String(attrs[k]) === String(selection[k])) {
                    score++;
                }
            });
            if (score > bestScore) {
                bestScore = score;
                best = sku;
            }
        });
        return best;
    }

    function renderVariantSheetBody() {
        var body = document.getElementById('rop-variant-body');
        if (!body || !variantSheetSpu) return;
        var spu = variantSheetSpu;
        var detail = variantSheetDetail || {};
        var skus = detail.skus || spu.skus || [];
        var displaySku = resolveBestDisplaySku(variantSheetSelection, skus);
        var coverUrl = getSkuCoverUrl(displaySku, spu.coverUrl);
        var thumb = window.TM_ProductThumb ? window.TM_ProductThumb.html({ coverUrl: coverUrl, size: 72, alt: spu.name }) : '';
        var price = displaySku && (displaySku.price != null) ? displaySku.price : (spu.minPrice != null ? spu.minPrice : (skus[0] && skus[0].price));
        var dims = getAllSpecDims(skus);
        var dimHtml = Object.keys(dims).map(function (dim) {
            return '<div class="rop-spec-group"><p class="rop-spec-group__label">' + dim + '</p><div class="rop-spec-chips">'
                + dims[dim].map(function (val) {
                    var on = variantSheetSelection[dim] === val ? ' is-on' : '';
                    var available = isSpecValueAvailable(dim, val, variantSheetSelection, skus);
                    var dis = available ? '' : ' is-disabled';
                    return '<button type="button" class="rop-spec-chip' + on + dis + '" data-dim="' + dim + '" data-val="' + val + '"'
                        + (available ? '' : ' disabled') + '>' + val + '</button>';
                }).join('') + '</div></div>';
        }).join('');
        body.innerHTML = '<div class="rop-variant-hero">' + thumb +
            '<div class="rop-variant-hero__info"><p class="rop-variant-hero__price">¥' + Number(price || 0).toFixed(2) + '</p>' +
            '<p class="rop-variant-hero__name">' + spu.name + '</p>' +
            '<div class="rop-variant-qty"><button type="button" id="rop-vqty-dec">−</button><span id="rop-vqty-val">' + variantSheetQty + '</span><button type="button" id="rop-vqty-inc">+</button></div></div></div>' +
            dimHtml;
        body.querySelectorAll('.rop-spec-chip:not(.is-disabled)').forEach(function (chip) {
            chip.addEventListener('click', function () {
                variantSheetSelection[chip.getAttribute('data-dim')] = chip.getAttribute('data-val');
                renderVariantSheetBody();
            });
        });
        var dec = document.getElementById('rop-vqty-dec');
        var inc = document.getElementById('rop-vqty-inc');
        if (dec) dec.addEventListener('click', function () { variantSheetQty = Math.max(1, variantSheetQty - 1); renderVariantSheetBody(); });
        if (inc) inc.addEventListener('click', function () { variantSheetQty += 1; renderVariantSheetBody(); });
    }

    function resolveSkuFromVariantSelection() {
        var detail = variantSheetDetail || {};
        var skus = detail.skus || (variantSheetSpu && variantSheetSpu.skus) || [];
        var selKeys = Object.keys(variantSheetSelection).filter(function (k) { return variantSheetSelection[k]; });
        if (!selKeys.length && skus.length === 1) return skus[0];
        for (var i = 0; i < skus.length; i++) {
            if (skuMatchesSelection(skus[i], variantSheetSelection, false)) {
                return skus[i];
            }
        }
        return null;
    }

    function confirmVariantSheet() {
        var sku = resolveSkuFromVariantSelection();
        if (!sku) {
            notify('请选择完整规格', 'warning');
            return;
        }
        var skuId = sku.sku_id || sku.skuId;
        patchCatalogFromSku(sku, variantSheetSpu);
        var line = getCartLine(skuId);
        line.qty = (line.qty || 0) + variantSheetQty;
        closeVariantSheet();
        updateCartUi();
        renderProductList();
    }

    function patchCatalogFromSku(sku, spuGroup) {
        if (!window.TM_SkuCatalogCache || !sku) return;
        var sid = sku.sku_id || sku.skuId;
        var rows = window.TM_SkuCatalogCache.getRows();
        var existing = rows.find(function (r) { return String(r.skuId) === String(sid); });
        var price = Number(sku.price != null ? sku.price : (sku.salePrice != null ? sku.salePrice : 0));
        if (price <= 0 && existing && existing.price > 0) price = existing.price;
        if (price <= 0 && spuGroup) {
            if (spuGroup.minPrice > 0) {
                price = spuGroup.minPrice;
            } else if (spuGroup.skus && spuGroup.skus.length) {
                var cached = spuGroup.skus.find(function (s) { return String(s.skuId) === String(sid); });
                if (cached && cached.price > 0) price = cached.price;
            }
        }
        var spec = sku.attributes_display || sku.attributesDisplay || sku.specDisplay || '';
        if (!spec && sku.attributes && typeof sku.attributes === 'object') {
            spec = Object.keys(sku.attributes).map(function (k) { return sku.attributes[k]; }).join(' / ');
        }
        var patch = {
            skuId: sid,
            spuId: sku.spu_id || sku.spuId || (spuGroup && spuGroup.spuId),
            name: (spuGroup && spuGroup.name) || (existing && existing.name) || '',
            specDisplay: spec || (existing && existing.specDisplay) || '',
            price: price,
            stock: Number(sku.stock != null ? sku.stock : (sku.warehouseStock != null ? sku.warehouseStock : (existing && existing.stock) || 0)),
            coverUrl: getSkuCoverUrl(sku, (spuGroup && spuGroup.coverUrl) || (existing && existing.coverUrl) || null),
            legacyProductId: sku.legacy_product_id || sku.legacyProductId || (existing && existing.legacyProductId),
            attributes: sku.attributes || (existing && existing.attributes) || {}
        };
        if (existing) {
            Object.assign(existing, patch);
        } else {
            rows.push(patch);
        }
    }

    function renderProductList() {
        var list = document.getElementById('rop-list');
        if (!list || !window.TM_SkuCatalogCache) return;
        var groups = window.TM_SkuCatalogCache.groupBySpu(activeCategory);
        list.innerHTML = groups.map(function (g) {
            var thumb = window.TM_ProductThumb ? window.TM_ProductThumb.html({ coverUrl: g.coverUrl, size: 64, alt: g.name }) : '';
            var selected = getSpuCartLines(g.key);
            var selHtml = selected.map(function (x) {
                var spec = x.row.specDisplay || '默认';
                return '<div class="rop-spu-sel-row">' +
                    '<span class="rop-spu-sel-spec">' + spec + '</span>' +
                    '<span class="rop-spu-sel-qty">×' + x.qty + '</span>' +
                    '<button type="button" class="rop-spu-sel-del" data-sku="' + x.row.skuId + '"><i class="ph ph-x"></i></button></div>';
            }).join('');
            var footer = g.hasVariants
                ? ('<button type="button" class="rop-spu-add-variant" data-spu-key="' + g.key + '">再选一款 +</button>')
                : (function () {
                    var sku = g.skus[0];
                    var line = getCartLine(sku.skuId);
                    return '<div class="rop-qty rop-qty--inline"><button type="button" data-act="dec" data-sku="' + sku.skuId + '">−</button>' +
                        '<span>' + (line.qty || 0) + '</span><button type="button" data-act="inc" data-sku="' + sku.skuId + '">+</button></div>';
                })();
            return '<div class="rop-spu-item" data-spu-key="' + g.key + '">' +
                '<div class="rop-spu-item__main">' + thumb +
                '<div class="rop-spu-item__info"><div class="rop-spu-item__name">' + g.name + '</div>' +
                '<div class="rop-spu-item__meta">¥' + Number(g.minPrice || 0).toFixed(2) + ' · 库存 ' + g.totalStock + '</div></div></div>' +
                (selHtml ? ('<div class="rop-spu-sel-list">' + selHtml + '</div>') : '') +
                footer + '</div>';
        }).join('') || '<p class="text-center text-slate-400 text-sm py-8">暂无商品</p>';
        list.querySelectorAll('.rop-spu-add-variant').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.getAttribute('data-spu-key');
                var g = groups.find(function (x) { return x.key === key; });
                if (g) openVariantSheet(g);
            });
        });
        list.querySelectorAll('.rop-spu-item__main').forEach(function (main) {
            main.addEventListener('click', function () {
                var item = main.closest('.rop-spu-item');
                var key = item && item.getAttribute('data-spu-key');
                var g = groups.find(function (x) { return x.key === key; });
                if (g && g.hasVariants) openVariantSheet(g);
            });
        });
        list.querySelectorAll('.rop-qty button, .rop-qty--inline button').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var sku = String(btn.dataset.sku);
                var line = getCartLine(sku);
                if (btn.dataset.act === 'inc') line.qty = (line.qty || 0) + 1;
                else line.qty = Math.max(0, (line.qty || 0) - 1);
                updateCartUi();
                renderProductList();
            });
        });
        list.querySelectorAll('.rop-spu-sel-del').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                cart.delete(String(btn.getAttribute('data-sku')));
                updateCartUi();
                renderProductList();
            });
        });
    }

    function updateCartUi() {
        var fab = document.getElementById('rop-cart-fab');
        var badge = document.getElementById('rop-cart-badge');
        var n = cartCount();
        if (fab) fab.classList.toggle('has-items', n > 0);
        if (badge) badge.textContent = String(n);
        var cartList = document.getElementById('rop-cart-list');
        if (cartList) {
            cartList.innerHTML = cartLines().map(function (x) {
                var spec = x.row.specDisplay ? (' · ' + x.row.specDisplay) : '';
                return '<div class="flex justify-between text-xs"><span>' + x.row.name + spec + ' ×' + x.qty + '</span>' +
                    '<span class="font-mono">¥' + (x.row.price * x.qty).toFixed(2) + '</span></div>';
            }).join('') || '<p class="text-slate-400 text-center text-xs">购物车为空</p>';
        }
    }

    function toggleCartSheet() {
        var sheet = document.getElementById('rop-cart-sheet');
        if (sheet) sheet.classList.toggle('is-open');
    }

    async function loadBatchesForSku(skuId) {
        var key = String(skuId);
        if (batchCache.has(key)) return batchCache.get(key);
        var whEl = document.getElementById('rop-warehouse');
        var whId = whEl && whEl.value ? parseInt(whEl.value, 10) : null;
        var qs = whId ? ('?warehouseId=' + whId) : '';
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/inventory/sku/' + skuId + '/batches' + qs, { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var list = data && data.data ? data.data : [];
            batchCache.set(key, list);
            return list;
        } catch (e) {
            batchCache.set(key, []);
            return [];
        }
    }

    function batchSelectHtml(skuId, selectedId, batches) {
        var opts = '<option value="">选择批次</option>';
        (batches || []).forEach(function (b) {
            var id = b.batch_id || b.batchId;
            var label = b.batch_no || b.batchNo || ('批次#' + id);
            var exp = b.expiry_date || b.expiryDate;
            if (exp) label += ' 效期' + String(exp).slice(0, 10);
            opts += '<option value="' + id + '"' + (String(selectedId) === String(id) ? ' selected' : '') + '>' + label + '</option>';
        });
        return '<select class="rop-line-batch form-input form-input--compact w-full text-[10px] mt-1" data-sku="' + skuId + '">' + opts + '</select>';
    }

    async function renderOrderLines() {
        var box = document.getElementById('rop-lines');
        var totalEl = document.getElementById('rop-total');
        if (!box) return;
        var lines = cartLines();
        if (!lines.length) {
            box.innerHTML = '<p class="text-slate-400">请点击「选择产品」</p>';
            if (totalEl) totalEl.textContent = '¥0.00';
            return;
        }
        var sum = 0;
        var batchNeeds = lines.filter(function (x) { return needsBatch(x.row); });
        var batchResults = await Promise.all(batchNeeds.map(function (x) {
            return loadBatchesForSku(x.row.skuId).then(function (batches) {
                return { skuId: x.row.skuId, batches: batches };
            });
        }));
        var batchMap = {};
        batchResults.forEach(function (br) { batchMap[br.skuId] = br.batches; });

        var htmlParts = [];
        for (var i = 0; i < lines.length; i++) {
            var x = lines[i];
            sum += x.row.price * x.qty;
            var thumb = window.TM_ProductThumb ? window.TM_ProductThumb.html({ coverUrl: x.row.coverUrl, size: 32, alt: x.row.name }) : '';
            var extras = '';
            if (needsBatch(x.row)) {
                extras += batchSelectHtml(x.row.skuId, x.line.batchId, batchMap[x.row.skuId] || []);
            }
            if (needsSerial(x.row)) {
                extras += '<input type="text" class="rop-line-serial form-input form-input--compact w-full text-[10px] mt-1" ' +
                    'data-sku="' + x.row.skuId + '" placeholder="序列号，逗号分隔" value="' +
                    (x.line.serialText || '').replace(/"/g, '&quot;') + '" />';
            }
            htmlParts.push(
                '<div class="rop-order-line flex gap-2 py-2 border-b border-slate-50" data-sku="' + x.row.skuId + '">' +
                thumb +
                '<div class="flex-1 min-w-0">' +
                '<div class="flex justify-between gap-2"><span class="truncate font-bold text-slate-700">' + x.row.name + ' ×' + x.qty + '</span>' +
                '<span class="font-mono shrink-0">¥' + (x.row.price * x.qty).toFixed(2) + '</span></div>' +
                (x.row.specDisplay ? '<div class="text-[10px] text-slate-400 truncate">' + x.row.specDisplay + '</div>' : '') +
                extras +
                '</div></div>'
            );
        }
        box.innerHTML = htmlParts.join('');
        box.querySelectorAll('.rop-line-batch').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var line = getCartLine(sel.dataset.sku);
                line.batchId = sel.value ? parseInt(sel.value, 10) : null;
            });
        });
        box.querySelectorAll('.rop-line-serial').forEach(function (inp) {
            inp.addEventListener('input', function () {
                var line = getCartLine(inp.dataset.sku);
                line.serialText = inp.value;
            });
        });
        if (totalEl) totalEl.textContent = '¥' + sum.toFixed(2);
    }

    async function openPicker() {
        ensurePickerDom();
        var wh = document.getElementById('rop-warehouse');
        var whId = wh && wh.value ? parseInt(wh.value, 10) : null;
        if (window.TM_SkuCatalogCache) await window.TM_SkuCatalogCache.load(whId, false);
        activeCategory = 0;
        renderCategories();
        renderProductList();
        updateCartUi();
        document.getElementById('rapid-order-picker').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closePicker() {
        var p = document.getElementById('rapid-order-picker');
        if (p) p.classList.add('hidden');
        document.getElementById('rop-cart-sheet').classList.remove('is-open');
        if (!document.getElementById('rapid-order-modal') || document.getElementById('rapid-order-modal').classList.contains('hidden')) {
            document.body.style.overflow = '';
        }
    }

    function confirmPicker() {
        renderOrderLines();
        closePicker();
    }

    async function populateCustomersAndWarehouses() {
        var custMap = await fetchCustomersForRop();
        var custSel = document.getElementById('rop-customer');
        if (custSel) {
            custSel.innerHTML = '<option value="">选择客户</option>';
            Object.keys(custMap).forEach(function (cid) {
                var c = custMap[cid];
                if (!c || !c.name) return;
                var o = document.createElement('option');
                o.value = String(c.id != null ? c.id : cid);
                o.textContent = c.name;
                custSel.appendChild(o);
            });
            var defCust = window.TM_WorkbenchProfile && window.TM_WorkbenchProfile.uiProfile &&
                (window.TM_WorkbenchProfile.uiProfile.defaultCustomerId ||
                    window.TM_WorkbenchProfile.uiProfile.default_customer_id);
            if (defCust) custSel.value = String(defCust);
        }
        var whList = await fetchWarehousesForRop();
        var whSel = document.getElementById('rop-warehouse');
        if (whSel) {
            whSel.innerHTML = '<option value="">默认仓库</option>';
            whList.forEach(function (w) {
                var o = document.createElement('option');
                o.value = w.warehouseId || w.warehouse_id || w.id;
                o.textContent = w.warehouseName || w.name || ('仓#' + o.value);
                whSel.appendChild(o);
            });
            var def = window.TM_WorkbenchProfile && window.TM_WorkbenchProfile.defaultFulfillmentWarehouseId &&
                window.TM_WorkbenchProfile.defaultFulfillmentWarehouseId();
            if (def) whSel.value = String(def);
        }
        var accList = await fetchAccountsForRop();
        var accSel = document.getElementById('rop-account');
        if (accSel) {
            accSel.innerHTML = '<option value="">默认收款账户</option>';
            accList.forEach(function (a) {
                var o = document.createElement('option');
                o.value = a.accountId || a.account_id;
                o.textContent = a.accountName || a.account_name || ('账户#' + o.value);
                accSel.appendChild(o);
            });
            var ui = window.TM_WorkbenchProfile && window.TM_WorkbenchProfile.uiProfile;
            var defAcc = ui && (ui.defaultAccountId || ui.default_account_id);
            if (!defAcc) {
                var defItem = accList.find(function (a) {
                    return a.isDefaultReceive === true || a.isDefaultReceive === 1 || a.isDefaultReceive === 't';
                });
                if (defItem) defAcc = defItem.accountId || defItem.account_id;
            }
            if (defAcc) accSel.value = String(defAcc);
        }
    }

    window.TM_openRapidOrder = async function () {
        ensureOrderModal();
        ensurePickerDom();
        cart.clear();
        batchCache.clear();
        if (window.TM_loadWorkbenchProfile) await window.TM_loadWorkbenchProfile();
        applyIndustryUi(document.getElementById('rapid-order-modal'));
        await populateCustomersAndWarehouses();
        if (window.TM_SkuCatalogCache) {
            window.TM_SkuCatalogCache.warmFromSession();
            var wh = document.getElementById('rop-warehouse');
            var whId = wh && wh.value ? parseInt(wh.value, 10) : null;
            await window.TM_SkuCatalogCache.load(whId, false);
        }
        await renderOrderLines();
        syncFulfillmentPanel();
        bindScanRouterForRapidOrder();
        var modal = document.getElementById('rapid-order-modal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (typeof window.TM_openUnifiedModal === 'function') window.TM_openUnifiedModal(modal);
    };

    async function submitOrder() {
        var custId = parseInt(document.getElementById('rop-customer').value, 10);
        if (!custId) { notify('请选择客户', 'error'); return; }
        var lines = cartLines();
        if (!lines.length) { notify('请先选择产品', 'error'); return; }
        var proceed = await confirmShortageIfNeeded(lines);
        if (!proceed) return;
        var whId = document.getElementById('rop-warehouse').value;
        var warehouseId = whId ? parseInt(whId, 10) : null;
        var accVal = document.getElementById('rop-account') && document.getElementById('rop-account').value;
        var accountId = accVal ? parseInt(accVal, 10) : null;
        var ft = document.getElementById('rop-fulfillment-type').value;
        var items = [];
        for (var i = 0; i < lines.length; i++) {
            var x = lines[i];
            var pid = x.row.legacyProductId || x.row.skuId;
            var item = {
                productId: pid,
                skuId: x.row.skuId,
                quantity: x.qty,
                unitPrice: x.row.price,
                totalAmount: Math.round(x.row.price * x.qty * 100) / 100,
                itemStatus: 'D011001'
            };
            if (needsBatch(x.row) && x.line.batchId) {
                item.batchId = x.line.batchId;
            }
            if (needsSerial(x.row)) {
                var serialNos = parseSerialText(x.line.serialText);
                if (serialNos.length) item.serialNos = serialNos;
            }
            items.push(item);
        }
        var grand = items.reduce(function (s, it) { return s + it.totalAmount; }, 0);
        var addrSnap = null;
        var logisticsProvider = null;
        var logisticsTrackingNo = null;
        if (ft === 'LOGISTICS') {
            logisticsProvider = (document.getElementById('rop-logistics-provider').value || '').trim();
            logisticsTrackingNo = (document.getElementById('rop-tracking-no').value || '').trim();
            addrSnap = { provider: logisticsProvider, trackingNo: logisticsTrackingNo };
        } else if (ft === 'DELIVERY_ADDRESS') {
            addrSnap = {
                contactName: document.getElementById('rop-addr-contact').value.trim(),
                contactPhone: document.getElementById('rop-addr-phone').value.trim(),
                detail: document.getElementById('rop-addr-detail').value.trim()
            };
        } else if (ft === 'DELIVERY_VEHICLE') {
            addrSnap = {
                contactName: document.getElementById('rop-addr-contact').value.trim(),
                contactPhone: document.getElementById('rop-addr-phone').value.trim(),
                detail: document.getElementById('rop-addr-detail').value.trim(),
                vehiclePlate: document.getElementById('rop-addr-vehicle').value.trim(),
                driverName: document.getElementById('rop-addr-driver-name').value.trim(),
                driverPhone: document.getElementById('rop-addr-driver-phone').value.trim(),
                shipFromAddress: document.getElementById('rop-addr-ship-from').value.trim()
            };
        }
        var payload = {
            allowShortage: true,
            order: {
                custId: custId,
                accountId: accountId,
                totalAmount: grand,
                orderStatus: 'D010001',
                finStatus: 'UNPAID',
                allowShortage: true,
                fulfillmentType: ft,
                fulfillmentWarehouseId: warehouseId,
                warehouseId: warehouseId,
                logisticsProvider: logisticsProvider,
                logisticsTrackingNo: logisticsTrackingNo,
                fulfillmentAddressSnapshot: addrSnap
            },
            orderItems: items
        };
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var data = await window.handleApiResponse(resp);
            if (!data) return;
            var saved = data.data || {};
            var orderId = saved.orderId || saved.order_id || saved.id;
            notify('订单已创建', 'success');
            closeRapidOrderModal();
            cart.clear();
            batchCache.clear();
            if (typeof window.loadInProgressOrders === 'function') window.loadInProgressOrders();
            if (orderId && window.TM_PrintTriggers && window.TM_PrintTriggers.offerPrintAfterCreate) {
                await window.TM_PrintTriggers.offerPrintAfterCreate(orderId);
            }
        } catch (e) {
            notify(e.message || '提交失败', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (window.TM_SkuCatalogCache) window.TM_SkuCatalogCache.warmFromSession();
    });
})();
