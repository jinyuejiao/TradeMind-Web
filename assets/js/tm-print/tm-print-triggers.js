/**
 * 打印触发器 — 订单详情 / 极速开单 / 进货单联动
 */
(function (global) {
    'use strict';

    function notify(msg, type) {
        if (global.TM_UI && global.TM_UI.showNotification) global.TM_UI.showNotification(msg, type || 'info');
    }

    function isMobile() {
        return global.matchMedia && global.matchMedia('(max-width: 767px)').matches;
    }

    function pickSalesDocType() {
        return isMobile() ? 'SALES_RECEIPT' : 'SALES_ORDER';
    }

    function pickPurchaseDocType() {
        return isMobile() ? 'INBOUND_NOTE' : 'PURCHASE_ORDER';
    }

    async function confirmPrint(message) {
        if (global.TM_UI && typeof global.TM_UI.confirm === 'function') {
            return global.TM_UI.confirm({
                title: '打印单据',
                message: message || '是否立即打印？',
                confirmLabel: '打印',
                cancelLabel: '稍后'
            });
        }
        return global.confirm(message || '是否立即打印？');
    }

    function ensurePrintReady(showError) {
        if (global.TM_Print && global.TM_PrintApi) return true;
        if (showError !== false) notify('打印模块未加载，请刷新页面（Ctrl+F5）后重试', 'error');
        return false;
    }

    global.TM_openPeripheralSettings = function () {
        if (global.TM_Peripheral && typeof global.TM_Peripheral.open === 'function') {
            return global.TM_Peripheral.open();
        }
        notify('外设设置模块未加载，请刷新页面后重试', 'error');
        return Promise.resolve();
    };

    global.TM_PrintTriggers = {
        pickSalesDocType: pickSalesDocType,
        pickPurchaseDocType: pickPurchaseDocType,

        syncOrderDetailPrintBtn: function (orderId) {
            var printBtn = document.getElementById('detail-print-btn');
            if (!printBtn) return;
            if (orderId) {
                printBtn.classList.remove('hidden');
                if (typeof global.applyRoleUI === 'function') {
                    global.applyRoleUI({ skipTabSync: true });
                }
            } else {
                printBtn.classList.add('hidden');
            }
        },

        printOrderDetail: function (docType) {
            var orderId = global.currentDetailOrderId;
            if (!orderId) {
                notify('请先打开订单', 'error');
                return Promise.resolve();
            }
            if (!ensurePrintReady()) return Promise.resolve();
            return global.TM_Print.print({
                docType: docType || pickSalesDocType(),
                docId: String(orderId)
            });
        },

        showOrderPrintMenu: function (anchorEl) {
            var orderId = global.currentDetailOrderId;
            if (!orderId) {
                notify('请先打开订单', 'error');
                return;
            }
            if (!ensurePrintReady()) return;
            var existing = document.getElementById('tm-print-type-menu');
            if (existing) { existing.remove(); return; }
            var menu = document.createElement('div');
            menu.id = 'tm-print-type-menu';
            menu.className = 'tm-print-type-menu fixed z-[200] bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs min-w-[9rem]';
            var items = [
                { label: '销售单', type: 'SALES_ORDER' },
                { label: '送货单', type: 'DELIVERY_NOTE' },
                { label: '结账单', type: 'SALES_RECEIPT' }
            ];
            items.forEach(function (it) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'block w-full text-left px-3 py-2 hover:bg-slate-50 font-bold text-slate-700';
                btn.textContent = it.label;
                btn.addEventListener('click', function () {
                    menu.remove();
                    global.TM_PrintTriggers.printOrderDetail(it.type);
                });
                menu.appendChild(btn);
            });
            document.body.appendChild(menu);
            var anchor = anchorEl || document.getElementById('detail-print-btn');
            if (anchor) {
                var rect = anchor.getBoundingClientRect();
                menu.style.left = Math.max(8, rect.left) + 'px';
                menu.style.top = (rect.top - menu.offsetHeight - 6) + 'px';
            } else {
                menu.style.left = '50%';
                menu.style.top = '40%';
                menu.style.transform = 'translateX(-50%)';
            }
            setTimeout(function () {
                document.addEventListener('click', function handler(e) {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', handler);
                    }
                });
            }, 0);
        },

        printLastRapidOrder: function (orderId, docType) {
            if (!orderId || !ensurePrintReady(false)) return Promise.resolve();
            return global.TM_Print.print({
                docType: docType || pickSalesDocType(),
                docId: String(orderId)
            });
        },

        printPurchase: function (purchaseId, docType) {
            if (!purchaseId || !ensurePrintReady()) {
                if (!purchaseId) notify('请先保存进货单', 'error');
                return Promise.resolve();
            }
            return global.TM_Print.print({
                docType: docType || pickPurchaseDocType(),
                docId: String(purchaseId)
            });
        },

        showPurchasePrintMenu: function (anchorEl, purchaseId) {
            var pid = purchaseId || (global.SupplierModule && global.SupplierModule.currentPurchase
                ? global.SupplierModule.currentPurchase.purchaseId : null);
            if (!pid) {
                notify('请先保存进货单', 'error');
                return;
            }
            if (!ensurePrintReady()) return;
            var existing = document.getElementById('tm-print-type-menu');
            if (existing) { existing.remove(); return; }
            var menu = document.createElement('div');
            menu.id = 'tm-print-type-menu';
            menu.className = 'tm-print-type-menu fixed z-[200] bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs min-w-[9rem]';
            [
                { label: '进货单', type: 'PURCHASE_ORDER' },
                { label: '入库单', type: 'INBOUND_NOTE' }
            ].forEach(function (it) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'block w-full text-left px-3 py-2 hover:bg-slate-50 font-bold text-slate-700';
                btn.textContent = it.label;
                btn.addEventListener('click', function () {
                    menu.remove();
                    global.TM_PrintTriggers.printPurchase(pid, it.type);
                });
                menu.appendChild(btn);
            });
            document.body.appendChild(menu);
            var el = anchorEl || document.getElementById('purchase-print-btn');
            if (el) {
                var rect = el.getBoundingClientRect();
                menu.style.left = Math.max(8, rect.left) + 'px';
                menu.style.top = (rect.top - menu.offsetHeight - 6) + 'px';
            }
        },

        offerPrintAfterCreate: async function (orderId, docType, message) {
            if (!orderId || !ensurePrintReady(false)) return;
            var ok = await confirmPrint(message || '订单已创建，是否立即打印？');
            if (ok) await global.TM_PrintTriggers.printLastRapidOrder(orderId, docType);
        },

        offerPrintAfterShip: async function (orderId, message) {
            if (!orderId || !ensurePrintReady(false)) return;
            var ok = await confirmPrint(message || '发货成功，是否打印送货单？');
            if (ok) {
                return global.TM_Print.print({ docType: 'DELIVERY_NOTE', docId: String(orderId) });
            }
        },

        offerPrintAfterPayment: async function (orderId, message) {
            if (!orderId || !ensurePrintReady(false)) return;
            var ok = await confirmPrint(message || '收款成功，是否打印结账单？');
            if (ok) {
                return global.TM_Print.print({
                    docType: isMobile() ? 'SALES_RECEIPT' : 'PAYMENT_VOUCHER',
                    docId: String(orderId)
                });
            }
        },

        offerPrintPurchaseAfterSave: async function (purchaseId, message) {
            if (!purchaseId || !ensurePrintReady(false)) return;
            var ok = await confirmPrint(message || '进货单已保存，是否立即打印？');
            if (ok) await global.TM_PrintTriggers.printPurchase(purchaseId);
        },

        syncPurchasePrintBtn: function (purchaseId) {
            var btn = document.getElementById('purchase-print-btn');
            if (!btn) return;
            if (purchaseId) {
                btn.classList.remove('hidden');
                if (typeof global.applyRoleUI === 'function') {
                    global.applyRoleUI({ skipTabSync: true });
                }
            } else {
                btn.classList.add('hidden');
            }
        }
    };
})(window);
