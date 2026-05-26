/**
 * 工作台订单详情/新建弹窗：布局、收款、部分发货（对齐进货单弹窗）
 */
(function () {
    'use strict';

    var MAX_ITEM_ROWS = 5;
    var ROW_HEIGHT = '2.75rem';

    function roundMoney(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    }

    function refreshItemsScroll(modalRootId) {
        var root = document.getElementById(modalRootId);
        if (!root) return;
        var rows = root.querySelectorAll('.order-item-row');
        var n = rows.length;
        var scrollAreas = root.querySelectorAll('.tm-order-items-scroll, #detail-order-items-cards');
        scrollAreas.forEach(function (el) {
            el.classList.toggle('tm-order-items--scroll', n > MAX_ITEM_ROWS);
            el.style.flex = n > MAX_ITEM_ROWS ? '1 1 auto' : '0 0 auto';
            el.style.maxHeight = n > MAX_ITEM_ROWS ? ('calc(' + ROW_HEIGHT + ' * ' + MAX_ITEM_ROWS + ' + 2.5rem)') : '';
            el.style.overflowY = n > MAX_ITEM_ROWS ? 'auto' : 'visible';
        });
        var core = root.querySelector('.tm-order-items-core');
        if (core) core.classList.toggle('tm-order-items-core--compact', n <= MAX_ITEM_ROWS);
    }

    function setAuxOpen(detailsId, open) {
        var details = document.getElementById(detailsId);
        if (details) details.open = !!open;
    }

    window.TM_OrderModal = {
        roundMoney: roundMoney,
        refreshItemsScroll: refreshItemsScroll,
        setAuxOpen: setAuxOpen,
        MAX_ITEM_ROWS: MAX_ITEM_ROWS
    };
})();
