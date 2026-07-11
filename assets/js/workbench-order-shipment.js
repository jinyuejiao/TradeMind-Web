/**
 * 订单详情：欠货行展示与物流录入
 */
(function () {
    'use strict';

    var LOGISTICS_BRANDS = ['顺丰', '中通', '圆通', '韵达', '申通', '极兔', '德邦', '自配送'];

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification(msg, type || 'info');
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg);
        }
    }

    function shortageHint(item) {
        var sq = item.shortage_qty != null ? item.shortage_qty : item.shortageQty;
        if (!sq || sq <= 0) return '';
        var plan = item.fulfillment_plan || item.fulfillmentPlan || '';
        return '<p class="text-[10px] text-rose-600 mt-0.5 font-bold">欠货 ' + sq + ' 件' +
            (plan ? (' · ' + plan) : '') + '</p>';
    }

    function shipmentListHtml(item) {
        var list = item.shipments || [];
        if (!list.length) return '';
        return '<ul class="mt-1 space-y-0.5">' + list.map(function (s) {
            var brand = s.logistics_brand || s.logisticsBrand || '';
            var no = s.tracking_no || s.trackingNo || '';
            return '<li class="text-[10px] text-slate-500">' + brand + ' ' + no + ' ×' + (s.shipped_qty || s.shippedQty || 0) + '</li>';
        }).join('') + '</ul>';
    }

    function shipFormHtml(orderId, item) {
        var itemId = item.itemId || item.item_id;
        var sq = item.shortage_qty != null ? item.shortage_qty : item.shortageQty;
        if (!sq || sq <= 0) return '';
        var brands = LOGISTICS_BRANDS.map(function (b) {
            return '<option value="' + b + '">' + b + '</option>';
        }).join('');
        return '<div class="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100 tm-ship-form" data-item-id="' + itemId + '">' +
            '<p class="text-[10px] font-bold text-slate-500 mb-1">登记发货/物流</p>' +
            '<div class="flex flex-wrap gap-2 items-end">' +
            '<label class="text-[10px]">数量<input type="number" min="1" max="' + sq + '" value="' + sq + '" class="tm-ship-qty form-input form-input--compact w-14 text-xs ml-1" /></label>' +
            '<label class="text-[10px]">品牌<select class="tm-ship-brand form-input form-input--compact text-xs ml-1">' + brands + '</select></label>' +
            '<label class="text-[10px] flex-1 min-w-[120px]">单号<input type="text" class="tm-ship-tracking form-input form-input--compact w-full text-xs ml-1" placeholder="扫码或输入" /></label>' +
            '<button type="button" class="tm-ship-submit px-3 py-1 rounded-lg bg-brand-500 text-white text-[10px] font-bold" data-order-id="' + orderId + '" data-item-id="' + itemId + '">发货</button>' +
            '</div></div>';
    }

    window.TM_enhanceDetailItemsWithShortage = async function (orderId) {
        if (!orderId || !window.wrappedFetch) return;
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/orders/' + orderId + '/items-detail', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var items = data && data.data ? data.data : [];
            if (!items.length) return;
            window.detailOrderItemsCache = items;
            var cards = document.getElementById('detail-order-items-cards');
            if (cards) {
                cards.querySelectorAll('.tm-shortage-extra').forEach(function (el) { el.remove(); });
                items.forEach(function (item) {
                    var itemId = String(item.itemId || item.item_id);
                    var card = cards.querySelector('[data-item-id="' + itemId + '"]');
                    if (!card) return;
                    var extra = document.createElement('div');
                    extra.className = 'tm-shortage-extra';
                    extra.innerHTML = shortageHint(item) + shipmentListHtml(item) + shipFormHtml(orderId, item);
                    card.appendChild(extra);
                });
                cards.querySelectorAll('.tm-ship-submit').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        submitShipment(btn);
                    });
                });
            }
        } catch (e) {
            console.warn('[Shipment] 加载欠货详情失败', e);
        }
    };

    async function submitShipment(btn) {
        var form = btn.closest('.tm-ship-form');
        if (!form) return;
        var orderId = btn.getAttribute('data-order-id');
        var itemId = btn.getAttribute('data-item-id');
        var qty = parseInt(form.querySelector('.tm-ship-qty').value, 10) || 0;
        var brand = form.querySelector('.tm-ship-brand').value;
        var tracking = form.querySelector('.tm-ship-tracking').value.trim();
        if (qty <= 0) {
            notify('请输入发货数量', 'error');
            return;
        }
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/orders/' + orderId + '/items/' + itemId + '/shipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shippedQty: qty,
                    shipmentType: 'EXPRESS',
                    logisticsBrand: brand,
                    trackingNo: tracking
                })
            });
            await window.handleApiResponse(resp);
            notify('发货登记成功', 'success');
            if (typeof window.openOrderDetail === 'function') window.openOrderDetail(orderId);
            if (typeof window.loadInProgressOrders === 'function') window.loadInProgressOrders();
        } catch (e) {
            notify(e.message || '发货失败', 'error');
        }
    }

    var origOpen = window.openOrderDetail;
    if (typeof origOpen === 'function') {
        window.openOrderDetail = async function () {
            var r = origOpen.apply(this, arguments);
            var orderId = arguments[0];
            setTimeout(function () { window.TM_enhanceDetailItemsWithShortage(orderId); }, 400);
            return r;
        };
    }
})();
