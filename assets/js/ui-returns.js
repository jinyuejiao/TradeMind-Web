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

    function canonicalOrderStatus(st) {
        if (window.TM_OrderDict && typeof window.TM_OrderDict.toCanonicalOrderStatusCode === 'function') {
            return window.TM_OrderDict.toCanonicalOrderStatusCode(st);
        }
        return String(st || '').trim().toUpperCase().replace(/_/g, '');
    }

    function returnableStatus(st) {
        var s = canonicalOrderStatus(st);
        return s === 'D010003' || s === 'D010004' || s === 'D010006' || s === 'D010005'
            || s === 'SHIPPED' || s === 'PARTIALSHIPPED' || s === 'RECEIVED' || s === 'COMPLETED';
    }

    function ensureModals() {
        if (document.getElementById('return-create-modal')) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = ''
            + '<div id="return-create-modal" class="tm-unified-mobile-modal tm-mobile-sheet-modal hidden fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-6">'
            + '  <div class="tm-modal-backdrop absolute inset-0 bg-slate-900/55 backdrop-blur-md" onclick="TM_Returns.closeCreateModal()"></div>'
            + '  <div class="relative bg-white w-full max-w-lg md:max-w-2xl rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[min(88dvh,100%)] md:h-auto md:max-h-[90dvh]">'
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
            + '</div>'
            + '<div id="return-detail-modal" class="tm-unified-mobile-modal hidden fixed inset-0 z-[115] flex items-end md:items-center justify-center p-0 md:p-6">'
            + '  <div class="tm-modal-backdrop absolute inset-0 bg-slate-900/55 backdrop-blur-md" onclick="TM_Returns.closeDetail()"></div>'
            + '  <div class="relative bg-white w-full max-w-lg md:max-w-2xl rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">'
            + '    <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">'
            + '      <div><h3 class="text-sm font-bold text-slate-800">退货详情</h3>'
            + '        <p id="return-detail-meta" class="text-[10px] text-slate-400 mt-0.5"></p></div>'
            + '      <button type="button" onclick="TM_Returns.closeDetail()" class="p-2 hover:bg-slate-100 rounded-full"><i class="ph ph-x text-lg text-slate-400"></i></button>'
            + '    </div>'
            + '    <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 no-scrollbar" id="return-detail-body"></div>'
            + '    <div class="px-5 py-4 border-t border-slate-100 shrink-0" id="return-detail-actions"></div>'
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
        var core = window.__TM_renderDetailOrderItems;
        if (typeof core !== 'function') {
            if (typeof window.renderDetailOrderItems === 'function' && !window.renderDetailOrderItems.__tmReturnsWrapped) {
                core = window.renderDetailOrderItems;
                window.__TM_renderDetailOrderItems = core;
            } else {
                return;
            }
        }
        if (window.renderDetailOrderItems && window.renderDetailOrderItems.__tmReturnsWrapped) {
            _patched = true;
            return;
        }
        window.renderDetailOrderItems = function (items) {
            core(items);
            injectReturnColumns(items);
        };
        window.renderDetailOrderItems.__tmReturnsWrapped = true;
        _patched = true;
    }

    function injectReturnColumns(items) {
        var detailModal = document.getElementById('order-detail-modal');
        var btn = detailModal
            ? detailModal.querySelector('#detail-apply-return-btn')
            : document.getElementById('detail-apply-return-btn');
        var show = btn && !btn.classList.contains('hidden');
        document.querySelectorAll('#order-detail-modal .detail-return-col').forEach(function (th) {
            th.classList.toggle('hidden', !show);
        });
        if (!show || !items || !items.length) return;
        var tbody = detailModal
            ? detailModal.querySelector('#detail-order-items-body')
            : document.getElementById('detail-order-items-body');
        if (!tbody) return;
        tbody.querySelectorAll('tr.order-item-row').forEach(function (tr, idx) {
            if (tr.querySelector('.detail-return-col')) return;
            var item = items[idx];
            if (!item) return;
            var itemId = item.itemId != null ? item.itemId : (item.item_id != null ? item.item_id : idx);
            var maxQ = returnableQty(item);
            var price = linePrice(item);
            var td = document.createElement('td');
            td.className = 'detail-return-col tm-col-return px-2 py-2 text-center';
            td.innerHTML = '<input type="checkbox" class="detail-return-check w-4 h-4 accent-amber-600" data-item-id="' + itemId + '" data-row-index="' + idx + '" data-max-qty="' + maxQ + '" data-price="' + price + '" aria-label="退货行">';
            tr.appendChild(td);
        });
    }

    function syncDetailReturnUi(order) {
        ensureModals();
        var detailModal = document.getElementById('order-detail-modal');
        var btn = detailModal
            ? detailModal.querySelector('#detail-apply-return-btn')
            : document.getElementById('detail-apply-return-btn');
        if (!btn) return;
        var st = order && (order.orderStatus || order.order_status);
        var ok = returnableStatus(st);
        btn.classList.toggle('hidden', !ok);
        document.querySelectorAll('#order-detail-modal .detail-return-col').forEach(function (el) {
            el.classList.toggle('hidden', !ok);
        });
        var hintEl = detailModal
            ? detailModal.querySelector('#detail-order-return-hint')
            : document.getElementById('detail-order-return-hint');
        if (hintEl) {
            if (st && !ok) {
                hintEl.classList.remove('hidden');
                hintEl.textContent = '当前订单状态不可申请退货（需全部发货、部分发货或已签收）';
            } else {
                hintEl.classList.add('hidden');
                hintEl.textContent = '';
            }
        }
    }

    function repairModalOverlayState() {
        var anyOpen = false;
        try {
            document.querySelectorAll('.tm-unified-mobile-modal, .tm-product-edit-modal, #member-modal').forEach(function (el) {
                if (!el || el.classList.contains('hidden')) return;
                if (el.getAttribute('aria-hidden') === 'true') return;
                var st = window.getComputedStyle(el);
                if (st && st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity) !== 0) {
                    anyOpen = true;
                }
            });
        } catch (e) { /* ignore */ }
        if (!anyOpen) {
            if (typeof window.TM_ensureShellOverlayVisible === 'function') {
                window.TM_ensureShellOverlayVisible();
            } else if (typeof window.TM_resetShellOverlay === 'function') {
                window.TM_resetShellOverlay();
            }
            document.body.style.overflow = '';
            document.documentElement.classList.remove('tm-embed-modal-open');
            document.body.classList.remove('tm-embed-modal-open');
        } else if (typeof window.TM_reconcileShellOverlay === 'function') {
            window.TM_reconcileShellOverlay();
        }
    }

    function returnRefundHint(r) {
        var st = String(r.return_status || r.returnStatus || r.status || '').toUpperCase();
        var fin = String(r.fin_status || r.finStatus || 'UNPAID').toUpperCase();
        if (st.indexOf('D018001') === 0 || st === 'DRAFT') return '草稿，尚未进入收货流程';
        if (st.indexOf('D018002') === 0 || st === 'PENDING_RECEIVE') return '待收货：验收完成后可冲减收款';
        if (st.indexOf('D018003') === 0 || st === 'INSPECTING') return '验收中：完成后可冲减收款';
        if (st.indexOf('D018004') === 0 || st === 'COMPLETED') {
            if (fin === 'SETTLED' || fin === 'REFUNDED' || fin === 'D021003') return '退款/冲账已完成';
            return '验收已完成：请在订单详情「仓库·收款」冲减已收';
        }
        if (st.indexOf('D018005') === 0 || st === 'REJECTED') return '已拒收，不涉及退款';
        if (st.indexOf('D018006') === 0 || st === 'VOIDED') return '已作废';
        return '商品退回入库后，冲减订单应收或已收款项';
    }

    function returnFinLabel(code) {
        var fin = String(code || 'UNPAID').toUpperCase();
        if (fin === 'SETTLED' || fin === 'D021003') return '已冲账';
        if (fin === 'PARTIAL' || fin === 'D021002') return '部分冲账';
        if (fin === 'REFUNDED') return '已退款';
        return '待冲账';
    }

    function loadDetailReturnsSummary(orderId, order, items) {
        var detailModal = document.getElementById('order-detail-modal');
        var section = detailModal
            ? detailModal.querySelector('#detail-order-returns-section')
            : document.getElementById('detail-order-returns-section');
        var summaryEl = detailModal
            ? detailModal.querySelector('#detail-order-returns-summary')
            : document.getElementById('detail-order-returns-summary');
        var listEl = detailModal
            ? detailModal.querySelector('#detail-order-returns-list')
            : document.getElementById('detail-order-returns-list');
        var viewAllBtn = detailModal
            ? detailModal.querySelector('#detail-view-all-returns-btn')
            : document.getElementById('detail-view-all-returns-btn');
        if (!section || !summaryEl || !listEl) return;

        order = order || {};
        items = items || [];
        var returnedAmt = parseFloat(order.returned_amount != null ? order.returned_amount : (order.returnedAmount || 0)) || 0;
        var returnedQty = 0;
        items.forEach(function (it) {
            var rq = it.returned_qty != null ? it.returned_qty : (it.returnedQty || 0);
            returnedQty += parseInt(rq, 10) || 0;
        });

        if (!orderId) {
            section.classList.add('hidden');
            return;
        }

        var summaryParts = [];
        if (returnedQty > 0) summaryParts.push('已退货 ' + returnedQty + ' 件');
        if (returnedAmt > 0) summaryParts.push('扣减金额 ' + fmtMoney(returnedAmt));

        apiFetch('GET', '/returns?orderId=' + encodeURIComponent(orderId) + '&pageNo=1&pageSize=20').then(function (res) {
            var records = res && res.success && res.data && res.data.records ? res.data.records : [];
            var hasReturns = records.length > 0 || returnedAmt > 0 || returnedQty > 0;
            section.classList.toggle('hidden', !hasReturns);
            if (viewAllBtn) viewAllBtn.classList.toggle('hidden', !records.length);

            if (hasReturns) {
                summaryEl.classList.remove('hidden');
                var total = parseFloat(order.total_amount != null ? order.total_amount : (order.totalAmount || 0)) || 0;
                var net = Math.max(0, total - returnedAmt);
                summaryEl.innerHTML = ''
                    + '<div class="flex flex-wrap items-center gap-2 mb-1.5">'
                    + '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">销售退货</span>'
                    + '<span class="text-[10px] text-slate-400">非换货</span></div>'
                    + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">'
                    + (returnedQty > 0 ? ('<div><p class="text-[10px] text-slate-400">累计退货</p><p class="font-bold">' + returnedQty + ' 件</p></div>') : '')
                    + (returnedAmt > 0 ? ('<div><p class="text-[10px] text-slate-400">扣减金额</p><p class="font-mono font-bold text-amber-700">' + fmtMoney(returnedAmt) + '</p></div>') : '')
                    + (returnedAmt > 0 ? ('<div><p class="text-[10px] text-slate-400">当前应收</p><p class="font-mono font-bold">' + fmtMoney(net) + '</p></div>') : '')
                    + (records.length ? ('<div><p class="text-[10px] text-slate-400">退货单</p><p class="font-bold">' + records.length + ' 笔</p></div>') : '')
                    + '</div>'
                    + (summaryParts.length ? ('<p class="text-[10px] text-slate-500 mt-1.5">' + esc(summaryParts.join(' · ')) + '</p>') : '');
            } else {
                summaryEl.classList.add('hidden');
                summaryEl.innerHTML = '';
            }

            if (!records.length) {
                listEl.innerHTML = returnedAmt > 0 || returnedQty > 0
                    ? '<p class="text-[11px] text-slate-400">订单已有退货汇总，关联退货单尚未同步或加载中。</p>'
                    : '';
                return;
            }

            listEl.innerHTML = records.map(function (r) {
                var code = r.return_code || r.returnCode || ('RT-' + (r.return_id || r.returnId));
                var st = returnStatusLabel(r.return_status || r.returnStatus || r.status);
                var fin = returnFinLabel(r.fin_status || r.finStatus);
                var refundHint = returnRefundHint(r);
                var amt = fmtMoney(r.total_amount != null ? r.total_amount : r.totalAmount);
                var dt = String(r.create_time || r.createTime || '').replace('T', ' ').slice(0, 16);
                return '<div class="rounded-xl border border-slate-100 bg-white px-3 py-2.5 space-y-1.5">'
                    + '<div class="flex justify-between gap-2 items-start">'
                    + '<div class="min-w-0 flex-1">'
                    + '<p class="text-xs font-bold text-slate-800 truncate">' + esc(code) + '</p>'
                    + '<p class="text-[10px] text-slate-400">' + esc(dt) + ' · 类型：销售退货</p>'
                    + '</div>'
                    + '<div class="text-right shrink-0">'
                    + '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">' + esc(st) + '</span>'
                    + '<p class="text-xs font-mono font-bold text-slate-700 mt-0.5">退货 ' + amt + '</p>'
                    + '</div></div>'
                    + '<div class="flex flex-wrap items-center gap-2 text-[10px]">'
                    + '<span class="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-bold">退款 ' + esc(fin) + '</span>'
                    + '<span class="text-slate-500">' + esc(refundHint) + '</span>'
                    + '</div></div>';
            }).join('');
        }).catch(function () {
            section.classList.toggle('hidden', !(returnedAmt > 0 || returnedQty > 0));
            if (returnedAmt > 0 || returnedQty > 0) {
                summaryEl.classList.remove('hidden');
                summaryEl.innerHTML = '<p class="text-slate-600">' + esc(summaryParts.join(' · ') || '已有退货记录') + '</p>';
            }
            listEl.innerHTML = '<p class="text-[11px] text-red-400">加载关联退货单失败</p>';
        });
    }

    function returnStatusLabel(code) {
        if (window.TM_OrderDict && typeof window.TM_OrderDict.returnStatusLabel === 'function') {
            return window.TM_OrderDict.returnStatusLabel(code);
        }
        return code || '—';
    }

    function returnableQty(item) {
        var rq = item.returnableQty != null ? item.returnableQty : item.returnable_qty;
        if (rq != null) return Math.max(0, parseInt(rq, 10) || 0);
        if (typeof window.resolveOrderItemLine === 'function') {
            return window.resolveOrderItemLine(item).returnableQty || 0;
        }
        var qty = lineQty(item);
        var ret = item.returnedQty != null ? item.returnedQty : (item.returned_qty || 0);
        return Math.max(0, qty - ret);
    }

    function productName(item) {
        if (item.productName || item.product_name) {
            return item.productName || item.product_name;
        }
        if (typeof window.getProductDisplayById === 'function') {
            return window.getProductDisplayById(item.productId || item.product_id).name;
        }
        return '产品#' + (item.productId || item.product_id || '');
    }

    function productSpecLabel(item) {
        if (window.TM_ProductDomain && typeof window.TM_ProductDomain.resolveOrderItemSpecLabel === 'function') {
            return window.TM_ProductDomain.resolveOrderItemSpecLabel(item) || '';
        }
        var direct = item && (item.attributes_display || item.attributesDisplay
            || item.spec_display || item.specDisplay || '');
        return direct && String(direct).trim() ? String(direct).trim() : '';
    }

    function renderReturnCreateItems(items) {
        var container = document.getElementById('return-create-items');
        if (!container) return;
        var eligible = (items || []).filter(function (item) { return returnableQty(item) > 0; });
        if (!eligible.length) {
            container.innerHTML = '<p class="text-center text-slate-400 py-6 text-sm">暂无可退商品（可能已全部退货）</p>';
            return;
        }
        container.innerHTML = eligible.map(function (item, idx) {
            var itemId = item.itemId != null ? item.itemId : (item.item_id != null ? item.item_id : idx);
            var maxQ = returnableQty(item);
            var price = linePrice(item);
            var name = esc(productName(item));
            var spec = productSpecLabel(item);
            var specHtml = spec ? ('<span class="text-[11px] text-slate-500 block mt-0.5 break-words">' + esc(spec) + '</span>') : '';
            return ''
                + '<div class="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">'
                + '  <label class="flex items-start gap-3">'
                + '    <input type="checkbox" class="return-create-check mt-1 w-5 h-5 accent-amber-600 shrink-0" data-item-id="' + itemId + '" data-product-id="' + (item.productId || item.product_id || '') + '" data-sku-id="' + (item.skuId || item.sku_id || '') + '" data-max-qty="' + maxQ + '" data-price="' + price + '" checked />'
                + '    <span class="flex-1 min-w-0"><span class="text-sm font-bold text-slate-800 block break-words">' + name + '</span>'
                + specHtml
                + '      <span class="text-[11px] text-slate-500 block mt-0.5">可退 ' + maxQ + ' · 单价 ' + fmtMoney(price) + '</span></span>'
                + '  </label>'
                + '  <div class="flex items-center justify-between gap-3 pl-8">'
                + '    <span class="text-[10px] font-bold text-slate-400 uppercase">退货数量</span>'
                + '    <input type="number" class="return-create-qty form-input w-24 text-sm font-mono text-center py-2" min="1" max="' + maxQ + '" value="' + maxQ + '" data-for-item="' + itemId + '" />'
                + '  </div>'
                + '</div>';
        }).join('');
    }

    function refreshOrderDetailAfterReturn(orderId) {
        if (!orderId) return Promise.resolve();
        var fetchFn = window.wrappedFetch || fetch;
        return fetchFn('/api/v1/rd/orders/' + encodeURIComponent(orderId), {
            method: 'GET', headers: { 'Content-Type': 'application/json' }
        }).then(function (r) { return r.json(); }).then(function (orderRes) {
            if (orderRes && orderRes.success && orderRes.data && window.currentDetailOrder) {
                Object.assign(window.currentDetailOrder, orderRes.data);
            }
            if (typeof window.loadOrderDetailContent === 'function') {
                return window.loadOrderDetailContent(orderId, window.currentDetailOrder || {});
            }
        }).catch(function () { /* ignore */ });
    }

    function openCreateFromDetail() {
        ensureModals();
        var orderId = getDetailOrderId();
        var order = getDetailOrder();
        if (!orderId) {
            notify('请先打开订单详情', 'warning');
            return;
        }
        window.__TM_returnCreateCtx = {
            orderId: orderId,
            custId: order && (order.custId || order.cust_id),
            warehouseId: order && (order.warehouseId || order.warehouse_id),
            fromDetail: true
        };
        var container = document.getElementById('return-create-items');
        if (container) {
            container.innerHTML = '<p class="text-center text-slate-400 py-6 text-sm">加载可退商品...</p>';
        }
        openModal(document.getElementById('return-create-modal'));
        apiFetch('GET', '/orders/' + orderId + '/items').then(function (res) {
            if (!res.success) throw new Error(res.message || '加载明细失败');
            var items = Array.isArray(res.data) ? res.data : [];
            window.detailOrderItemsCache = items;
            renderReturnCreateItems(items);
        }).catch(function (err) {
            if (container) {
                container.innerHTML = '<p class="text-center text-red-400 py-6 text-sm">' + esc(err.message || '加载失败') + '</p>';
            }
        });
    }

    function closeCreateModal() {
        closeModal(document.getElementById('return-create-modal'));
        repairModalOverlayState();
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
            if (typeof window.__TM_dashboardCloseOrderDetail === 'function') {
                window.__TM_dashboardCloseOrderDetail();
            }
            refreshOrderDetailAfterReturn(ctx.orderId).then(function () {
                if (typeof window.TM_emitOrderDataChanged === 'function') {
                    window.TM_emitOrderDataChanged({ orderId: ctx.orderId, custId: ctx.custId });
                }
            });
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
                + '<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm cursor-pointer hover:border-teal-200 transition-colors" onclick="TM_Returns.openDetail(' + id + ')">'
                + '  <div class="flex flex-wrap items-start justify-between gap-2">'
                + '    <div><p class="text-sm font-bold text-slate-800">' + esc(code) + '</p>'
                + '      <p class="text-[10px] text-slate-400 mt-0.5">' + esc(r.cust_name || r.custName || '') + ' · ' + fmtDate(r.create_time || r.createTime) + '</p></div>'
                + '    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">' + esc(stLabel) + '</span>'
                + '  </div>'
                + '  <p class="mt-2 text-xs font-mono font-bold text-brand-600">' + fmtMoney(r.total_amount || r.totalAmount) + '</p>'
                + (canInspect ? ('<button type="button" onclick="event.stopPropagation(); TM_Returns.openInspect(' + id + ')" class="mt-3 w-full py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold">验收</button>') : '')
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

    function openDetail(returnId) {
        ensureModals();
        apiFetch('GET', '/returns/' + returnId).then(function (res) {
            if (!res.success || !res.data) throw new Error('加载退货单失败');
            var d = res.data;
            var meta = document.getElementById('return-detail-meta');
            var body = document.getElementById('return-detail-body');
            var actions = document.getElementById('return-detail-actions');
            if (!body) return;
            var code = d.return_code || d.returnCode || ('RT-' + returnId);
            var st = d.return_status || d.returnStatus || '';
            var stLabel = STATUS_LABEL[st] || st || '—';
            if (meta) meta.textContent = code + ' · ' + stLabel;
            var reasonCode = d.reason_code || d.reasonCode || '';
            var reasonHit = REASONS.find(function (r) { return r.code === reasonCode; });
            var reasonLabel = reasonHit ? reasonHit.label : reasonCode;
            var items = d.items || [];
            body.innerHTML = ''
                + '<div class="grid grid-cols-2 gap-3 text-xs">'
                + '  <div><p class="text-[10px] text-slate-400">客户</p><p class="font-bold text-slate-700">' + esc(d.cust_name || d.custName || '—') + '</p></div>'
                + '  <div><p class="text-[10px] text-slate-400">金额</p><p class="font-mono font-bold text-brand-600">' + fmtMoney(d.total_amount || d.totalAmount) + '</p></div>'
                + '  <div><p class="text-[10px] text-slate-400">原因</p><p class="text-slate-700">' + esc(reasonLabel || '—') + '</p></div>'
                + '  <div><p class="text-[10px] text-slate-400">创建时间</p><p class="text-slate-600">' + fmtDate(d.create_time || d.createTime) + '</p></div>'
                + '</div>'
                + (d.remark ? ('<p class="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">' + esc(d.remark) + '</p>') : '')
                + '<div class="space-y-2"><p class="text-[10px] font-bold text-slate-400 uppercase">明细</p>'
                + (items.length ? items.map(function (it) {
                    var name = it.product_name || it.productName || ('产品#' + (it.product_id || it.productId || ''));
                    var qty = it.return_qty != null ? it.return_qty : (it.returnQty || it.quantity || 0);
                    return '<div class="flex justify-between text-xs py-2 border-b border-slate-50">'
                        + '<span class="text-slate-700">' + esc(name) + ' ×' + qty + '</span>'
                        + '<span class="font-mono text-slate-500">' + fmtMoney(it.total_amount || it.totalAmount) + '</span></div>';
                }).join('') : '<p class="text-slate-400 text-xs">无明细</p>')
                + '</div>';
            if (actions) {
                var canInspect = st === 'D018002' || st === 'D018003';
                actions.innerHTML = canInspect
                    ? '<button type="button" onclick="TM_Returns.closeDetail(); TM_Returns.openInspect(' + returnId + ')" class="w-full py-3 rounded-xl bg-teal-500 text-white text-xs font-bold">去验收</button>'
                    : '<button type="button" onclick="TM_Returns.closeDetail()" class="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold">关闭</button>';
            }
            openModal(document.getElementById('return-detail-modal'));
        }).catch(function (err) {
            notify(err.message || '加载详情失败', 'error');
        });
    }

    function closeDetail() {
        closeModal(document.getElementById('return-detail-modal'));
    }

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
        if (!window.renderDetailOrderItems || !window.renderDetailOrderItems.__tmReturnsWrapped) {
            _patched = false;
        }
        patchDetailItemsRender();
    }

    window.TM_Returns = {
        init: init,
        loadList: loadList,
        openDetail: openDetail,
        closeDetail: closeDetail,
        openCreateFromDetail: openCreateFromDetail,
        closeCreateModal: closeCreateModal,
        submitCreate: submitCreate,
        openInspect: openInspect,
        closeInspectModal: closeInspectModal,
        submitInspect: submitInspect,
        syncDetailReturnUi: syncDetailReturnUi,
        patchDetailItemsRender: patchDetailItemsRender,
        injectReturnColumns: injectReturnColumns,
        loadDetailReturnsSummary: loadDetailReturnsSummary
    };
})();
