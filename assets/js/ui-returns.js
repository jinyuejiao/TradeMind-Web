/**
 * 销售退货：创建、列表、验收
 */
(function () {
    'use strict';

    var REASONS = [
        { code: 'D019001', label: '质量问题' },
        { code: 'D019002', label: '发错货' },
        { code: 'D019003', label: '过期' },
        { code: 'D019004', label: '其他' }
    ];
    var STATUS_LABEL = {
        D018001: '草稿', D018002: '待收货', D018003: '验收中',
        D018004: '已完成', D018005: '拒收', D018006: '作废'
    };
    var _patched = false;
    var _listPage = 1;

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification(msg, type || 'info');
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg);
        }
    }

    function apiFetch(method, path, body) {
        var fetchFn = window.wrappedFetch || fetch;
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body != null) opts.body = JSON.stringify(body);
        return fetchFn('/api/v1/rd' + path, opts).then(function (r) { return r.json(); });
    }

    function fmtMoney(v) {
        var n = parseFloat(v);
        return isNaN(n) ? '—' : '¥' + n.toFixed(2);
    }

    function fmtDate(v) {
        if (!v) return '—';
        return String(v).replace('T', ' ').slice(0, 16);
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function returnableStatus(st) {
        var s = String(st || '').toUpperCase();
        return s === 'D010003' || s === 'D010006' || s === 'D010005' || s === 'SHIPPED' || s === 'PARTIAL_SHIPPED';
    }

    function ensureModals() {
        if (document.getElementById('return-create-modal')) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = ''
            + '<div id="return-create-modal" class="tm-unified-mobile-modal hidden fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-6">'
            + '  <div class="tm-modal-backdrop absolute inset-0 bg-slate-900/55 backdrop-blur-md" onclick="TM_Returns.closeCreateModal()"></div>'
            + '  <div class="relative bg-white w-full max-w-lg md:max-w-2xl rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">'
            + '    <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">'
            + '      <h3 class="text-sm font-bold text-slate-800">申请退货</h3>'
            + '      <button type="button" onclick="TM_Returns.closeCreateModal()" class="p-2 hover:bg-slate-100 rounded-full"><i class="ph ph-x text-lg text-slate-400"></i></button>'
            + '    </div>'
            + '    <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">'
            + '      <div><label class="text-[10px] font-bold text-slate-400 uppercase">退货原因</label>'
            + '        <select id="return-reason-select" class="form-input w-full mt-1 text-sm"></select></div>'
            + '      <div><label class="text-[10px] font-bold text-slate-400 uppercase">备注</label>'
            + '        <textarea id="return-remark-input" class="form-input w-full mt-1 text-sm" rows="2" placeholder="选填"></textarea></div>'
            + '      <div><p class="text-[10px] font-bold text-slate-400 uppercase mb-2">退货明细</p>'
            + '        <div id="return-create-items" class="space-y-2"></div></div>'
            + '    </div>'
            + '    <div class="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">'
            + '      <button type="button" onclick="TM_Returns.closeCreateModal()" class="tm-btn-secondary flex-1 py-3 text-xs font-bold">取消</button>'
            + '      <button type="button" id="return-create-submit" onclick="TM_Returns.submitCreate()" class="tm-btn-primary flex-[1.4] py-3 text-xs font-black">提交退货</button>'
            + '    </div>'
            + '  </div>'
            + '</div>'
            + '<div id="return-inspect-modal" class="tm-unified-mobile-modal hidden fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-6">'
            + '  <div class="tm-modal-backdrop absolute inset-0 bg-slate-900/55 backdrop-blur-md" onclick="TM_Returns.closeInspectModal()"></div>'
            + '  <div class="relative bg-white w-full max-w-lg md:max-w-2xl rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">'
            + '    <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">'
            + '      <div><h3 class="text-sm font-bold text-slate-800">退货验收</h3>'
            + '        <p id="return-inspect-meta" class="text-[10px] text-slate-400 mt-0.5"></p></div>'
            + '      <button type="button" onclick="TM_Returns.closeInspectModal()" class="p-2 hover:bg-slate-100 rounded-full"><i class="ph ph-x text-lg text-slate-400"></i></button>'
            + '    </div>'
            + '    <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 no-scrollbar" id="return-inspect-items"></div>'
            + '    <div class="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">'
            + '      <button type="button" onclick="TM_Returns.closeInspectModal()" class="tm-btn-secondary flex-1 py-3 text-xs font-bold">取消</button>'
            + '      <button type="button" onclick="TM_Returns.submitInspect()" class="tm-btn-primary flex-[1.4] py-3 text-xs font-black">确认验收</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        document.body.appendChild(wrap);
        var sel = document.getElementById('return-reason-select');
        if (sel) {
            sel.innerHTML = REASONS.map(function (r) {
                return '<option value="' + r.code + '">' + esc(r.label) + '</option>';
            }).join('');
        }
    }

    function openModal(el) {
        if (!el) return;
        if (typeof window.TM_openUnifiedModal === 'function') {
            window.TM_openUnifiedModal(el);
        } else {
            el.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(el) {
        if (!el) return;
        if (typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(el);
        } else {
            el.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    function getDetailItems() {
        return window.detailOrderItemsCache || [];
    }

    function getDetailOrder() {
        return window.currentDetailOrder || null;
    }

    function getDetailOrderId() {
        return window.currentDetailOrderId || null;
    }

    function productName(item) {
        if (typeof window.getProductDisplayById === 'function') {
            return window.getProductDisplayById(item.productId || item.product_id).name;
        }
        return item.productName || item.product_name || ('产品#' + (item.productId || item.product_id || ''));
    }

    function lineQty(item) {
        if (typeof window.resolveOrderItemLine === 'function') {
            return window.resolveOrderItemLine(item).qty;
        }
        return item.quantity != null ? item.quantity : (item.qty || 0);
    }

    function linePrice(item) {
        if (typeof window.resolveOrderItemLine === 'function') {
            return window.resolveOrderItemLine(item).unitPrice;
        }
        return item.unitPrice != null ? item.unitPrice : (item.unit_price || 0);
    }

    function patchDetailItemsRender() {
        if (_patched) return;
        var orig = window.__TM_renderDetailOrderItems;
        if (typeof orig !== 'function') return;
        window.__TM_renderDetailOrderItems = function (items) {
            orig(items);
            injectReturnColumns(items);
        };
        _patched = true;
    }

    function injectReturnColumns(items) {
        var show = document.getElementById('detail-apply-return-btn') &&
            !document.getElementById('detail-apply-return-btn').classList.contains('hidden');
        document.querySelectorAll('#order-detail-modal .detail-return-col').forEach(function (th) {
            th.classList.toggle('hidden', !show);
        });
        if (!show || !items || !items.length) return;
        var tbody = document.getElementById('detail-order-items-body');
        if (!tbody) return;
        tbody.querySelectorAll('tr.order-item-row').forEach(function (tr, idx) {
            var item = items[idx];
            if (!item) return;
            var itemId = item.itemId != null ? item.itemId : (item.item_id != null ? item.item_id : idx);
            var maxQ = lineQty(item);
            var price = linePrice(item);
            var td = document.createElement('td');
            td.className = 'detail-return-col tm-col-return px-2 py-2 text-center';
            td.innerHTML = '<input type="checkbox" class="detail-return-check w-4 h-4 accent-amber-600" data-item-id="' + itemId + '" data-row-index="' + idx + '" data-max-qty="' + maxQ + '" data-price="' + price + '" aria-label="退货行">';
            tr.appendChild(td);
        });
    }

    function syncDetailReturnUi(order) {
        ensureModals();
        var btn = document.getElementById('detail-apply-return-btn');
        if (!btn) return;
        var st = order && (order.orderStatus || order.order_status);
        var ok = returnableStatus(st);
        btn.classList.toggle('hidden', !ok);
        document.querySelectorAll('#order-detail-modal .detail-return-col').forEach(function (el) {
            el.classList.toggle('hidden', !ok);
        });
    }

    function openCreateFromDetail() {
        ensureModals();
        var orderId = getDetailOrderId();
        var order = getDetailOrder();
        var items = getDetailItems();
        if (!orderId || !items.length) {
            notify('请先加载订单明细', 'warning');
            return;
        }
        var container = document.getElementById('return-create-items');
        if (!container) return;
        container.innerHTML = items.map(function (item, idx) {
            var itemId = item.itemId != null ? item.itemId : (item.item_id != null ? item.item_id : idx);
            var maxQ = lineQty(item);
            var price = linePrice(item);
            var name = esc(productName(item));
            return ''
                + '<label class="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">'
                + '  <input type="checkbox" class="return-create-check mt-1 w-4 h-4 accent-amber-600" data-item-id="' + itemId + '" data-product-id="' + (item.productId || item.product_id || '') + '" data-sku-id="' + (item.skuId || item.sku_id || '') + '" data-max-qty="' + maxQ + '" data-price="' + price + '" checked />'
                + '  <span class="flex-1 min-w-0"><span class="text-xs font-bold text-slate-800 block truncate">' + name + '</span>'
                + '    <span class="text-[10px] text-slate-400">可退 ' + maxQ + ' · 单价 ' + fmtMoney(price) + '</span></span>'
                + '  <input type="number" class="return-create-qty form-input w-16 text-xs font-mono text-center" min="1" max="' + maxQ + '" value="' + maxQ + '" data-for-item="' + itemId + '" />'
                + '</label>';
        }).join('');
        window.__TM_returnCreateCtx = {
            orderId: orderId,
            custId: order.custId || order.cust_id,
            warehouseId: order.warehouseId || order.warehouse_id
        };
        openModal(document.getElementById('return-create-modal'));
    }

    function closeCreateModal() {
        closeModal(document.getElementById('return-create-modal'));
    }

    function submitCreate() {
        var ctx = window.__TM_returnCreateCtx || {};
        var reason = (document.getElementById('return-reason-select') || {}).value || 'D019004';
        var remark = (document.getElementById('return-remark-input') || {}).value || '';
        var lines = [];
        document.querySelectorAll('#return-create-items .return-create-check:checked').forEach(function (cb) {
            var itemId = cb.getAttribute('data-item-id');
            var qtyInp = document.querySelector('#return-create-items .return-create-qty[data-for-item="' + itemId + '"]');
            var qty = qtyInp ? parseInt(qtyInp.value, 10) : parseInt(cb.getAttribute('data-max-qty'), 10);
            if (!qty || qty <= 0) return;
            lines.push({
                orderItemId: parseInt(itemId, 10),
                productId: cb.getAttribute('data-product-id') ? parseInt(cb.getAttribute('data-product-id'), 10) : null,
                skuId: cb.getAttribute('data-sku-id') ? parseInt(cb.getAttribute('data-sku-id'), 10) : null,
                quantity: qty,
                priceAtReturn: parseFloat(cb.getAttribute('data-price')) || 0
            });
        });
        if (!lines.length) {
            notify('请至少选择一行退货商品', 'warning');
            return;
        }
        var btn = document.getElementById('return-create-submit');
        if (btn) btn.disabled = true;
        apiFetch('POST', '/returns', {
            orderId: ctx.orderId,
            custId: ctx.custId,
            warehouseId: ctx.warehouseId,
            reasonCode: reason,
            remark: remark,
            items: lines
        }).then(function (res) {
            if (!res.success) throw new Error(res.message || '创建失败');
            notify('退货单已创建', 'success');
            closeCreateModal();
            if (window.TM_SalesOrders && window.TM_SalesOrders.switchView) {
                window.TM_SalesOrders.switchView('returns');
            }
        }).catch(function (err) {
            notify(err.message || '创建退货单失败', 'error');
        }).finally(function () {
            if (btn) btn.disabled = false;
        });
    }

    function renderList(records) {
        var container = document.getElementById('returns-list');
        if (!container) return;
        if (!records || !records.length) {
            container.innerHTML = '<p class="text-center text-slate-400 py-8">暂无退货单</p>';
            return;
        }
        container.innerHTML = records.map(function (r) {
            var id = r.return_id != null ? r.return_id : r.returnId;
            var code = r.return_code || r.returnCode || ('RT-' + id);
            var st = r.return_status || r.returnStatus || '';
            var stLabel = STATUS_LABEL[st] || st || '—';
            var canInspect = st === 'D018002' || st === 'D018003';
            return ''
                + '<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">'
                + '  <div class="flex flex-wrap items-start justify-between gap-2">'
                + '    <div><p class="text-sm font-bold text-slate-800">' + esc(code) + '</p>'
                + '      <p class="text-[10px] text-slate-400 mt-0.5">' + esc(r.cust_name || r.custName || '') + ' · ' + fmtDate(r.create_time || r.createTime) + '</p></div>'
                + '    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">' + esc(stLabel) + '</span>'
                + '  </div>'
                + '  <p class="mt-2 text-xs font-mono font-bold text-brand-600">' + fmtMoney(r.total_amount || r.totalAmount) + '</p>'
                + (canInspect ? ('<button type="button" onclick="TM_Returns.openInspect(' + id + ')" class="mt-3 w-full py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold">验收</button>') : '')
                + '</div>';
        }).join('');
    }

    function renderPagination(data) {
        var el = document.getElementById('returns-pagination');
        if (!el) return;
        var page = data.pageNo || 1;
        var totalPages = data.totalPages || 1;
        if (totalPages <= 1) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = ''
            + '<button type="button" class="text-xs font-bold text-slate-500 px-3 py-1' + (page <= 1 ? ' opacity-40 pointer-events-none' : '') + '" onclick="TM_Returns.loadList(' + (page - 1) + ')">上一页</button>'
            + '<span class="text-xs text-slate-400">' + page + ' / ' + totalPages + '</span>'
            + '<button type="button" class="text-xs font-bold text-slate-500 px-3 py-1' + (page >= totalPages ? ' opacity-40 pointer-events-none' : '') + '" onclick="TM_Returns.loadList(' + (page + 1) + ')">下一页</button>';
    }

    function loadList(page) {
        ensureModals();
        _listPage = page || 1;
        apiFetch('GET', '/returns?pageNo=' + _listPage + '&pageSize=20').then(function (res) {
            if (!res.success) throw new Error(res.message || '加载失败');
            var data = res.data || {};
            renderList(data.records || []);
            renderPagination(data);
        }).catch(function (err) {
            notify(err.message || '加载退货单失败', 'error');
        });
    }

    var _inspectReturnId = null;

    function openInspect(returnId) {
        ensureModals();
        _inspectReturnId = returnId;
        apiFetch('GET', '/returns/' + returnId).then(function (res) {
            if (!res.success || !res.data) throw new Error('加载退货单失败');
            var d = res.data;
            var meta = document.getElementById('return-inspect-meta');
            if (meta) meta.textContent = (d.return_code || d.returnCode || '') + ' · 待验收';
            var items = d.items || [];
            var box = document.getElementById('return-inspect-items');
            if (!box) return;
            box.innerHTML = items.map(function (it) {
                var rid = it.return_item_id != null ? it.return_item_id : it.returnItemId;
                var qty = it.quantity || 0;
                return ''
                    + '<div class="p-3 rounded-xl border border-slate-100 bg-slate-50 space-y-2" data-return-item-id="' + rid + '">'
                    + '  <p class="text-xs font-bold text-slate-800">行 #' + rid + ' · 申请数量 ' + qty + '</p>'
                    + '  <div class="grid grid-cols-3 gap-2">'
                    + '    <div><label class="text-[10px] text-slate-400">良品</label><input type="number" class="inspect-good form-input w-full text-xs font-mono" min="0" max="' + qty + '" value="' + qty + '" /></div>'
                    + '    <div><label class="text-[10px] text-slate-400">残次</label><input type="number" class="inspect-defective form-input w-full text-xs font-mono" min="0" value="0" /></div>'
                    + '    <div><label class="text-[10px] text-slate-400">报废</label><input type="number" class="inspect-scrap form-input w-full text-xs font-mono" min="0" value="0" /></div>'
                    + '  </div>'
                    + '  <select class="inspect-condition form-input w-full text-xs"><option value="D020001">良品可售</option><option value="D020002">残次</option><option value="D020003">报废</option></select>'
                    + '</div>';
            }).join('');
            openModal(document.getElementById('return-inspect-modal'));
        }).catch(function (err) {
            notify(err.message || '打开验收失败', 'error');
        });
    }

    function closeInspectModal() {
        _inspectReturnId = null;
        closeModal(document.getElementById('return-inspect-modal'));
    }

    function submitInspect() {
        if (!_inspectReturnId) return;
        var lines = [];
        document.querySelectorAll('#return-inspect-items [data-return-item-id]').forEach(function (row) {
            var rid = parseInt(row.getAttribute('data-return-item-id'), 10);
            var good = parseInt((row.querySelector('.inspect-good') || {}).value, 10) || 0;
            var defective = parseInt((row.querySelector('.inspect-defective') || {}).value, 10) || 0;
            var scrap = parseInt((row.querySelector('.inspect-scrap') || {}).value, 10) || 0;
            var cond = (row.querySelector('.inspect-condition') || {}).value || 'D020001';
            lines.push({ returnItemId: rid, goodQty: good, defectiveQty: defective, scrapQty: scrap, itemCondition: cond });
        });
        apiFetch('POST', '/returns/' + _inspectReturnId + '/inspect', { items: lines }).then(function (res) {
            if (!res.success) throw new Error(res.message || '验收失败');
            notify('验收完成', 'success');
            closeInspectModal();
            loadList(_listPage);
        }).catch(function (err) {
            notify(err.message || '验收失败', 'error');
        });
    }

    function init() {
        ensureModals();
        patchDetailItemsRender();
    }

    window.TM_Returns = {
        init: init,
        loadList: loadList,
        openCreateFromDetail: openCreateFromDetail,
        closeCreateModal: closeCreateModal,
        submitCreate: submitCreate,
        openInspect: openInspect,
        closeInspectModal: closeInspectModal,
        submitInspect: submitInspect,
        syncDetailReturnUi: syncDetailReturnUi,
        patchDetailItemsRender: patchDetailItemsRender
    };
})();
