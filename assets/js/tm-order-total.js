/**
 * TradeMind — 订单/进货总计卡片（tm-order-total-card）
 */
(function () {
    'use strict';

    var TEMPLATE_HTML =
        '<div class="tm-order-total-card">' +
        '<div class="tm-order-total-card__watermark" aria-hidden="true"><i class="ph ph-currency-cny"></i></div>' +
        '<div class="tm-order-total-card__text">' +
        '<p class="tm-order-total-card__title"></p>' +
        '<p class="tm-order-total-card__subtitle"></p>' +
        '</div>' +
        '<div class="tm-order-total-card__amount-wrap">' +
        '<span class="tm-order-total-card__amount"></span>' +
        '</div></div>';

    function formatAmount(amount) {
        if (typeof window.TM_formatCNY === 'function') {
            return window.TM_formatCNY(amount);
        }
        var n = parseFloat(amount) || 0;
        return '¥' + n.toFixed(2);
    }

    function render(mountEl, opts) {
        if (!mountEl) return null;
        opts = opts || {};
        mountEl.innerHTML = TEMPLATE_HTML;
        var card = mountEl.querySelector('.tm-order-total-card') || mountEl.firstElementChild;
        updateCard(card, opts);
        if (opts.amountId && card) {
            var amountEl = card.querySelector('.tm-order-total-card__amount');
            if (amountEl) amountEl.id = opts.amountId;
        }
        return card;
    }

    function updateCard(card, opts) {
        if (!card) return;
        var titleEl = card.querySelector('.tm-order-total-card__title');
        var subEl = card.querySelector('.tm-order-total-card__subtitle');
        var amountEl = card.querySelector('.tm-order-total-card__amount');
        if (titleEl && opts.title != null) titleEl.textContent = opts.title;
        if (subEl && opts.subtitle != null) subEl.textContent = opts.subtitle;
        if (amountEl && opts.amount != null) amountEl.textContent = formatAmount(opts.amount);
    }

    function update(amountElId, amount) {
        var el = typeof amountElId === 'string' ? document.getElementById(amountElId) : amountElId;
        if (!el) return;
        el.textContent = formatAmount(amount);
    }

    function mountById(mountId, opts) {
        var el = document.getElementById(mountId);
        if (!el) return null;
        return render(el, opts);
    }

    window.TM_OrderTotal = {
        render: render,
        update: update,
        mountById: mountById,
        formatAmount: formatAmount
    };
})();
