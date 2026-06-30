/**
 * 极速开单：全屏选品 + 订单弹窗 + 发货方式 + 行业扩展（批次/序列号）
 */
(function () {
    'use strict';

    var cart = new Map();
    var activeCategory = 0;
    var batchCache = new Map();

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
            '<div id="rop-cart-list" class="p-3 space-y-2 max-h-[40vh] overflow-y-auto"></div></div>';
        document.body.appendChild(el);
        el.querySelector('#rop-back').addEventListener('click', closePicker);
        el.querySelector('#rop-done').addEventListener('click', confirmPicker);
        el.querySelector('#rop-cart-fab').addEventListener('click', toggleCartSheet);
        el.querySelector('#rop-cart-close').addEventListener('click', function () {
            document.getElementById('rop-cart-sheet').classList.remove('is-open');
        });
    }

    function ensureOrderModal() {
        if (document.getElementById('rapid-order-modal')) return;
        var modal = document.createElement('div');
        modal.id = 'rapid-order-modal';
        modal.className = 'tm-unified-mobile-modal hidden fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-8';
        modal.innerHTML =
            '<div class="tm-document-modal bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">' +
            '<div class="px-4 py-3 border-b flex justify-between items-center">' +
            '<h3 class="font-bold text-slate-800">⚡ 极速开单</h3>' +
            '<button type="button" id="rop-modal-close" class="text-slate-400"><i class="ph ph-x text-lg"></i></button></div>' +
            '<div class="p-4 space-y-3 overflow-y-auto flex-1">' +
            '<div><label class="text-[10px] font-bold text-slate-400">客户</label>' +
            '<select id="rop-customer" class="form-input form-input--compact w-full text-xs font-bold mt-0.5"></select></div>' +
            '<div><label class="text-[10px] font-bold text-slate-400">开单仓</label>' +
            '<select id="rop-warehouse" class="form-input form-input--compact w-full text-xs mt-0.5"></select></div>' +
            '<div><label class="text-[10px] font-bold text-slate-400">发货方式</label>' +
            '<select id="rop-fulfillment-type" class="form-input form-input--compact w-full text-xs mt-0.5">' +
            '<option value="SELF_PICKUP">自提（默认）</option>' +
            '<option value="LOGISTICS">发物流</option>' +
            '<option value="DELIVERY_ADDRESS">送指定地点</option>' +
            '<option value="DELIVERY_VEHICLE">送车</option></select></div>' +
            '<div id="rop-address-panel" class="rop-fulfillment-panel hidden space-y-2 p-2 rounded-lg bg-slate-50 border border-slate-100">' +
            '<input id="rop-addr-contact" class="form-input form-input--compact w-full text-xs" placeholder="联系人" />' +
            '<input id="rop-addr-phone" class="form-input form-input--compact w-full text-xs" placeholder="电话" />' +
            '<input id="rop-addr-detail" class="form-input form-input--compact w-full text-xs" placeholder="详细地址" />' +
            '<input id="rop-addr-vehicle" class="form-input form-input--compact w-full text-xs hidden" placeholder="车牌号" /></div>' +
            '<p class="text-[10px] text-amber-600 hidden" data-tm-cap-expiry>食品行业：含批次商品请在明细中选择批次</p>' +
            '<p class="text-[10px] text-indigo-600 hidden" data-tm-cap-serial>3C 行业：可在明细中填写序列号（逗号分隔）</p>' +
            '<button type="button" id="rop-open-picker" class="w-full py-2.5 rounded-xl border-2 border-dashed border-teal-200 text-teal-600 text-xs font-bold">' +
            '+ 选择产品</button>' +
            '<div id="rop-lines" class="text-xs space-y-2 min-h-[2rem]"></div>' +
            '<div class="text-right font-mono font-bold text-slate-800">合计 <span id="rop-total">¥0.00</span></div>' +
            '</div>' +
            '<div class="p-4 border-t">' +
            '<button type="button" id="rop-submit" class="w-full py-3 rounded-xl bg-teal-500 text-white font-bold text-sm">提交订单</button></div></div>';
        document.body.appendChild(modal);
        modal.querySelector('#rop-modal-close').addEventListener('click', function () {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        });
        modal.querySelector('#rop-open-picker').addEventListener('click', openPicker);
        modal.querySelector('#rop-submit').addEventListener('click', submitOrder);
        modal.querySelector('#rop-fulfillment-type').addEventListener('change', syncFulfillmentPanel);
        modal.querySelector('#rop-warehouse').addEventListener('change', function () {
            batchCache.clear();
            renderOrderLines();
        });
        applyIndustryUi(modal);
    }

    function syncFulfillmentPanel() {
        var type = document.getElementById('rop-fulfillment-type').value;
        var panel = document.getElementById('rop-address-panel');
        var veh = document.getElementById('rop-addr-vehicle');
        if (!panel) return;
        var needAddr = type !== 'SELF_PICKUP';
        panel.classList.toggle('hidden', !needAddr);
        if (veh) veh.classList.toggle('hidden', type !== 'DELIVERY_VEHICLE');
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

    function renderProductList() {
        var list = document.getElementById('rop-list');
        if (!list || !window.TM_SkuCatalogCache) return;
        var rows = window.TM_SkuCatalogCache.filterByCategory(activeCategory);
        list.innerHTML = rows.map(function (r) {
            var line = getCartLine(r.skuId);
            var qty = line.qty || 0;
            var thumb = window.TM_ProductThumb ? window.TM_ProductThumb.html({ coverUrl: r.coverUrl, size: 56, alt: r.name }) : '';
            return '<div class="rop-item" data-sku="' + r.skuId + '">' + thumb +
                '<div class="rop-item__info"><div class="rop-item__name">' + r.name + '</div>' +
                (r.specDisplay ? '<div class="rop-item__spec">' + r.specDisplay + '</div>' : '') +
                '<div class="rop-item__stock">库存 ' + r.stock + ' · ¥' + r.price + '</div></div>' +
                '<div class="rop-qty"><button type="button" data-act="dec" data-sku="' + r.skuId + '">−</button>' +
                '<span>' + qty + '</span><button type="button" data-act="inc" data-sku="' + r.skuId + '">+</button></div></div>';
        }).join('') || '<p class="text-center text-slate-400 text-sm py-8">暂无商品</p>';
        list.querySelectorAll('.rop-qty button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sku = String(btn.dataset.sku);
                var line = getCartLine(sku);
                if (btn.dataset.act === 'inc') line.qty = (line.qty || 0) + 1;
                else line.qty = Math.max(0, (line.qty || 0) - 1);
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
                return '<div class="flex justify-between text-xs"><span>' + x.row.name + ' ×' + x.qty + '</span>' +
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
        var htmlParts = [];
        for (var i = 0; i < lines.length; i++) {
            var x = lines[i];
            sum += x.row.price * x.qty;
            var thumb = window.TM_ProductThumb ? window.TM_ProductThumb.html({ coverUrl: x.row.coverUrl, size: 32, alt: x.row.name }) : '';
            var extras = '';
            if (needsBatch(x.row)) {
                var batches = await loadBatchesForSku(x.row.skuId);
                extras += batchSelectHtml(x.row.skuId, x.line.batchId, batches);
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
        if (typeof window.loadCustomerList === 'function') await window.loadCustomerList();
        if (typeof window.loadProductList === 'function') await window.loadProductList();
        var custSel = document.getElementById('rop-customer');
        var map = window.customerMapCache || window.customersCache || {};
        if (custSel) {
            custSel.innerHTML = '<option value="">选择客户</option>';
            Object.keys(map).forEach(function (cid) {
                var c = map[cid];
                if (!c || !c.name) return;
                var o = document.createElement('option');
                o.value = cid;
                o.textContent = c.name;
                custSel.appendChild(o);
            });
        }
        var whSel = document.getElementById('rop-warehouse');
        if (whSel && window.wrappedFetch) {
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/warehouses', { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                var list = data && data.data ? data.data : [];
                whSel.innerHTML = '<option value="">默认仓库</option>';
                list.forEach(function (w) {
                    var o = document.createElement('option');
                    o.value = w.warehouseId || w.warehouse_id || w.id;
                    o.textContent = w.name || ('仓#' + o.value);
                    whSel.appendChild(o);
                });
                var def = window.TM_WorkbenchProfile && window.TM_WorkbenchProfile.defaultFulfillmentWarehouseId &&
                    window.TM_WorkbenchProfile.defaultFulfillmentWarehouseId();
                if (def) whSel.value = String(def);
            } catch (e) { /* ignore */ }
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
            window.TM_SkuCatalogCache.load(whId, false);
        }
        await renderOrderLines();
        syncFulfillmentPanel();
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
        var whId = document.getElementById('rop-warehouse').value;
        var warehouseId = whId ? parseInt(whId, 10) : null;
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
        if (ft !== 'SELF_PICKUP') {
            addrSnap = {
                contactName: document.getElementById('rop-addr-contact').value.trim(),
                contactPhone: document.getElementById('rop-addr-phone').value.trim(),
                detail: document.getElementById('rop-addr-detail').value.trim(),
                vehiclePlate: document.getElementById('rop-addr-vehicle').value.trim()
            };
        }
        var payload = {
            allowShortage: true,
            order: {
                custId: custId,
                totalAmount: grand,
                orderStatus: 'D010001',
                finStatus: 'UNPAID',
                allowShortage: true,
                fulfillmentType: ft,
                fulfillmentWarehouseId: warehouseId,
                warehouseId: warehouseId,
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
            notify('订单已创建', 'success');
            document.getElementById('rapid-order-modal').classList.add('hidden');
            document.body.style.overflow = '';
            cart.clear();
            batchCache.clear();
            if (typeof window.loadInProgressOrders === 'function') window.loadInProgressOrders();
        } catch (e) {
            notify(e.message || '提交失败', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (window.TM_SkuCatalogCache) window.TM_SkuCatalogCache.warmFromSession();
    });
})();
