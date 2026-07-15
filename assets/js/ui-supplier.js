// Tab 切换函数
function switchSupplierMainView(viewType) {
    // 隐藏所有 Tab 内容
    document.querySelectorAll('.supplier-tab-content').forEach(el => el.classList.add('hidden'));
    // 显示选中的 Tab 内容
    document.getElementById('supplier-tab-' + viewType).classList.remove('hidden');
    
    // 更新按钮样式
    document.querySelectorAll('[id^="supplier-tab-btn-"]').forEach(btn => {
        btn.classList.remove('active', 'text-white', 'text-slate-600');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.getElementById('supplier-tab-btn-' + viewType);
    if (activeBtn) {
        activeBtn.classList.add('active', 'text-white');
        activeBtn.classList.remove('text-slate-400');
    }

    const chips = document.getElementById('sup-stat-chips');
    if (chips) {
        if (viewType === 'list') {
            chips.classList.remove('hidden');
        } else {
            chips.classList.add('hidden');
        }
    }
    if (viewType === 'list' && window.SupplierModule && typeof SupplierModule.loadPurchaseSummary === 'function') {
        SupplierModule.loadPurchaseSummary();
    }
}
window.switchSupplierView = switchSupplierMainView;

function TM_embedModalMarkOpen(open) {
    /* 由 TM_openUnifiedModal / TM_closeUnifiedModal 统一管理 */
}

function TM_openEmbedModalFallback(modal, opts) {
    if (!modal) return;
    if (typeof window.TM_openUnifiedModal === 'function') {
        window.TM_openUnifiedModal(modal, opts);
    } else {
        modal.classList.remove('hidden');
        if (typeof window.TM_notifyEmbedModal === 'function') {
            window.TM_notifyEmbedModal(true);
        }
        document.body.style.overflow = 'hidden';
    }
}
window.TM_openEmbedModalFallback = TM_openEmbedModalFallback;

function TM_closeEmbedModalFallback(modal) {
    if (!modal) return;
    if (typeof window.TM_closeUnifiedModal === 'function') {
        window.TM_closeUnifiedModal(modal);
    } else {
        modal.classList.add('hidden');
        if (typeof window.TM_notifyEmbedModal === 'function') {
            window.TM_notifyEmbedModal(false);
        }
        document.body.style.overflow = '';
    }
}
window.TM_closeEmbedModalFallback = TM_closeEmbedModalFallback;

window.SupplierModule = {
    PAGE_SIZE: 20,
    states: [],
    suppliers: [],
    allSuppliers: [],
    purchases: [],
    products: [],
    accounts: [],
    warehouses: [],
    currentSupplier: null,
    currentPurchase: null,
    supplierCurrentPage: 1,
    purchaseCurrentPage: 1,
    supplierTotal: 0,
    supplierTotalPages: 1,
    purchaseTotal: 0,
    purchaseTotalPages: 1,

    init: async function() {
        console.log('SupplierModule initialized');
        await Promise.all([
            this.loadStatuses(),
            this.loadSuppliers(),
            this.loadAllSuppliers(),
            this.loadPurchases(),
            this.loadProducts(),
            this.loadAccounts(),
            this.loadWarehouses()
        ]);
        this.renderSuppliers();
        this.renderPurchases();
        this.loadPurchaseSummary();
        this.initDateInput();
        this.bindPurchaseFinEvents();
        if (!this._tmPurchasesChangedBound) {
            this._tmPurchasesChangedBound = true;
            var self = this;
            window.addEventListener('tm-purchases-changed', function () {
                self.loadPurchases(self.purchaseCurrentPage || 1).then(function () {
                    self.renderPurchases();
                    self.loadPurchaseSummary();
                });
            });
        }
    },

    loadWarehouses: async function() {
        try {
            var response = await window.wrappedFetch('/api/v1/rd/products/warehouses', { method: 'GET' });
            if (window.TM_TenantOps) {
                window.__tmOpsProfile = await window.TM_TenantOps.fetchOpsProfile();
            }
            if (response.ok) {
                var result = await response.json();
                this.warehouses = (result.data || result) || [];
                this.populateWarehouseSelect();
            }
        } catch (e) {
            console.warn('loadWarehouses', e);
        }
    },

    populateWarehouseSelect: function() {
        var sel = document.getElementById('purchase-warehouse');
        if (!sel) return;
        var prev = sel.value;
        var profile = window.__tmOpsProfile || null;
        if (window.TM_TenantOps) {
            sel.innerHTML = window.TM_TenantOps.buildWarehouseOptionsHtml(this.warehouses, profile, prev || null);
        } else if ((this.warehouses || []).length) {
            var html = '';
            (this.warehouses || []).forEach(function(w, idx) {
                var id = w.warehouseId != null ? w.warehouseId : w.id;
                var selFlag = (prev && String(id) === String(prev)) || (!prev && idx === 0);
                html += '<option value="' + id + '"' + (selFlag ? ' selected' : '') + '>' +
                    (w.name || ('仓库#' + id)) + '</option>';
            });
            sel.innerHTML = html;
        } else {
            sel.innerHTML = '<option value="">暂无仓库</option>';
        }
        if (prev) {
            sel.value = prev;
        }
    },

    roundMoney: function(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    },

    getFormLineTotal: function() {
        var total = 0;
        var self = this;
        document.querySelectorAll('#purchase-modal .purchase-item-row').forEach(function(row) {
            var qty = parseFloat(row.querySelector('.qty-input') && row.querySelector('.qty-input').value) || 0;
            var price = self.readRowUnitPrice(row);
            total += qty * price;
        });
        return this.roundMoney(total);
    },

    getServerPayTotals: function(purchase) {
        purchase = purchase || this.currentPurchase;
        if (!purchase) {
            return { total: 0, paid: 0, remaining: 0 };
        }
        var total = this.roundMoney(purchase.totalAmount != null ? purchase.totalAmount : 0);
        var paid = this.roundMoney(purchase.paidAmount != null ? purchase.paidAmount : 0);
        var remaining = Math.max(0, this.roundMoney(total - paid));
        return { total: total, paid: paid, remaining: remaining };
    },

    hasUnsavedPurchaseChanges: function() {
        if (!this.currentPurchase || !this.currentPurchase.purchaseId) return false;
        var formTotal = this.getFormLineTotal();
        var serverTotal = this.roundMoney(this.currentPurchase.totalAmount);
        return Math.abs(formTotal - serverTotal) > 0.01;
    },

    getPurchaseTotals: function(purchase) {
        var total = this.getFormLineTotal();
        if (total <= 0 && purchase && purchase.totalAmount != null) {
            total = this.roundMoney(purchase.totalAmount);
        } else if (total <= 0 && this.currentPurchase && this.currentPurchase.totalAmount != null) {
            total = this.roundMoney(this.currentPurchase.totalAmount);
        }
        var paidSource = purchase || this.currentPurchase;
        var paid = (paidSource && paidSource.paidAmount != null) ? Number(paidSource.paidAmount) : 0;
        paid = this.roundMoney(paid);
        total = this.roundMoney(total);
        var remaining = Math.max(0, this.roundMoney(total - paid));
        return { total: total, paid: paid, remaining: remaining };
    },

    getPayableTotals: function(purchase) {
        purchase = purchase || this.currentPurchase;
        var form = this.getPurchaseTotals(purchase);
        if (!purchase || !purchase.purchaseId) {
            return form;
        }
        var server = this.getServerPayTotals(purchase);
        if (this.hasUnsavedPurchaseChanges()) {
            return form;
        }
        return {
            total: server.total,
            paid: server.paid,
            remaining: server.remaining
        };
    },

    updateRemainingHint: function(purchase) {
        var totals = this.getPayableTotals(purchase || this.currentPurchase);
        var fmt = function(v) { return '¥' + (Number(v) || 0).toFixed(2); };
        var payTotal = document.getElementById('purchase-pay-total');
        var paidSum = document.getElementById('purchase-paid-sum');
        var paidWrap = document.getElementById('purchase-paid-wrap');
        var remWrap = document.getElementById('purchase-remaining-wrap');
        var remSum = document.getElementById('purchase-remaining-sum');
        if (payTotal) payTotal.textContent = fmt(totals.total);
        if (paidSum) paidSum.textContent = fmt(totals.paid);
        if (paidWrap) paidWrap.classList.toggle('hidden', totals.paid <= 0);
        if (remWrap) remWrap.classList.toggle('hidden', totals.remaining <= 0.001);
        if (remSum) remSum.textContent = fmt(totals.remaining);
        var unsavedHint = document.getElementById('purchase-unsaved-pay-hint');
        if (unsavedHint) {
            unsavedHint.classList.toggle('hidden', !this.hasUnsavedPurchaseChanges());
        }
        this.updateAuxSummary(totals);
        return totals;
    },

    updateAuxSummary: function(totals) {
        var el = document.getElementById('purchase-aux-summary');
        if (!el) return;
        totals = totals || this.getPurchaseTotals(this.currentPurchase);
        var whSel = document.getElementById('purchase-warehouse');
        var whLabel = '默认仓库';
        if (whSel && whSel.value) {
            var opt = whSel.options[whSel.selectedIndex];
            whLabel = opt ? opt.textContent : whLabel;
        }
        var finSel = document.getElementById('purchase-fin-status');
        var finMap = { UNPAID: '未付款', PARTIAL_PAID: '部分付', SETTLED: '已结清' };
        var fin = finSel ? (finMap[finSel.value] || finSel.value) : '未付款';
        el.textContent = whLabel + ' · ' + fin + ' · 应付 ¥' + (totals.total || 0).toFixed(2);
    },

    setPurchaseAuxOpen: function(open) {
        var details = document.getElementById('purchase-aux-details');
        if (details) details.open = !!open;
        if (open) {
            this.ensurePurchaseFooterVisible();
        }
    },

    ensurePurchaseFooterVisible: function() {
        requestAnimationFrame(function () {
            var panel = document.querySelector('#purchase-modal .tm-dialog-panel');
            var dock = document.querySelector('#purchase-modal .tm-purchase-bottom-dock');
            var footer = document.querySelector('#purchase-modal .tm-purchase-modal-footer');
            if (panel) panel.scrollTop = 0;
            if (dock && dock.scrollHeight > dock.clientHeight) {
                dock.scrollTop = dock.scrollHeight;
            }
            if (footer) {
                footer.classList.remove('tm-purchase-footer-clipped');
            }
        });
    },

    syncFinStatusUI: function(purchase, opts) {
        opts = opts || {};
        var finSel = document.getElementById('purchase-fin-status');
        var amountEl = document.getElementById('purchase-pay-amount');
        var payBtn = document.getElementById('purchase-confirm-pay-btn');
        var hintUnpaid = document.getElementById('purchase-fin-hint-unpaid');
        var hintDisabled = document.getElementById('purchase-fin-disabled-hint');
        if (opts.applyPurchaseFin && finSel && purchase && purchase.finStatus) {
            finSel.value = purchase.finStatus;
        }
        if (finSel && !finSel.value) finSel.value = 'UNPAID';

        var totals = this.updateRemainingHint(purchase);
        var hasSaved = !!(this.currentPurchase && this.currentPurchase.purchaseId);
        var finVal = finSel ? finSel.value : ((purchase && purchase.finStatus) || 'UNPAID');

        var canPay = finVal !== 'UNPAID' && totals.remaining > 0.001;
        if (hintDisabled) {
            if (canPay && !hasSaved) {
                hintDisabled.textContent = '确认付款将自动保存单据';
                hintDisabled.classList.remove('hidden');
            } else if (!canPay && !hasSaved) {
                hintDisabled.textContent = '选择「部分付款」或「已结清」后可确认付款';
                hintDisabled.classList.remove('hidden');
            } else {
                hintDisabled.classList.add('hidden');
            }
        }
        if (hintUnpaid) {
            var showUnpaidHint = hasSaved && finVal === 'UNPAID' && totals.paid > 0;
            hintUnpaid.classList.toggle('hidden', !showUnpaidHint);
        }

        if (amountEl) {
            if (finVal === 'UNPAID') {
                amountEl.value = '';
                amountEl.disabled = true;
            } else {
                amountEl.disabled = false;
                if (finVal === 'SETTLED') {
                    amountEl.value = totals.remaining > 0 ? totals.remaining.toFixed(2) : '';
                }
            }
        }

        if (payBtn) {
            payBtn.disabled = !canPay;
            payBtn.title = finVal === 'UNPAID'
                ? '请选择「部分付款」或「已结清」后再确认付款'
                : (finVal === 'SETTLED' && totals.remaining <= 0.001 ? '货款已结清，无需再付款' : '');
        }

        this.updatePurchaseBadges(purchase || this.currentPurchase);
        this.updateAuxSummary();
    },

    bindPurchaseFinEvents: function() {
        if (this._finEventsBound) return;
        this._finEventsBound = true;
        var self = this;
        var auxDetails = document.getElementById('purchase-aux-details');
        if (auxDetails && !auxDetails.__tmAuxToggleBound) {
            auxDetails.__tmAuxToggleBound = true;
            auxDetails.addEventListener('toggle', function () {
                if (auxDetails.open) self.setPurchaseAuxOpen(true);
            });
        }
        var finSel = document.getElementById('purchase-fin-status');
        if (finSel) {
            finSel.addEventListener('change', function() {
                self.syncFinStatusUI();
                if (finSel.value === 'PARTIAL_PAID' || finSel.value === 'SETTLED') {
                    self.setPurchaseAuxOpen(true);
                }
                self.ensurePurchaseFooterVisible();
            });
        }
        var whSel = document.getElementById('purchase-warehouse');
        if (whSel) {
            whSel.addEventListener('change', function() { self.updateAuxSummary(); });
        }
        var statusSel = document.getElementById('purchase-status');
        if (statusSel) {
            statusSel.addEventListener('change', function() {
                self.updatePurchaseBadges();
                self.syncInboundUi();
            });
        }
        var purchaseModal = document.getElementById('purchase-modal');
        if (purchaseModal && !purchaseModal.__tmUnitChangeBound) {
            purchaseModal.__tmUnitChangeBound = true;
            purchaseModal.addEventListener('change', function (ev) {
                var target = ev.target;
                if (!target || !target.classList || !target.classList.contains('unit-select')) return;
                // 程序化填充单位下拉时会触发 change，不得覆盖已保存/已编辑单价
                if (target.__tmSuppressUnitChange || self._suppressUnitPriceAutoFill) return;
                var row = target.closest('.purchase-item-row');
                if (!row) return;
                var productSel = row.querySelector('.product-select');
                var priceInput = row.querySelector('.price-input');
                if (!productSel || !productSel.value || !priceInput) return;
                if (priceInput.dataset.lockedPrice === '1' || priceInput.dataset.userEdited === '1') {
                    self.calculatePurchaseTotal();
                    return;
                }
                var product = self.products.find(function (p) {
                    var pid = p.productId != null ? p.productId : p.id;
                    return String(pid) === String(productSel.value);
                });
                if (product) {
                    // 编辑已有单据行：禁止因单位 change 拉历史价盖掉单据单价
                    if (self.currentPurchase && self.currentPurchase.purchaseId
                        && priceInput.dataset.autofillOk !== '1') {
                        self.calculatePurchaseTotal();
                        return;
                    }
                    self.resolvePurchaseUnitPrice(Number(productSel.value), product, target, priceInput);
                    self.calculatePurchaseTotal();
                }
            });
        }
    },

    shouldShowInboundChecks: function() {
        var statusEl = document.getElementById('purchase-status');
        var st = statusEl ? statusEl.value : '';
        return st === 'PARTIAL_INBOUND';
    },

    resolvePurchaseItemId: function(item) {
        if (!item) return null;
        if (item.pItemId != null && item.pItemId !== '') return item.pItemId;
        if (item.p_item_id != null && item.p_item_id !== '') return item.p_item_id;
        if (item.pitemId != null && item.pitemId !== '') return item.pitemId;
        return null;
    },

    fetchPurchaseDetail: async function(purchaseId) {
        if (!purchaseId) return null;
        try {
            var resp = await window.wrappedFetch('/api/v1/supp/purchases/' + purchaseId, { method: 'GET' });
            if (!resp.ok) return null;
            var result = await resp.json();
            return (result && result.success && result.data) ? result.data : null;
        } catch (e) {
            console.warn('fetchPurchaseDetail', e);
            return null;
        }
    },

    collectInboundItemIds: function() {
        var ids = [];
        var seen = {};
        var items = (this.currentPurchase && this.currentPurchase.items) || [];
        var rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
        var self = this;
        rows.forEach(function(row, idx) {
            var cb = row.querySelector('.purchase-inbound-check');
            if (!cb || !cb.checked || cb.disabled) return;
            var raw = cb.getAttribute('data-item-id') || cb.dataset.itemId || '';
            var parsed = parseInt(raw, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
                if (!seen[parsed]) {
                    seen[parsed] = true;
                    ids.push(parsed);
                }
                return;
            }
            var productSel = row.querySelector('.product-select');
            var productId = productSel && productSel.value ? String(productSel.value) : '';
            var match = null;
            if (productId) {
                match = items.find(function(it) {
                    var pid = it.productId != null ? it.productId : it.product_id;
                    var proc = it.isProcessed === true || it.is_processed === true;
                    return pid != null && String(pid) === productId && !proc;
                });
            }
            if (!match && items[idx]) {
                var candidate = items[idx];
                var proc0 = candidate.isProcessed === true || candidate.is_processed === true;
                if (!proc0) match = candidate;
            }
            var mid = self.resolvePurchaseItemId(match);
            if (mid != null) {
                var n = parseInt(mid, 10);
                if (!Number.isNaN(n) && n > 0 && !seen[n]) {
                    seen[n] = true;
                    ids.push(n);
                    cb.setAttribute('data-item-id', String(n));
                    cb.dataset.itemId = String(n);
                }
            }
        });
        return ids;
    },

    buildInboundCheckboxHtml: function(opts) {
        opts = opts || {};
        var itemId = opts.itemId != null && opts.itemId !== '' ? String(opts.itemId) : '';
        var processed = !!opts.processed;
        var disabled = processed ? ' disabled' : '';
        var checked = processed ? ' checked' : '';
        return (
            '<input type="checkbox" class="purchase-inbound-check w-4 h-4 accent-teal-600" ' +
            'data-item-id="' + itemId + '"' + checked + disabled + ' aria-label="本次入库">'
        );
    },

    syncInboundUi: function() {
        var show = this.shouldShowInboundChecks();
        var hasSaved = !!(this.currentPurchase && this.currentPurchase.purchaseId);
        document.querySelectorAll('#purchase-modal .purchase-inbound-col').forEach(function(el) {
            el.classList.toggle('hidden', !show);
        });
        var inboundHint = document.getElementById('purchase-inbound-hint');
        if (inboundHint) {
            inboundHint.classList.toggle('hidden', !show);
            if (show) {
                inboundHint.textContent = hasSaved
                    ? '勾选本次入库的明细行，再点「确认入库」'
                    : '部分入库需先保存单据，保存后可勾选明细';
            }
        }
        var inboundBtn = document.getElementById('purchase-inbound-btn');
        if (inboundBtn) {
            inboundBtn.classList.toggle('hidden', !show || !hasSaved);
        }
        if (show && hasSaved && this.currentPurchase && this.currentPurchase.items) {
            this.applyPurchaseItemIdsFromPurchase(this.currentPurchase);
        }
    },

    applyPurchaseItemIdsFromPurchase: function(purchase) {
        if (!purchase || !purchase.items || !purchase.items.length) return;
        var items = purchase.items;
        var rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
        var self = this;
        rows.forEach(function(row) {
            var cb = row.querySelector('.purchase-inbound-check');
            if (!cb) return;
            var productSel = row.querySelector('.product-select');
            var productId = productSel && productSel.value ? String(productSel.value) : '';
            var it = null;
            if (productId) {
                it = items.find(function(x) {
                    var pid = x.productId != null ? x.productId : x.product_id;
                    return pid != null && String(pid) === productId;
                });
            }
            if (!it) return;
            var id = self.resolvePurchaseItemId(it);
            if (id != null) {
                cb.setAttribute('data-item-id', String(id));
                cb.dataset.itemId = String(id);
            }
            var proc = it.isProcessed === true || it.is_processed === true;
            cb.disabled = proc;
            if (proc) cb.checked = true;
        });
    },

    updatePurchaseBadges: function(purchase) {
        var logEl = document.getElementById('purchase-badge-logistics');
        var finEl = document.getElementById('purchase-badge-finance');
        var statusSel = document.getElementById('purchase-status');
        var st = purchase && purchase.purchaseStatus ? purchase.purchaseStatus : (statusSel ? statusSel.value : 'DRAFT');
        var finMap = { UNPAID: '未付款', PARTIAL_PAID: '部分付款', SETTLED: '已结清' };
        var stName = (this.states.find(function(s) { return s.dictCode === st; }) || {}).dictName || st;
        if (logEl) logEl.innerHTML = '<i class="ph ph-truck"></i> ' + stName;
        var finSel = document.getElementById('purchase-fin-status');
        var fin = (finSel && finSel.value) ? finSel.value : ((purchase && purchase.finStatus) || 'UNPAID');
        if (finEl) {
            var finLabel = finMap[fin] || fin;
            finEl.innerHTML = '<i class="ph ph-currency-cny"></i> ' + finLabel;
            finEl.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold ring-1 ' +
                (fin === 'SETTLED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                    fin === 'PARTIAL_PAID' ? 'bg-sky-50 text-sky-700 ring-sky-200' :
                        'bg-amber-50 text-amber-700 ring-amber-200');
        }
        this.syncInboundUi();
    },

    recordPurchasePayment: async function() {
        if (!(await this.ensurePurchaseSaved({ forPayment: true }))) {
            return;
        }
        this.clearPurchaseFormError();
        var fresh = await this.fetchPurchaseDetail(this.currentPurchase.purchaseId);
        if (fresh) {
            this.currentPurchase = fresh;
        }
        var finSel = document.getElementById('purchase-fin-status');
        var finVal = finSel ? finSel.value : 'UNPAID';
        if (finVal === 'UNPAID') {
            this.showPurchaseFormError('未付款状态下不能确认付款；如需记账请先选择「部分付款」或「已结清」');
            return;
        }
        var amountEl = document.getElementById('purchase-pay-amount');
        var accEl = document.getElementById('purchase-pay-account');
        var totals = this.getServerPayTotals(this.currentPurchase);
        var remaining = totals.remaining;
        var amount = this.roundMoney(amountEl && amountEl.value ? amountEl.value : 0);
        var accountId = accEl && accEl.value ? parseInt(accEl.value, 10) : null;
        if (finVal === 'SETTLED' && remaining > 0) {
            amount = remaining;
            if (amountEl) amountEl.value = remaining.toFixed(2);
        }
        if (!amount || amount <= 0) {
            if (finVal === 'SETTLED' && remaining <= 0) {
                this.showPurchaseFormError('货款已结清，无需再付款');
            } else {
                this.showPurchaseFormError('请输入有效付款金额');
            }
            return;
        }
        var amountCents = Math.round(amount * 100);
        var remainingCents = Math.round(remaining * 100);
        if (amountCents > remainingCents) {
            if (amountCents - remainingCents <= 1) {
                amount = remaining;
                amountCents = remainingCents;
            } else {
                this.showPurchaseFormError('付款金额不能超过剩余货款 ¥' + remaining.toFixed(2));
                return;
            }
        }
        amount = this.roundMoney(amount);
        var virtualFin = window.TM_TenantOps && window.TM_TenantOps.isVirtualFinance(window.__tmOpsProfile);
        if (!virtualFin && !accountId) { this.showPurchaseFormError('请选择付款账户'); return; }
        try {
            var payBody = { amount: amount, bizTypeCode: 'PURCHASE_EXPENSE' };
            if (accountId) payBody.accountId = accountId;
            var response = await window.wrappedFetch('/api/v1/supp/purchases/' + this.currentPurchase.purchaseId + '/record-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payBody)
            });
            var result = await response.json();
            if (result.success) {
                this.currentPurchase = result.data;
                if (amountEl) amountEl.value = '';
                this.syncFinStatusUI(result.data, { applyPurchaseFin: true });
                this.setPurchaseAuxOpen(false);
                this.ensurePurchaseFooterVisible();
                this.notify('付款记账成功', 'success');
            } else {
                this.showPurchaseFormError(result.message || '记账失败');
            }
        } catch (e) {
            this.showPurchaseFormError(e.message || '记账失败');
        }
    },

    confirmPartialInbound: async function() {
        if (!this.currentPurchase || !this.currentPurchase.purchaseId) {
            this.showPurchaseFormError('请先保存进货单');
            return;
        }
        this.clearPurchaseFormError();
        var fresh = await this.fetchPurchaseDetail(this.currentPurchase.purchaseId);
        if (fresh) {
            this.currentPurchase = fresh;
            this.applyPurchaseItemIdsFromPurchase(fresh);
        }
        var wh = document.getElementById('purchase-warehouse');
        var warehouseId = wh && wh.value ? parseInt(wh.value, 10) : null;
        var itemIds = this.collectInboundItemIds();
        if (!itemIds.length) { this.showPurchaseFormError('请勾选本次入库的明细行'); return; }
        try {
            var response = await window.wrappedFetch('/api/v1/supp/purchases/' + this.currentPurchase.purchaseId + '/inbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetStatus: 'PARTIAL_INBOUND', warehouseId: warehouseId, itemIds: itemIds })
            });
            var result = await response.json();
            if (result.success) {
                this.currentPurchase = result.data;
                this.applyPurchaseItemIdsFromPurchase(result.data);
                this.updatePurchaseBadges(result.data);
                this.syncFinStatusUI(result.data, { applyPurchaseFin: true });
                this.syncInboundUi();
                await this.loadPurchases(this.purchaseCurrentPage);
                this.renderPurchases();
                this.notify('入库成功', 'success', { useDialog: true, title: '入库成功' });
            } else {
                this.showPurchaseFormError(result.message || '入库失败');
            }
        } catch (e) {
            this.showPurchaseFormError(e.message || '入库失败');
        }
    },

    loadStatuses: async function() {
        try {
            const response = await window.wrappedFetch('/api/v1/supp/purchase_orders/statuses', {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.states = result.data;
                }
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
        }
    },

    loadSuppliers: async function(pageNo) {
        try {
            var targetPage = pageNo || this.supplierCurrentPage || 1;
            const response = await window.wrappedFetch('/api/v1/supp/suppliers?pageNo=' + encodeURIComponent(targetPage) + '&pageSize=' + this.PAGE_SIZE, {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    if (Array.isArray(result.data)) {
                        this.suppliers = result.data;
                        this.supplierTotal = result.data.length;
                        this.supplierCurrentPage = 1;
                        this.supplierTotalPages = Math.max(1, Math.ceil(this.supplierTotal / this.PAGE_SIZE));
                    } else {
                        this.suppliers = result.data.records || [];
                        this.supplierTotal = Number(result.data.total || 0);
                        this.supplierCurrentPage = Number(result.data.pageNo || targetPage || 1);
                        this.supplierTotalPages = Number(result.data.totalPages || 1);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    },

    loadAllSuppliers: async function() {
        try {
            const response = await window.wrappedFetch('/api/v1/supp/suppliers?all=true', {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    this.allSuppliers = result.data;
                }
            }
        } catch (error) {
            console.error('Error loading all suppliers:', error);
        }
    },

    loadPurchases: async function(pageNo) {
        try {
            var targetPage = pageNo || this.purchaseCurrentPage || 1;
            const response = await window.wrappedFetch('/api/v1/supp/purchases?pageNo=' + encodeURIComponent(targetPage) + '&pageSize=' + this.PAGE_SIZE, {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    if (Array.isArray(result.data)) {
                        this.purchases = result.data;
                        this.purchaseTotal = result.data.length;
                        this.purchaseCurrentPage = 1;
                        this.purchaseTotalPages = Math.max(1, Math.ceil(this.purchaseTotal / this.PAGE_SIZE));
                    } else {
                        this.purchases = result.data.records || [];
                        this.purchaseTotal = Number(result.data.total || 0);
                        this.purchaseCurrentPage = Number(result.data.pageNo || targetPage || 1);
                        this.purchaseTotalPages = Number(result.data.totalPages || 1);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading purchases:', error);
        }
    },

    /** 兼容登录用户信息字段 tenantId / tenant_id */
    getTenantIdFromStorage: function() {
        try {
            var s = localStorage.getItem('user_info');
            if (!s) return '';
            var u = JSON.parse(s);
            var tid = u.tenantId != null ? u.tenantId : u.tenant_id;
            return tid != null ? String(tid) : '';
        } catch (e) {
            return '';
        }
    },

    loadProducts: async function() {
        this.products = [];
        try {
            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                var list = [];
                if (result && result.success && result.data != null) {
                    if (Array.isArray(result.data)) {
                        list = result.data;
                    } else if (result.data.records && Array.isArray(result.data.records)) {
                        list = result.data.records;
                    }
                }
                this.products = list.map(function (p) {
                    return SupplierModule.normalizeProductFromApi(p);
                });
            }
            var tid = this.getTenantIdFromStorage();
            if (this.products.length === 0 && tid) {
                const r2 = await window.wrappedFetch('/api/v1/rd/products/list/' + encodeURIComponent(tid), {
                    method: 'GET'
                });
                if (r2.ok) {
                    const j2 = await r2.json();
                    if (j2 && j2.success && Array.isArray(j2.data)) {
                        this.products = j2.data.map(function (p) {
                            return SupplierModule.normalizeProductFromApi(p);
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.products = [];
        }
    },

    /** 与产品中心对齐：归一化 baseUnit / purchaseUnit / unitConversions */
    normalizeProductFromApi: function(apiProduct) {
        if (!apiProduct) return {};
        var skuId = apiProduct.skuId != null ? apiProduct.skuId
            : (apiProduct.sku_id != null ? apiProduct.sku_id : null);
        var rawSale = apiProduct.salePrice != null ? apiProduct.salePrice
            : (apiProduct.price != null ? apiProduct.price : 0);
        var saleNum = Number(rawSale);
        if (!isFinite(saleNum) || saleNum < 0) saleNum = 0;
        // salePrice=0 时回退 price 字段
        if (saleNum <= 0 && apiProduct.price != null && Number(apiProduct.price) > 0) {
            saleNum = Number(apiProduct.price);
        }
        if (window.ProductModule && typeof window.ProductModule.mapProductFromApi === 'function') {
            var mapped = window.ProductModule.mapProductFromApi(apiProduct);
            mapped.productId = mapped.id != null ? mapped.id : apiProduct.productId;
            mapped.skuId = mapped.skuId != null ? mapped.skuId : skuId;
            mapped.salesUnit = mapped.salesUnit || (apiProduct.salesUnit || apiProduct.sales_unit || '').trim();
            mapped.purchaseUnit = mapped.purchaseUnit || (apiProduct.purchaseUnit || apiProduct.purchase_unit || '').trim();
            if (!(Number(mapped.price) > 0) && saleNum > 0) mapped.price = saleNum;
            return mapped;
        }
        var ucList = apiProduct.unitConversions || apiProduct.unit_conversions;
        return {
            productId: apiProduct.productId != null ? apiProduct.productId : apiProduct.id,
            id: apiProduct.productId != null ? apiProduct.productId : apiProduct.id,
            name: apiProduct.name || apiProduct.productName,
            productName: apiProduct.productName || apiProduct.name,
            skuId: skuId,
            baseUnit: (apiProduct.baseUnit || apiProduct.base_unit || '').trim(),
            purchaseUnit: (apiProduct.purchaseUnit || apiProduct.purchase_unit || '').trim(),
            salesUnit: (apiProduct.salesUnit || apiProduct.sales_unit || '').trim(),
            price: saleNum,
            purchasePrice: apiProduct.purchasePrice != null ? apiProduct.purchasePrice : apiProduct.costPrice,
            unitConversions: Array.isArray(ucList) ? ucList : []
        };
    },

    /** 进货行可选单位：基本单位 + unitConversion 表（去重） */
    collectPurchaseUnitOptions: function(product) {
        if (!product) return [];
        var base = (product.baseUnit || '').trim();
        var opts = [];
        var seen = {};

        function addUnit(value, label) {
            var v = (value || '').trim();
            if (!v) return;
            var key = v.toLowerCase();
            if (seen[key]) return;
            seen[key] = true;
            opts.push({ value: v, label: label || v });
        }

        if (base) {
            addUnit(base, base + '（基本单位）');
        }
        var pu = (product.purchaseUnit || '').trim();
        if (pu && (!base || pu.toLowerCase() !== base.toLowerCase())) {
            addUnit(pu, pu + '（进货单位）');
        }
        var convs = product.unitConversions || [];
        for (var i = 0; i < convs.length; i++) {
            var c = convs[i];
            var un = (c.unitName || c.unit_name || '').trim();
            var ratioNum = parseFloat(c.ratio != null ? c.ratio : c.perBase);
            if (!un || !ratioNum || ratioNum <= 0 || isNaN(ratioNum)) continue;
            var label = base
                ? un + '(1' + un + '=' + ratioNum + base + ')'
                : un;
            addUnit(un, label);
        }
        return opts;
    },

    isPackagingUnitAllowed: function (product, unitName) {
        if (!product || !unitName) return false;
        var unit = String(unitName).trim();
        var base = (product.baseUnit || '').trim();
        if (!unit) return false;
        if (base && unit === base) return true;
        var convs = product.unitConversions || [];
        for (var i = 0; i < convs.length; i++) {
            var un = (convs[i].unitName || convs[i].unit_name || '').trim();
            if (un && un === unit) return true;
        }
        return false;
    },

    findPurchaseProduct: function (productId) {
        return this.products.find(function (p) {
            var pid = p.productId != null ? p.productId : p.id;
            return String(pid) === String(productId);
        });
    },

    fillPurchaseUnitSelect: function(unitSelect, product, preferredUnit) {
        if (!unitSelect) return;
        // 清空/重建 option 时部分浏览器会同步触发 change，需抑制自动填价
        unitSelect.__tmSuppressUnitChange = true;
        try {
            unitSelect.innerHTML = '';
            var opts = this.collectPurchaseUnitOptions(product);
            if (!opts.length) {
                var empty = document.createElement('option');
                empty.value = '';
                empty.textContent = '--- 单位 ---';
                unitSelect.appendChild(empty);
                return;
            }
            opts.forEach(function (o) {
                var option = document.createElement('option');
                option.value = o.value;
                option.textContent = o.label;
                unitSelect.appendChild(option);
            });
            var base = (product.baseUnit || '').trim();
            var pu = (product.purchaseUnit || '').trim();
            var target = (preferredUnit != null && String(preferredUnit).trim() !== '')
                ? String(preferredUnit).trim()
                : (pu || base || '');
            var has = false;
            for (var j = 0; j < unitSelect.options.length; j++) {
                if (unitSelect.options[j].value === target) has = true;
            }
            if (!has && target) {
                var extra = document.createElement('option');
                extra.value = target;
                extra.textContent = target;
                unitSelect.appendChild(extra);
            }
            if (target) {
                unitSelect.value = target;
            } else if (unitSelect.options.length) {
                unitSelect.selectedIndex = 0;
            }
        } finally {
            unitSelect.__tmSuppressUnitChange = false;
        }
    },

    loadPurchaseSummary: async function() {
        var elAmt = document.getElementById('sup-stat-month-total');
        var elCnt = document.getElementById('sup-stat-pending-count');
        if (!elAmt || !elCnt) return;
        try {
            const response = await window.wrappedFetch('/api/v1/supp/purchases/summary', { method: 'GET' });
            if (!response.ok) {
                elAmt.textContent = '\u00a50.00';
                elCnt.textContent = '0 \u7b14';
                return;
            }
            const result = await response.json();
            if (!result.success || !result.data) {
                elAmt.textContent = '\u00a50.00';
                elCnt.textContent = '0 \u7b14';
                return;
            }
            var d = result.data;
            var amt = Number(d.monthTotalAmount != null ? d.monthTotalAmount : 0);
            elAmt.textContent = '\u00a5' + amt.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            var cnt = Number(d.pendingInboundCount != null ? d.pendingInboundCount : 0);
            elCnt.textContent = cnt + ' \u7b14';
        } catch (e) {
            elAmt.textContent = '\u00a50.00';
            elCnt.textContent = '0 \u7b14';
        }
    },

    loadAccounts: async function() {
        try {
            if (window.TM_TenantOps) {
                window.__tmOpsProfile = await window.TM_TenantOps.fetchOpsProfile();
            }
            const response = await window.wrappedFetch('/api/v1/im/accounts', { method: 'GET' });
            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    this.accounts = result.data;
                } else {
                    this.accounts = [];
                }
                this.fillPurchaseAccountSelect(
                    this.currentPurchase && (this.currentPurchase.accountId != null
                        ? this.currentPurchase.accountId
                        : this.currentPurchase.account_id)
                );
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            this.accounts = [];
        }
    },

    fillPurchaseAccountSelect: function(preferredAccountId) {
        var ids = ['purchase-account', 'purchase-pay-account'];
        var accounts = this.accounts || [];
        var profile = window.__tmOpsProfile || null;
        var virtualOnly = accounts.length === 0
            && window.TM_TenantOps
            && window.TM_TenantOps.isVirtualFinance(profile);
        if (virtualOnly) {
            ids.forEach(function(id) {
                var sel = document.getElementById(id);
                if (!sel) return;
                sel.innerHTML = window.TM_TenantOps.buildAccountOptionsHtml(accounts, profile, preferredAccountId);
            });
            return;
        }
        if (accounts.length > 0 && window.TM_TenantOps) {
            var html = window.TM_TenantOps.buildAccountOptionsHtml(accounts, profile, preferredAccountId);
            ids.forEach(function(id) {
                var sel = document.getElementById(id);
                if (sel) sel.innerHTML = html;
            });
            if (preferredAccountId != null && preferredAccountId !== '') {
                ids.forEach(function(id) {
                    var sel = document.getElementById(id);
                    if (sel) sel.value = String(preferredAccountId);
                });
            }
            return;
        }
        ids.forEach(function(id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '<option value="">--- 请选择付款账户 ---</option>';
            accounts.forEach(function(a) {
                var opt = document.createElement('option');
                opt.value = String(a.accountId);
                opt.textContent = a.accountName || ('账户#' + a.accountId);
                sel.appendChild(opt);
            });
        });
        var selMain = document.getElementById('purchase-account');
        if (!selMain) return;
        var pick = preferredAccountId;
        if (pick == null || pick === '') {
            const def = accounts.find(function(a) {
                return a.isDefaultPay === true || a.isDefaultPay === 't' || a.isDefaultPay === 1;
            });
            if (def) pick = def.accountId;
            else if (accounts.length) pick = accounts[0].accountId;
        }
        if (pick != null && pick !== '') {
            const s = String(pick);
            ids.forEach(function(id) {
                var sel = document.getElementById(id);
                if (!sel) return;
                if (sel.querySelector('option[value="' + s + '"]')) {
                    sel.value = s;
                }
            });
        }
    },

    pickPurchaseDateRaw: function(purchase) {
        if (!purchase) return null;
        var v = purchase.purchaseDate;
        if (v == null || v === '') v = purchase.purchase_date;
        return v;
    },

    /**
     * 进货单行状态胶囊，对齐 UI 工程 getPurchaseStatusBadgeClass（无描边、中文词典名）
     */
    getPurchaseStatusPill: function(statusCode) {
        var state = this.states.find(function(s) { return s.dictCode === statusCode; });
        var statusName = state ? state.dictName : (statusCode || '未知');
        var pill = 'bg-slate-50 text-slate-600';
        switch (statusCode) {
            case 'DRAFT':
                pill = 'bg-slate-100 text-slate-600';
                break;
            case 'PENDING_REVIEW':
            case 'SUBMITTED':
                pill = 'bg-amber-50 text-amber-700';
                break;
            case 'APPROVED':
                pill = 'bg-sky-50 text-sky-700';
                break;
            case 'PARTIAL_INBOUND':
                pill = 'bg-orange-50 text-orange-600';
                break;
            case 'FULL_INBOUND':
            case 'STOCKED':
                pill = 'bg-emerald-50 text-emerald-700';
                break;
            case 'REJECTED':
                pill = 'bg-red-50 text-red-600';
                break;
            case 'VOIDED':
            case 'CANCELLED':
                pill = 'bg-slate-200 text-slate-500';
                break;
            default:
                break;
        }
        var esc = this.escapeAttr(statusName);
        return '<span class="inline-flex max-w-full min-w-0 justify-center w-full align-middle">' +
            '<span class="truncate max-w-full whitespace-nowrap px-2 py-0.5 rounded-full font-bold text-[10px] ' + pill + '" title="' + esc + '">' + esc + '</span></span>';
    },

    formatPurchaseAmountCn: function(n) {
        var v = Number(n) || 0;
        return '\u00a5' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    /** 用于 title 属性，避免引号与尖括号破坏 HTML */
    escapeAttr: function(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    },

    formatDate: function(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) {
            return String(dateStr).replace(/-/g, '.').slice(0, 10);
        }
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '.' + m + '.' + day;
    },

    /** 将接口返回的日期时间转为 HTML5 date 控件所需的 yyyy-MM-dd */
    toDateInputValue: function(dateStr) {
        if (dateStr == null || dateStr === '') return '';
        if (Array.isArray(dateStr)) {
            var y = dateStr[0], mo = dateStr[1], day = dateStr[2];
            if (y == null) return '';
            return y + '-' + String(mo).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        }
        var s = String(dateStr).trim();
        var head = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (head) return head[1];
        var d = new Date(s);
        if (Number.isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    notify: function(message, type, opts) {
        type = type || 'info';
        opts = opts || {};
        if (type === 'success' && opts.useDialog && window.TmConfirm && typeof window.TmConfirm.openSuccess === 'function') {
            window.TmConfirm.openSuccess(message, { title: opts.title || '保存成功' });
            return;
        }
        if (type === 'success') {
            this.showToast(message);
            return;
        }
        if (window.TM_UI && typeof window.TM_UI.toast === 'function') {
            window.TM_UI.toast(message, type);
            return;
        }
        if (type === 'error') {
            var errToast = document.getElementById('tm-fade-toast');
            if (!errToast) {
                errToast = document.createElement('div');
                errToast.id = 'tm-fade-toast';
                document.body.appendChild(errToast);
            }
            errToast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-rose-500/95 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-xl pointer-events-none';
            errToast.textContent = message || '操作失败';
            errToast.style.opacity = '1';
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(function () { errToast.style.opacity = '0'; }, 2200);
            return;
        }
        this.showToast(message);
    },

    showToast: function(message) {
        var toast = document.getElementById('tm-fade-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tm-fade-toast';
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-500/95 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-xl pointer-events-none';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.45s ease';
            document.body.appendChild(toast);
        }

        toast.textContent = message || '操作成功';
        toast.style.opacity = '1';
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
        this.toastTimer = setTimeout(function() {
            toast.style.opacity = '0';
        }, 1400);
    },

    renderPagination: function(type, page, totalPages, total) {
        var disablePrevAttr = page <= 1 ? 'disabled' : '';
        var disableNextAttr = page >= totalPages ? 'disabled' : '';
        var prevAction = type === 'supplier'
            ? 'onclick="SupplierModule.setSupplierPage(' + (page - 1) + ')"'
            : 'onclick="SupplierModule.setPurchasePage(' + (page - 1) + ')"';
        var nextAction = type === 'supplier'
            ? 'onclick="SupplierModule.setSupplierPage(' + (page + 1) + ')"'
            : 'onclick="SupplierModule.setPurchasePage(' + (page + 1) + ')"';

        var btnCls = 'inline-flex items-center justify-center gap-1 min-h-[2rem] px-3 py-1.5 rounded-full border border-teal-200 bg-white text-[11px] font-bold text-teal-700 shadow-sm hover:bg-teal-50 disabled:opacity-40 disabled:pointer-events-none disabled:text-slate-400 disabled:border-slate-200 transition-colors';
        return `
            <div class="border-t border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-[10px] sm:text-[11px] text-slate-500 leading-snug text-center sm:text-left">共 ${total} 条，第 ${page}/${totalPages} 页，每页 ${this.PAGE_SIZE} 条</p>
                    <div class="flex gap-2 justify-center sm:justify-end">
                        <button type="button" ${prevAction} ${disablePrevAttr} class="${btnCls}"><i class="ph ph-caret-left"></i>上一页</button>
                        <button type="button" ${nextAction} ${disableNextAttr} class="${btnCls}">下一页<i class="ph ph-caret-right"></i></button>
                    </div>
                </div>
            </div>
        `;
    },

    setSupplierPage: async function(page) {
        this.supplierCurrentPage = page;
        await this.loadSuppliers(page);
        this.renderSuppliers();
    },

    setPurchasePage: async function(page) {
        this.purchaseCurrentPage = page;
        await this.loadPurchases(page);
        this.renderPurchases();
    },

    renderSuppliers: function() {
        const container = document.getElementById('suppliers-list');
        if (!container) return;

        if (this.suppliers.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm text-center py-16">
                    <i class="ph ph-truck text-4xl text-slate-300 mb-4"></i>
                    <p class="text-slate-400">暂无供应商</p>
                </div>
            `;
            return;
        }

        var rows = this.suppliers || [];
        var total = this.supplierTotal || rows.length;
        var totalPages = this.supplierTotalPages || 1;
        var page = this.supplierCurrentPage || 1;

        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto no-scrollbar">
                    <table class="supplier-mgmt-edit-table w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 md:uppercase md:tracking-widest">
                            <tr>
                                <th class="px-3 py-3 md:px-6 md:py-4 tm-sup-name whitespace-nowrap overflow-hidden text-ellipsis">供应商名称</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 tm-sup-contact whitespace-nowrap">联系人</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 tm-sup-phone whitespace-nowrap overflow-hidden text-ellipsis">电话</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 text-right tm-sup-action whitespace-nowrap">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 text-slate-700">
                            ${rows.map((supplier) => {
                                var name = supplier.name || supplier.supplierName || '未命名';
                                var contact = supplier.contact || '-';
                                var phone = supplier.phone || '-';
                                var nameEsc = this.escapeAttr(name);
                                var contactEsc = this.escapeAttr(contact);
                                var phoneEsc = this.escapeAttr(phone);
                                return `
                                <tr class="hover:bg-slate-50/80 transition-all">
                                    <td class="px-3 py-3 md:px-6 md:py-4 tm-sup-name-cell align-middle">
                                        <span class="block font-bold text-slate-800 truncate max-w-full" title="${nameEsc}">${nameEsc}</span>
                                    </td>
                                    <td class="px-3 py-3 md:px-6 md:py-4 tm-sup-contact-cell align-middle">
                                        <span class="block truncate max-w-full" title="${contactEsc}">${contactEsc}</span>
                                    </td>
                                    <td class="px-3 py-3 md:px-6 md:py-4 tm-sup-phone-cell align-middle">
                                        <span class="block font-mono truncate max-w-full" title="${phoneEsc}">${phoneEsc}</span>
                                    </td>
                                    <td class="px-3 py-3 md:px-6 md:py-4 text-right align-middle tm-sup-action-cell">
                                        <div class="flex justify-end gap-2">
                                            <button type="button" title="编辑" onclick="editSupplier(${supplier.supplierId})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors shrink-0"><i class="ph ph-pencil text-slate-400"></i></button>
                                            <button type="button" title="删除" onclick="deleteSupplier(${supplier.supplierId})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors shrink-0"><i class="ph ph-trash text-slate-400 hover:text-red-500"></i></button>
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                ${this.renderPagination('supplier', page, totalPages, total)}
            </div>
        `;
    },

    renderPurchases: function() {
        const container = document.getElementById('orders-list');
        if (!container) return;

        if (this.purchases.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm text-center py-16">
                    <i class="ph ph-file-text text-4xl text-slate-300 mb-4"></i>
                    <p class="text-slate-400">暂无进货单</p>
                </div>
            `;
            return;
        }

        var rows = this.purchases || [];
        var total = this.purchaseTotal || rows.length;
        var totalPages = this.purchaseTotalPages || 1;
        var page = this.purchaseCurrentPage || 1;

        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto no-scrollbar">
                    <table class="supplier-mgmt-po-table w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 md:uppercase md:tracking-widest">
                            <tr>
                                <th class="px-3 py-3 md:px-6 md:py-4 tm-po-date whitespace-nowrap">进货日期</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 tm-po-supplier whitespace-nowrap overflow-hidden text-ellipsis">供应商名称</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 text-right col-hide-mobile whitespace-nowrap">进货总额</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 text-center tm-po-status whitespace-nowrap">状态</th>
                                <th class="px-3 py-3 md:px-6 md:py-4 text-right tm-po-action whitespace-nowrap">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 text-slate-700">
                            ${rows.map((purchase) => {
                                var supplier = this.suppliers.find((s) => String(s.supplierId) === String(purchase.supplierId));
                                if (!supplier) {
                                    supplier = this.allSuppliers.find((s) => String(s.supplierId) === String(purchase.supplierId));
                                }
                                var supplierName = purchase.supplierName || (supplier ? (supplier.name || supplier.supplierName) : '未知供应商');
                                var dateStr = this.formatDate(purchase.purchaseDate);
                                var dateEsc = this.escapeAttr(dateStr);
                                var supEsc = this.escapeAttr(supplierName || '-');
                                return `
                                    <tr class="hover:bg-slate-50/80 transition-all cursor-pointer group" onclick="editPurchase(${purchase.purchaseId})">
                                        <td class="px-3 py-3 md:px-6 md:py-4 tm-po-date font-mono text-slate-400 whitespace-nowrap align-middle">${dateEsc}</td>
                                        <td class="px-3 py-3 md:px-6 md:py-4 tm-po-supplier align-middle">
                                            <span class="block font-bold text-brand-600 truncate max-w-full" title="${supEsc}">${supEsc}</span>
                                        </td>
                                        <td class="px-3 py-3 md:px-6 md:py-4 text-right font-mono font-bold col-hide-mobile align-middle">${this.formatPurchaseAmountCn(purchase.totalAmount)}</td>
                                        <td class="px-3 py-3 md:px-6 md:py-4 text-center tm-po-status align-middle whitespace-nowrap">${this.getPurchaseStatusPill(purchase.purchaseStatus)}</td>
                                        <td class="px-3 py-3 md:px-6 md:py-4 text-right tm-po-action align-middle">
                                            <i class="ph ph-caret-right text-slate-300 group-hover:text-brand-500 transition-colors"></i>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                ${this.renderPagination('purchase', page, totalPages, total)}
            </div>
        `;
    },

    openSupplierModal: function() {
        this.currentSupplier = null;
        document.getElementById('supplier-modal-title').textContent = '新增供应商';
        var sub = document.getElementById('supplier-modal-subtitle');
        if (sub) sub.textContent = '保存后可在进货单中选择';
        document.getElementById('supplier-name').value = '';
        document.getElementById('supplier-contact').value = '';
        document.getElementById('supplier-phone').value = '';
        document.getElementById('supplier-address').value = '';
        var modal = document.getElementById('supplier-modal');
        if (modal) {
            if (typeof window.TM_openUnifiedModal === 'function') {
                window.TM_openUnifiedModal(modal);
            } else {
                TM_openEmbedModalFallback(modal);
            }
        }
    },

    closeSupplierModal: function() {
        var modal = document.getElementById('supplier-modal');
        if (modal && typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else if (modal) {
            TM_closeEmbedModalFallback(modal);
        }
        this.currentSupplier = null;
    },

    editSupplier: async function(supplierId) {
        const supplier = this.suppliers.find(s => s.supplierId === supplierId);
        if (!supplier) return;

        this.currentSupplier = supplier;
        document.getElementById('supplier-modal-title').textContent = '编辑供应商';
        var sub = document.getElementById('supplier-modal-subtitle');
        if (sub) {
            var hint = supplier.contact || supplier.phone || '';
            sub.textContent = hint ? hint : ('ID: ' + (supplier.supplierId || ''));
        }
        document.getElementById('supplier-name').value = supplier.name || '';
        document.getElementById('supplier-contact').value = supplier.contact || '';
        document.getElementById('supplier-phone').value = supplier.phone || '';
        document.getElementById('supplier-address').value = supplier.address || '';
        var modal = document.getElementById('supplier-modal');
        if (modal) {
            if (typeof window.TM_openUnifiedModal === 'function') {
                window.TM_openUnifiedModal(modal);
            } else {
                TM_openEmbedModalFallback(modal);
            }
        }
    },

    saveSupplier: async function() {
        const name = document.getElementById('supplier-name').value.trim();
        const contact = document.getElementById('supplier-contact').value.trim();
        const phone = document.getElementById('supplier-phone').value.trim();
        const address = document.getElementById('supplier-address').value.trim();
        var rating = 0;

        if (!name) {
            this.notify('请输入供应商名称', 'error');
            return;
        }

        try {
            const supplierData = {
                name,
                contact,
                phone,
                address,
                rating,
                status: 1
            };

            if (this.currentSupplier) {
                supplierData.supplierId = this.currentSupplier.supplierId;
            }

            const response = await window.wrappedFetch('/api/v1/supp/suppliers/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(supplierData)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.closeSupplierModal();
                    await this.loadAllSuppliers();
                    await this.loadSuppliers(this.supplierCurrentPage);
                    this.renderSuppliers();
                    this.showToast('保存成功');
                } else {
                    this.notify('保存失败: ' + (result.message || '未知错误'), 'error');
                }
            } else {
                this.notify('保存失败', 'error');
            }
        } catch (error) {
            console.error('Error saving supplier:', error);
            this.notify('保存失败: ' + error.message, 'error');
        }
    },

    deleteSupplier: function(supplierId) {
        var self = this;
        var supplier = (self.suppliers || []).find(function (s) {
            return String(s.supplierId || s.id) === String(supplierId);
        });
        var label = supplier ? (supplier.supplierName || supplier.name || '') : '';
        var msg = label
            ? ('确定要删除供应商「' + label + '」吗？此操作无法撤销。')
            : '确定要删除这个供应商吗？此操作无法撤销。';
        var runDelete = async function () {
            try {
                const response = await window.wrappedFetch('/api/v1/supp/suppliers/' + supplierId, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        await self.loadAllSuppliers();
                        await self.loadSuppliers(self.supplierCurrentPage);
                        if (self.suppliers.length === 0 && self.supplierCurrentPage > 1) {
                            await self.loadSuppliers(self.supplierCurrentPage - 1);
                        }
                        self.renderSuppliers();
                        self.showToast('删除成功');
                    } else {
                        self.notify('删除失败: ' + (result.message || '未知错误'), 'error');
                    }
                } else {
                    self.notify('删除失败', 'error');
                }
            } catch (error) {
                console.error('Error deleting supplier:', error);
                self.notify('删除失败: ' + error.message, 'error');
            }
        };
        if (window.TmConfirm && typeof window.TmConfirm.open === 'function') {
            window.TmConfirm.open({
                title: '确认删除',
                message: msg,
                confirmLabel: '确认删除',
                danger: true,
                onConfirm: runDelete
            });
        } else if (confirm(msg)) {
            runDelete();
        }
    },

    initDateInput: function() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('purchase-date');
        if (dateInput) {dateInput.value = today;}
    },

    isMobilePurchaseView: function() {
        return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches;
    },

    showPurchaseFormError: function(msg) {
        var el = document.getElementById('purchase-form-errors');
        if (!el) {
            this.notify(msg, 'error');
            return;
        }
        el.textContent = msg;
        el.classList.remove('hidden');
        try {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) { /* ignore */ }
    },

    clearPurchaseFormError: function() {
        var el = document.getElementById('purchase-form-errors');
        if (el) {
            el.classList.add('hidden');
            el.textContent = '';
        }
    },

    buildPurchaseTableRowHtml: function(opts) {
        opts = opts || {};
        var qty = opts.qty != null ? opts.qty : 1;
        var price = opts.price != null ? opts.price : 0;
        var batch = opts.batch != null ? String(opts.batch) : '';
        var batchAttr = batch.replace(/"/g, '&quot;');
        return (
            '<tr class="purchase-item-row">' +
            '<td class="tm-po-td tm-po-td--check purchase-inbound-col hidden text-center">' +
            this.buildInboundCheckboxHtml(opts) + '</td>' +
            '<td class="tm-po-td tm-po-td--product">' +
            '<select class="form-input tm-po-product-select product-select" onchange="SupplierModule.onProductSelect(this)">' +
            '<option value="">--- 选择产品 ---</option></select></td>' +
            '<td class="tm-po-td tm-po-td--qty">' +
            '<input type="number" class="form-input tm-po-cell-input text-center qty-input" value="' + qty + '" min="1" oninput="SupplierModule.calculatePurchaseTotal()"></td>' +
            '<td class="tm-po-td tm-po-td--price">' +
            '<input type="number" class="form-input tm-po-cell-input text-center price-input" value="' + price + '" step="0.01" min="0" oninput="SupplierModule.onPurchasePriceInput(this)"></td>' +
            '<td class="tm-po-td tm-po-td--unit">' +
            '<select class="form-input tm-po-cell-input unit-select"><option value="">--- 单位 ---</option></select></td>' +
            '<td class="tm-po-td tm-po-td--batch">' +
            '<input type="text" class="form-input tm-po-cell-input batch-input" placeholder="批次号" value="' + batchAttr + '"></td>' +
            '<td class="tm-po-td tm-po-td--sub text-right font-mono font-bold text-slate-400 row-total">¥0.00</td>' +
            '<td class="tm-po-td tm-po-td--action text-center">' +
            '<button type="button" onclick="SupplierModule.removePurchaseItem(this)" class="tm-po-row-delete" aria-label="删除行">' +
            '<i class="ph ph-trash"></i></button></td></tr>'
        );
    },

    clearPurchaseItems: function() {
        var tbody = document.getElementById('purchase-items-tbody');
        if (tbody) tbody.innerHTML = '';
    },

    appendPurchaseItem: function(opts) {
        opts = opts || {};
        var tbody = document.getElementById('purchase-items-tbody');
        if (tbody) tbody.insertAdjacentHTML('beforeend', this.buildPurchaseTableRowHtml(opts));
        this.refreshPurchaseItemsLayout();
        this.syncInboundUi();
    },

    resolveItemUnitPrice: function(item) {
        if (!item) return null;
        if (item.unitPrice != null && item.unitPrice !== '') return Number(item.unitPrice);
        if (item.unit_price != null && item.unit_price !== '') return Number(item.unit_price);
        return null;
    },

    lockPurchasePriceInput: function(priceInp, price) {
        if (!priceInp) return;
        var n = Number(price);
        if (!isNaN(n)) {
            priceInp.value = n;
            priceInp.dataset.docPrice = String(n);
        }
        priceInp.dataset.lockedPrice = '1';
        priceInp.dataset.autofillOk = '0';
        priceInp.__tmPriceToken = (priceInp.__tmPriceToken || 0) + 1;
    },

    onPurchasePriceInput: function(el) {
        if (el) {
            el.dataset.userEdited = '1';
            el.dataset.lockedPrice = '1';
            el.dataset.autofillOk = '0';
            el.dataset.docPrice = String(el.value != null ? el.value : '');
            el.__tmPriceToken = (el.__tmPriceToken || 0) + 1;
        }
        this.calculatePurchaseTotal();
    },

    /** 读取行单价：优先单据锁定价（防止异步历史价把 input 盖掉后误保存） */
    readRowUnitPrice: function(row) {
        if (!row) return 0;
        var priceInput = row.querySelector('.price-input');
        if (!priceInput) return 0;
        if (priceInput.dataset.docPrice != null && priceInput.dataset.docPrice !== ''
            && (priceInput.dataset.lockedPrice === '1' || priceInput.dataset.userEdited === '1')) {
            var doc = parseFloat(priceInput.dataset.docPrice);
            if (!isNaN(doc) && doc >= 0) return doc;
        }
        return parseFloat(priceInput.value) || 0;
    },

    applyPurchaseItemValues: async function(rows, items) {
        if (!rows || !items || !items.length) return;
        var self = this;
        this._suppressUnitPriceAutoFill = true;
        try {
            for (var idx = 0; idx < items.length; idx++) {
                var item = items[idx];
                if (!rows[idx]) continue;
                var savedPrice = self.resolveItemUnitPrice(item);
                var sel = rows[idx].querySelector('.product-select');
                if (sel && (item.productId != null || item.product_id != null)) {
                    sel.value = String(item.productId != null ? item.productId : item.product_id);
                    var savedUnit = item.unitName || item.unit_name || '';
                    await self.onProductSelect(sel, savedUnit || undefined, {
                        preservePrice: true,
                        unitPrice: savedPrice
                    });
                }
                var priceInp = rows[idx].querySelector('.price-input');
                if (priceInp && savedPrice != null && !isNaN(savedPrice)) {
                    self.lockPurchasePriceInput(priceInp, savedPrice);
                }
                var cb = rows[idx].querySelector('.purchase-inbound-check');
                if (cb) {
                    var id = self.resolvePurchaseItemId(item);
                    if (id != null) {
                        cb.setAttribute('data-item-id', String(id));
                        cb.dataset.itemId = String(id);
                    }
                    var proc = item.isProcessed === true || item.is_processed === true;
                    cb.disabled = proc;
                    cb.checked = proc;
                }
            }
        } finally {
            this._suppressUnitPriceAutoFill = false;
        }
        this.syncInboundUi();
        // 再断言一次，挡住异步历史价晚到覆盖
        var snap = items.map(function (it) { return self.resolveItemUnitPrice(it); });
        setTimeout(function () {
            for (var i = 0; i < snap.length; i++) {
                if (!rows[i] || snap[i] == null || isNaN(snap[i])) continue;
                var inp = rows[i].querySelector('.price-input');
                if (inp) self.lockPurchasePriceInput(inp, snap[i]);
            }
            self.calculatePurchaseTotal();
        }, 0);
        setTimeout(function () {
            for (var i = 0; i < snap.length; i++) {
                if (!rows[i] || snap[i] == null || isNaN(snap[i])) continue;
                var inp = rows[i].querySelector('.price-input');
                if (inp) self.lockPurchasePriceInput(inp, snap[i]);
            }
            self.calculatePurchaseTotal();
        }, 200);
    },

    /**
     * 列表总额正确但明细单价仍旧时，按总额比例修正行单价（临时修复脏数据展示）。
     */
    healPurchaseItemsAgainstHeaderTotal: function(items, headerTotal) {
        if (!items || !items.length || headerTotal == null || isNaN(Number(headerTotal))) return items;
        var self = this;
        var sum = 0;
        items.forEach(function (it) {
            var q = Number(it.quantity != null ? it.quantity : 0) || 0;
            var p = self.resolveItemUnitPrice(it);
            if (p == null || isNaN(p)) p = 0;
            sum += q * p;
        });
        sum = Math.round(sum * 100) / 100;
        var header = Math.round(Number(headerTotal) * 100) / 100;
        if (sum <= 0 || Math.abs(sum - header) <= 0.05) return items;
        var scale = header / sum;
        return items.map(function (it) {
            var copy = Object.assign({}, it);
            var p = self.resolveItemUnitPrice(it);
            if (p != null && !isNaN(p)) {
                var healed = Math.round(p * scale * 100) / 100;
                copy.unitPrice = healed;
                copy.unit_price = healed;
            }
            return copy;
        });
    },

    refreshPurchaseItemsLayout: function() {
        var rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
        var n = rows.length;
        var maxRows = 5;
        var scroll = document.querySelector('#purchase-modal .tm-purchase-items-scroll');
        var core = document.querySelector('#purchase-modal .tm-purchase-items-core');
        var rowH = '2.75rem';
        if (scroll) {
            scroll.classList.toggle('tm-purchase-items--scroll', n > maxRows);
            scroll.style.flex = n > maxRows ? '1 1 auto' : '0 0 auto';
            scroll.style.maxHeight = n > maxRows ? ('calc(' + rowH + ' * ' + maxRows + ' + 2.25rem)') : '';
            scroll.style.overflowY = n > maxRows ? 'auto' : 'visible';
            scroll.style.overflowX = 'auto';
        }
        if (core) {
            core.classList.toggle('tm-purchase-items-core--compact', n <= maxRows);
        }
    },

    openPurchaseModal: async function() {
        this.currentPurchase = null;
        document.getElementById('purchase-modal-title').textContent = '新增进货单';

        await Promise.all([
            this.loadProducts(),
            this.loadWarehouses(),
            this.loadAccounts()
        ]);

        this.populateSuppliersSelect();
        this.populateStatusesSelect();
        this.populateProductsSelects();

        this.clearPurchaseFormError();
        this.resetPurchaseForm();
        this.bindPurchaseFinEvents();
        this.syncFinStatusUI();
        var modal = document.getElementById('purchase-modal');
        if (modal) {
            if (typeof window.TM_openUnifiedModal === 'function') {
                window.TM_openUnifiedModal(modal);
            } else {
                TM_openEmbedModalFallback(modal);
            }
        }
        requestAnimationFrame(function () {
            var body = document.querySelector('#purchase-modal .tm-document-modal-scroll');
            if (body) body.scrollTop = 0;
        });
    },

    closePurchaseModal: function() {
        var modal = document.getElementById('purchase-modal');
        if (modal && typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else if (modal) {
            TM_closeEmbedModalFallback(modal);
        }
        this.currentPurchase = null;
    },

    resetPurchaseForm: function() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('purchase-supplier').value = '';
        document.getElementById('purchase-status').value = '';
        document.getElementById('purchase-date').value = today;
        this.clearPurchaseItems();
        this.appendPurchaseItem({});
        this.populateProductsSelects();
        this.calculatePurchaseTotal();
        this.refreshPurchaseItemsLayout();
        this.fillPurchaseAccountSelect(null);
        var finSel = document.getElementById('purchase-fin-status');
        if (finSel) finSel.value = 'UNPAID';
        var whEl = document.getElementById('purchase-warehouse');
        if (whEl) whEl.value = '';
        var amountEl = document.getElementById('purchase-pay-amount');
        if (amountEl) { amountEl.value = ''; amountEl.disabled = true; }
        this.populateWarehouseSelect();
        this.updatePurchaseBadges(null);
        this.setPurchaseAuxOpen(false);
        this.syncFinStatusUI();
        this.syncInboundUi();
    },

    populateSuppliersSelect: function() {
        const select = document.getElementById('purchase-supplier');
        if (!select) return;
        select.innerHTML = '<option value="">无供应商（可不选）</option>';
        const source = (this.allSuppliers && this.allSuppliers.length > 0) ? this.allSuppliers : this.suppliers;
        if (!source || source.length === 0) {
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.disabled = true;
            emptyOpt.textContent = '暂无供应商，请先新增';
            select.appendChild(emptyOpt);
            return;
        }
        source.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.supplierId;
            option.textContent = supplier.name || '未命名';
            select.appendChild(option);
        });
    },

    populateStatusesSelect: function() {
        const select = document.getElementById('purchase-status');
        select.innerHTML = '<option value="">--- 请选择状态 ---</option>';
        this.states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.dictCode;
            option.textContent = state.dictName;
            select.appendChild(option);
        });
    },

    populateProductsSelects: function() {
        const selects = document.querySelectorAll('#purchase-modal .product-select');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">--- 选择产品 ---</option>';
            this.products.forEach(product => {
                const option = document.createElement('option');
                var pid = product.productId != null ? product.productId : product.id;
                option.value = pid != null ? pid : '';
                option.textContent = product.name || product.productName || '未命名产品';
                option.dataset.unit = product.purchaseUnit || product.baseUnit || '';
                option.dataset.price = product.price || 0;
                select.appendChild(option);
            });
            if (currentValue) {select.value = currentValue;}
        });
    },

    onProductSelect: async function(selectEl, preferredUnit, options) {
        options = options || {};
        const row = selectEl.closest('.purchase-item-row');
        if (!row) return;
        const productId = selectEl.value;
        const unitSelect = row.querySelector('.unit-select');
        const priceInput = row.querySelector('.price-input');
        
        if (!productId) {
            unitSelect.innerHTML = '<option value="">--- 单位 ---</option>';
            unitSelect.className = 'form-input text-center unit-select';
            if (!options.preservePrice) {
                priceInput.value = 0;
                delete priceInput.dataset.lockedPrice;
                delete priceInput.dataset.userEdited;
                delete priceInput.dataset.docPrice;
                delete priceInput.dataset.autofillOk;
            }
            this.calculatePurchaseTotal();
            return;
        }
        
        const product = this.products.find(function(p) {
            var pid = p.productId != null ? p.productId : p.id;
            return String(pid) === String(productId);
        });
        if (product) {
            unitSelect.className = 'form-input text-center unit-select';
            this.fillPurchaseUnitSelect(unitSelect, product, preferredUnit);
            if (!options.preservePrice) {
                delete priceInput.dataset.lockedPrice;
                delete priceInput.dataset.userEdited;
                delete priceInput.dataset.docPrice;
                // 仅用户主动选品时允许自动填历史价
                priceInput.dataset.autofillOk = '1';
                // 选品即填价：先本地估算，再异步用历史进货价覆盖
                var localGuess = this.guessLocalPurchaseUnitPrice(product, unitSelect && unitSelect.value);
                if (localGuess > 0) priceInput.value = localGuess;
                await this.resolvePurchaseUnitPrice(Number(productId), product, unitSelect, priceInput);
                // 自动填价完成后关掉，后续单位变更仍可按意图改价（已有单据编辑除外由 resolve 判断）
                if (!(this.currentPurchase && this.currentPurchase.purchaseId)) {
                    priceInput.dataset.autofillOk = '1';
                } else {
                    priceInput.dataset.autofillOk = '0';
                    if (priceInput.value !== '' && !isNaN(Number(priceInput.value))) {
                        this.lockPurchasePriceInput(priceInput, priceInput.value);
                    }
                }
            } else if (options.unitPrice != null && !isNaN(Number(options.unitPrice))) {
                this.lockPurchasePriceInput(priceInput, options.unitPrice);
            }
        }
        this.calculatePurchaseTotal();
    },

    /** 本地兜底：成本价（若有）或 售价×进货/销售单位换算 */
    guessLocalPurchaseUnitPrice: function(product, unitName) {
        if (!product) return 0;
        var unit = (unitName || product.purchaseUnit || product.baseUnit || '').trim();
        var cost = Number(product.purchasePrice != null ? product.purchasePrice : product.costPrice);
        if (isFinite(cost) && cost > 0) {
            // 成本价按基本/进货单位语义：默认视为进货单位价，单位一致则直接用
            var pu = (product.purchaseUnit || product.baseUnit || '').trim();
            if (!unit || !pu || unit.toLowerCase() === pu.toLowerCase()) {
                return Math.round(cost * 100) / 100;
            }
            var converted = this.computeSalePriceToPurchaseUnit(
                Object.assign({}, product, { price: cost, salesUnit: pu }),
                unit
            );
            if (converted > 0) return converted;
            return Math.round(cost * 100) / 100;
        }
        return this.computeSalePriceToPurchaseUnit(product, unit);
    },

    resolvePurchaseUnitPrice: async function(productId, product, unitSelect, priceInput) {
        if (!priceInput) return;
        if (this._suppressUnitPriceAutoFill) return;
        if (priceInput.dataset.lockedPrice === '1' || priceInput.dataset.userEdited === '1') return;
        // 编辑已有单据：未明确允许自动填价时，绝不拉历史价（否则打开详情会把 180 盖成 38）
        if (this.currentPurchase && this.currentPurchase.purchaseId && priceInput.dataset.autofillOk !== '1') {
            return;
        }
        if (priceInput.dataset.docPrice != null && priceInput.dataset.docPrice !== '') {
            var keep = Number(priceInput.dataset.docPrice);
            if (!isNaN(keep)) {
                priceInput.value = keep;
                return;
            }
        }
        var token = (priceInput.__tmPriceToken = (priceInput.__tmPriceToken || 0) + 1);
        var unitName = unitSelect && unitSelect.value ? String(unitSelect.value).trim() : '';
        if (!unitName && product) {
            unitName = (product.purchaseUnit || product.baseUnit || '').trim();
        }
        var skuId = null;
        var row = priceInput.closest('.purchase-item-row');
        if (row && row.dataset.skuId) {
            skuId = Number(row.dataset.skuId);
        }
        if (!(skuId > 0) && product) {
            skuId = product.skuId != null ? Number(product.skuId) : (product.defaultSkuId != null ? Number(product.defaultSkuId) : null);
        }
        var applied = false;
        try {
            var line = { productId: Number(productId), unitName: unitName };
            if (skuId != null && Number(skuId) > 0) {
                line.skuId = Number(skuId);
            }
            var response = await window.wrappedFetch('/api/v1/supp/purchases/last-unit-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines: [line], productIds: [productId] })
            });
            var result = await window.handleApiResponse(response);
            if (token !== priceInput.__tmPriceToken
                || priceInput.dataset.lockedPrice === '1'
                || priceInput.dataset.userEdited === '1'
                || this._suppressUnitPriceAutoFill
                || (this.currentPurchase && this.currentPurchase.purchaseId && priceInput.dataset.autofillOk !== '1')) {
                return;
            }
            var data = result && result.data ? result.data : (result || {});
            var key = String(productId)
                + (line.skuId != null ? ':' + line.skuId : '')
                + (unitName ? ':' + unitName : '');
            var lastPrice = data[key] != null ? data[key]
                : (data[String(productId)] != null ? data[String(productId)] : data[productId]);
            if (lastPrice != null && Number(lastPrice) > 0) {
                priceInput.value = Number(lastPrice);
                applied = true;
            }
        } catch (err) {
            console.warn('[SupplierModule] 历史进货价查询失败', err);
        }
        if (token !== priceInput.__tmPriceToken
            || priceInput.dataset.lockedPrice === '1'
            || priceInput.dataset.userEdited === '1'
            || this._suppressUnitPriceAutoFill
            || (this.currentPurchase && this.currentPurchase.purchaseId && priceInput.dataset.autofillOk !== '1')) {
            return;
        }
        if (applied) {
            this.calculatePurchaseTotal();
            return;
        }
        var fallback = this.guessLocalPurchaseUnitPrice(product, unitName);
        if (fallback > 0) {
            priceInput.value = fallback;
            this.calculatePurchaseTotal();
        }
    },

    /** 售价(销售单位) → 当前进货单位单价 */
    computeSalePriceToPurchaseUnit: function(product, targetUnit) {
        if (!product) return 0;
        var salePrice = Number(product.price != null ? product.price : (product.salePrice || 0)) || 0;
        if (salePrice <= 0) return 0;
        var baseUnit = (product.baseUnit || '').trim();
        var salesUnit = (product.salesUnit || '').trim() || baseUnit;
        var unit = (targetUnit || product.purchaseUnit || baseUnit || '').trim();
        var targetRatio = this._unitToBaseRatio(product, unit, baseUnit);
        var salesRatio = this._unitToBaseRatio(product, salesUnit, baseUnit);
        if (targetRatio > 0 && salesRatio > 0) {
            return Math.round(salePrice * targetRatio / salesRatio * 100) / 100;
        }
        return Math.round(salePrice * 100) / 100;
    },

    _unitToBaseRatio: function(product, unit, baseUnit) {
        var u = (unit || '').trim();
        var b = (baseUnit || '').trim();
        if (!u) return 1;
        if (b && u.toLowerCase() === b.toLowerCase()) return 1;
        var convs = (product && product.unitConversions) || [];
        for (var i = 0; i < convs.length; i++) {
            var c = convs[i];
            var un = (c.unitName || c.unit_name || '').trim();
            var ratio = Number(c.ratio != null ? c.ratio : c.perBase);
            if (un && u === un && ratio > 0) return ratio;
            // 兼容单位名带括号展示
            if (un && u.indexOf(un) === 0 && ratio > 0) return ratio;
        }
        return 1;
    },

    addPurchaseItem: function() {
        this.appendPurchaseItem({});
        this.populateProductsSelects();
        this.calculatePurchaseTotal();
    },

    removePurchaseItem: function(btn) {
        const rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
        if (rows.length <= 1) { this.notify('至少需要一项商品', 'error'); return; }
        var row = btn.closest('.purchase-item-row');
        if (row) row.remove();
        this.calculatePurchaseTotal();
        this.refreshPurchaseItemsLayout();
    },

    calculatePurchaseTotal: function() {
        const rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
        let total = 0;
        
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
            const price = this.readRowUnitPrice(row);
            const rowTotal = qty * price;
            total += rowTotal;
            
            row.querySelector('.row-total').textContent = '¥' + rowTotal.toFixed(2);
        });
        
        var fmt = typeof window.TM_formatCNY === 'function' ? window.TM_formatCNY(total) : ('¥' + total.toFixed(2));
        var totalEl = document.getElementById('po-form-total-display') || document.getElementById('purchase-grand-total');
        if (totalEl) totalEl.textContent = fmt;
        this.updateRemainingHint();
        this.refreshPurchaseItemsLayout();
        this.syncFinStatusUI();
    },

    editPurchase: async function(purchaseId) {
        var purchase = await this.fetchPurchaseDetail(purchaseId);
        if (!purchase) {
            purchase = this.purchases.find(function(p) { return String(p.purchaseId) === String(purchaseId); });
        }
        if (!purchase) return;

        this.currentPurchase = purchase;
        document.getElementById('purchase-modal-title').textContent = '编辑进货单';
        this.clearPurchaseFormError();

        await Promise.all([
            this.loadProducts(),
            this.loadWarehouses(),
            this.loadAccounts()
        ]);

        this.populateSuppliersSelect();
        this.populateStatusesSelect();

        document.getElementById('purchase-supplier').value = purchase.supplierId || '';
        document.getElementById('purchase-status').value = purchase.purchaseStatus || '';
        document.getElementById('purchase-date').value = this.toDateInputValue(this.pickPurchaseDateRaw(purchase));
        this.fillPurchaseAccountSelect(purchase.accountId != null ? purchase.accountId : purchase.account_id);
        this.populateWarehouseSelect();
        var whEl = document.getElementById('purchase-warehouse');
        var whId = purchase.warehouseId != null ? purchase.warehouseId : purchase.warehouse_id;
        if (whEl && whId) whEl.value = String(whId);
        var finSel = document.getElementById('purchase-fin-status');
        if (finSel) finSel.value = purchase.finStatus || 'UNPAID';
        this.bindPurchaseFinEvents();
        this.setPurchaseAuxOpen(false);
        this.syncFinStatusUI(purchase, { applyPurchaseFin: true });

        this.clearPurchaseItems();

        var purchaseItems = purchase.items || [];
        // 列表总额已更新但明细仍旧价时，按总额比例修复展示（并随本次保存写回正确单价）
        purchaseItems = this.healPurchaseItemsAgainstHeaderTotal(
            purchaseItems,
            purchase.totalAmount != null ? purchase.totalAmount : purchase.total_amount
        );
        if (purchaseItems.length > 0) {
            var self = this;
            purchaseItems.forEach(function (item) {
                var savedPrice = self.resolveItemUnitPrice(item);
                self.appendPurchaseItem({
                    qty: item.quantity || 1,
                    price: savedPrice != null && !isNaN(savedPrice) ? savedPrice : 0,
                    batch: item.batchNo || item.batch_no || '',
                    itemId: self.resolvePurchaseItemId(item),
                    processed: item.isProcessed === true || item.is_processed === true
                });
            });
        } else {
            this.appendPurchaseItem({});
        }

        this.populateProductsSelects();
        if (purchaseItems.length > 0) {
            var rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
            await this.applyPurchaseItemValues(rows, purchaseItems);
        }
        this.calculatePurchaseTotal();
        this.refreshPurchaseItemsLayout();
        this.syncInboundUi();
        var editModal = document.getElementById('purchase-modal');
        if (editModal) {
            if (typeof window.TM_openUnifiedModal === 'function') {
                window.TM_openUnifiedModal(editModal);
            } else {
                TM_openEmbedModalFallback(editModal);
            }
        }
        requestAnimationFrame(function () {
            var body = document.querySelector('#purchase-modal .tm-document-modal-scroll');
            if (body) body.scrollTop = 0;
        });
    },

    buildPurchaseSavePayload: function() {
        this.clearPurchaseFormError();
        const supplierRaw = document.getElementById('purchase-supplier').value;
        const status = document.getElementById('purchase-status').value;
        const purchaseDate = document.getElementById('purchase-date').value;
        const whEl = document.getElementById('purchase-warehouse');
        const warehouseId = whEl && whEl.value ? parseInt(whEl.value, 10) : null;

        if (!status) { this.showPurchaseFormError('请选择进货状态'); return null; }
        if (!purchaseDate) { this.showPurchaseFormError('请选择进货日期'); return null; }

        var payAccEl = document.getElementById('purchase-pay-account');
        var accountEl = document.getElementById('purchase-account');
        var accountRaw = (payAccEl && payAccEl.value) ? payAccEl.value : (accountEl ? accountEl.value : '');
        let accountId = null;
        if (accountRaw) {
            const n = parseInt(accountRaw, 10);
            if (!Number.isNaN(n)) accountId = n;
        }

        const rows = document.querySelectorAll('#purchase-modal .purchase-item-row');
        const items = [];
        let totalAmount = 0;

        for (var ri = 0; ri < rows.length; ri++) {
            var row = rows[ri];
            const productId = row.querySelector('.product-select').value;
            const qty = parseInt(row.querySelector('.qty-input').value, 10) || 0;
            const price = this.readRowUnitPrice(row);
            const unitName = (row.querySelector('.unit-select').value || '').trim();
            const batchNo = (row.querySelector('.batch-input') && row.querySelector('.batch-input').value) || '';
            // 同步可见值，避免界面仍显示旧价却按锁定价保存造成困扰
            var priceEl = row.querySelector('.price-input');
            if (priceEl && Number(priceEl.value) !== price) {
                priceEl.value = price;
            }

            if (!productId) {
                this.showPurchaseFormError('请为第 ' + (ri + 1) + ' 行选择产品');
                return null;
            }
            if (!unitName) {
                this.showPurchaseFormError('请为第 ' + (ri + 1) + ' 行选择单位（入库将按换算比计入库存）');
                return null;
            }
            var product = this.findPurchaseProduct(productId);
            if (product) {
                var baseU = (product.baseUnit || '').trim();
                if (baseU && unitName !== baseU && !this.isPackagingUnitAllowed(product, unitName)) {
                    var pname = product.name || product.productName || ('产品#' + productId);
                    this.showPurchaseFormError('产品「' + pname + '」未配置单位「' + unitName + '」的换算，请先在产品中心保存单位换算后再进货');
                    return null;
                }
            }
            if (qty < 1) {
                this.showPurchaseFormError('第 ' + (ri + 1) + ' 行数量须大于 0');
                return null;
            }
            if (price < 0) {
                this.showPurchaseFormError('第 ' + (ri + 1) + ' 行单价不能为负');
                return null;
            }

            var itemPayload = {
                productId: parseInt(productId, 10),
                quantity: qty,
                unitPrice: price,
                unitName: unitName,
                batchNo: batchNo,
                purchaseStatus: status || 'DRAFT',
                purchaseDate: purchaseDate
            };
            if (product && product.skuId != null && Number(product.skuId) > 0) {
                itemPayload.skuId = Number(product.skuId);
            }
            items.push(itemPayload);
            totalAmount += qty * price;
        }

        if (items.length === 0) { this.showPurchaseFormError('请至少添加一项商品'); return null; }

        const paidKeep = (this.currentPurchase && this.currentPurchase.paidAmount != null)
            ? this.currentPurchase.paidAmount
            : 0;
        const finSel = document.getElementById('purchase-fin-status');
        const finStatus = finSel ? finSel.value : 'UNPAID';

        const parsedSupplierId = supplierRaw ? parseInt(supplierRaw, 10) : null;
        const supplierId = (parsedSupplierId != null && !Number.isNaN(parsedSupplierId)) ? parsedSupplierId : null;

        const purchaseData = {
            supplierId: supplierId,
            accountId: accountId,
            warehouseId: warehouseId,
            purchaseStatus: status || 'DRAFT',
            purchaseDate: purchaseDate,
            totalAmount: totalAmount,
            paidAmount: paidKeep,
            finStatus: finStatus,
            items: items
        };

        return {
            purchase: this.currentPurchase && this.currentPurchase.purchaseId ? {
                purchaseId: this.currentPurchase.purchaseId,
                supplierId: purchaseData.supplierId,
                accountId: purchaseData.accountId,
                warehouseId: purchaseData.warehouseId,
                purchaseStatus: purchaseData.purchaseStatus,
                purchaseDate: purchaseData.purchaseDate,
                totalAmount: purchaseData.totalAmount,
                paidAmount: purchaseData.paidAmount,
                finStatus: purchaseData.finStatus,
                items: items
            } : purchaseData,
            items: items,
            purchaseStatus: status,
            finStatus: finStatus
        };
    },

    persistPurchase: async function(opts) {
        opts = opts || {};
        var requestData = this.buildPurchaseSavePayload();
        if (!requestData) return null;
        try {
            console.info('[SupplierModule] 保存进货明细单价',
                (requestData.items || []).map(function (it) {
                    return { productId: it.productId, unitPrice: it.unitPrice, qty: it.quantity };
                }));
            const response = await window.wrappedFetch('/api/v1/supp/purchases/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            var result = null;
            try {
                result = await response.json();
            } catch (parseErr) {
                result = null;
            }
            if (!response.ok) {
                var errMsg = (result && result.message) ? result.message : ('保存失败（HTTP ' + response.status + '）');
                if (!opts.silent) {
                    this.showPurchaseFormError(errMsg);
                    this.notify(errMsg, 'error');
                }
                return null;
            }
            if (!result || !result.success) {
                var failMsg = (result && result.message) ? result.message : '未知错误';
                if (!opts.silent) {
                    this.showPurchaseFormError('保存失败: ' + failMsg);
                    this.notify('保存失败: ' + failMsg, 'error');
                }
                return null;
            }
            // 校验回写单价是否落库
            var echoed = (result.data && result.data.items) ? result.data.items : [];
            if (echoed.length && requestData.items && requestData.items.length) {
                for (var ci = 0; ci < Math.min(echoed.length, requestData.items.length); ci++) {
                    var sent = Number(requestData.items[ci].unitPrice);
                    var got = Number(echoed[ci].unitPrice != null ? echoed[ci].unitPrice : echoed[ci].unit_price);
                    if (isFinite(sent) && isFinite(got) && Math.abs(sent - got) > 0.009) {
                        console.error('[SupplierModule] 单价落库不一致', { sent: sent, got: got, index: ci });
                        if (!opts.silent) {
                            this.notify('警告：第' + (ci + 1) + '行单价未正确保存（提交' + sent + '，回读' + got + '），请重试', 'error');
                        }
                    }
                }
            }
            this.currentPurchase = result.data || this.currentPurchase;
            if (this.currentPurchase && !this.currentPurchase.purchaseId && result.data && result.data.purchaseId) {
                this.currentPurchase = result.data;
            }
            var titleEl = document.getElementById('purchase-modal-title');
            if (titleEl && this.currentPurchase && this.currentPurchase.purchaseId) {
                titleEl.textContent = '编辑进货单';
            }
            this.syncFinStatusUI(this.currentPurchase);
            this.syncInboundUi();
            if (this.currentPurchase && this.currentPurchase.purchaseId) {
                var detail = await this.fetchPurchaseDetail(this.currentPurchase.purchaseId);
                if (detail) {
                    this.currentPurchase = detail;
                    this.applyPurchaseItemIdsFromPurchase(detail);
                }
            }
            if (opts.refreshList !== false) {
                await this.loadPurchases(this.purchaseCurrentPage);
                this.renderPurchases();
                this.loadPurchaseSummary();
            }
            var savedStatus = (requestData.purchaseStatus || (requestData.purchase && requestData.purchase.purchaseStatus) || '').toUpperCase();
            if (savedStatus === 'FULL_INBOUND' || savedStatus === '全部入库' || savedStatus === 'STOCKED') {
                if (window.ProductModule && typeof window.ProductModule.loadProducts === 'function') {
                    try { await window.ProductModule.loadProducts(); } catch (refreshErr) { /* ignore */ }
                }
            }
            try {
                window.dispatchEvent(new CustomEvent('tm-purchases-changed'));
            } catch (evErr) { /* ignore */ }
            return result;
        } catch (error) {
            console.error('Error saving purchase:', error);
            if (!opts.silent) this.notify('保存失败: ' + error.message, 'error');
            return null;
        }
    },

    ensurePurchaseSaved: async function(opts) {
        opts = opts || {};
        if (this.currentPurchase && this.currentPurchase.purchaseId) {
            if (!this.hasUnsavedPurchaseChanges()) {
                if (opts.forPayment) {
                    var cached = await this.fetchPurchaseDetail(this.currentPurchase.purchaseId);
                    if (cached) this.currentPurchase = cached;
                    this.syncFinStatusUI(this.currentPurchase);
                }
                return true;
            }
        }
        var result = await this.persistPurchase({ refreshList: false, silent: true });
        if (!result || !result.success) {
            return false;
        }
        if (this.currentPurchase && this.currentPurchase.purchaseId) {
            var detail = await this.fetchPurchaseDetail(this.currentPurchase.purchaseId);
            if (detail) {
                this.currentPurchase = detail;
                this.applyPurchaseItemIdsFromPurchase(detail);
            }
        } else if (!this.currentPurchase || !this.currentPurchase.purchaseId) {
            this.notify('单据已保存，可继续付款', 'success');
        }
        if (opts.forPayment) {
            this.syncFinStatusUI(this.currentPurchase);
        }
        return true;
    },

    savePurchase: async function() {
        var result = await this.persistPurchase({ refreshList: true });
        if (result && result.success) {
            this.closePurchaseModal();
            this.notify('进货单据已保存', 'success', { useDialog: true, title: '保存成功' });
        }
    },

    deletePurchase: async function(purchaseId) {
        var self = this;
        var runDelete = async function () {
        try {
            const response = await window.wrappedFetch('/api/v1/supp/purchases/' + purchaseId, {
                method: 'DELETE'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    await this.loadPurchases(this.purchaseCurrentPage);
                    if (this.purchases.length === 0 && this.purchaseCurrentPage > 1) {
                        await this.loadPurchases(this.purchaseCurrentPage - 1);
                    }
                    this.renderPurchases();
                    this.loadPurchaseSummary();
                    this.showToast('删除成功');
                } else {
                    this.notify('删除失败: ' + (result.message || '未知错误'), 'error');
                }
            } else {
                this.notify('删除失败', 'error');
            }
        } catch (error) {
            console.error('Error deleting purchase:', error);
            this.notify('删除失败: ' + error.message, 'error');
        }
        };
        if (window.TM_UI && typeof window.TM_UI.confirm === 'function') {
            window.TM_UI.confirm({
                title: '确认删除',
                message: '确定要删除这个进货单吗？',
                confirmLabel: '确认删除',
                danger: true
            }).then(function (ok) { if (ok) runDelete(); });
        } else if (confirm('确定要删除这个进货单吗？')) {
            runDelete();
        }
    },

    openPurchaseDetail: async function(purchaseId) {
        if (!purchaseId) return;
        var editBtn = document.getElementById('detail-purchase-edit-btn');
        if (editBtn) {
            editBtn.onclick = function () {
                closePurchaseDetail();
                window.SupplierModule.editPurchase(purchaseId);
            };
        }
        try {
            var resp = await window.wrappedFetch('/api/v1/supp/purchases/' + purchaseId, { method: 'GET' });
            if (!resp.ok) throw new Error('加载失败');
            var result = await resp.json();
            if (!result.success || !result.data) throw new Error(result.message || '无数据');
            var po = result.data;
            var idEl = document.getElementById('detail-purchase-id');
            var metaEl = document.getElementById('detail-purchase-meta');
            if (idEl) idEl.textContent = po.purchaseCode || ('PO-' + purchaseId);
            if (metaEl) metaEl.textContent = (po.supplierName || '') + ' · ' + (po.purchaseDate || '');
            var tbody = document.getElementById('detail-purchase-items-body');
            var items = po.items || po.purchaseItems || [];
            var total = 0;
            if (tbody) {
                if (!items.length) {
                    tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-6 text-center text-slate-400">暂无明细</td></tr>';
                } else {
                    tbody.innerHTML = items.map(function (it) {
                        var sub = Number(it.totalAmount != null ? it.totalAmount : (it.quantity || 0) * (it.unitPrice || 0));
                        total += sub;
                        var fmt = typeof window.TM_formatCNY === 'function' ? window.TM_formatCNY : function (v) { return '¥' + Number(v).toFixed(2); };
                        return '<tr><td class="px-5 py-3 font-bold">' + (it.productName || '—') + '</td>' +
                            '<td class="px-5 py-3 text-center font-mono">' + fmt(it.unitPrice || 0) + '</td>' +
                            '<td class="px-5 py-3 text-center font-mono">' + (it.quantity || 0) + '</td>' +
                            '<td class="px-5 py-3 text-right font-mono font-bold">' + fmt(sub) + '</td></tr>';
                    }).join('');
                }
            }
            if (po.totalAmount != null) total = Number(po.totalAmount);
            var totEl = document.getElementById('detail-purchase-total');
            if (totEl) totEl.textContent = typeof window.TM_formatCNY === 'function' ? window.TM_formatCNY(total) : ('¥' + total.toFixed(2));
            var modal = document.getElementById('purchase-detail-modal');
            if (modal) {
                if (typeof window.TM_applyDialogShell === 'function') window.TM_applyDialogShell(modal);
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (e) {
            console.error(e);
            this.editPurchase(purchaseId);
        }
    }
};

window.openSupplierModal = function() { window.SupplierModule.openSupplierModal(); };
window.closeSupplierModal = function() { window.SupplierModule.closeSupplierModal(); };
window.saveSupplier = function() { window.SupplierModule.saveSupplier(); };
window.openPurchaseModal = function() { window.SupplierModule.openPurchaseModal(); };
window.closePurchaseModal = function() { window.SupplierModule.closePurchaseModal(); };
window.savePurchase = function() { window.SupplierModule.savePurchase(); };
window.addPurchaseItem = function() { window.SupplierModule.addPurchaseItem(); };
window.removePurchaseItem = function(btn) { window.SupplierModule.removePurchaseItem(btn); };
window.onProductSelect = function(el) { window.SupplierModule.onProductSelect(el); };
window.onPurchasePriceInput = function(el) { window.SupplierModule.onPurchasePriceInput(el); };
window.calculatePurchaseTotal = function() { window.SupplierModule.calculatePurchaseTotal(); };
window.editSupplier = function(supplierId) { window.SupplierModule.editSupplier(supplierId); };
window.deleteSupplier = function(supplierId) { window.SupplierModule.deleteSupplier(supplierId); };
window.editPurchase = function(purchaseId) { window.SupplierModule.editPurchase(purchaseId); };
window.deletePurchase = function(purchaseId) { window.SupplierModule.deletePurchase(purchaseId); };
