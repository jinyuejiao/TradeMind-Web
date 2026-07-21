/**
 * 工作台增强：语音提单、待确认列表轮询、删除、价格/日期补全、自动建档下单、UI 对齐
 */
(function () {
    'use strict';

    function whenDashboardReady(cb, tries) {
        tries = tries || 0;
        if (typeof window.loadPendingOrders === 'function' && typeof window.stopVoiceRecording === 'function') {
            cb();
            return;
        }
        if (tries > 80) return;
        setTimeout(function () { whenDashboardReady(cb, tries + 1); }, 50);
    }

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification(msg, type || 'info');
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg);
        } else {
            alert(msg);
        }
    }

    function pendingListPlaceholderHtml(iconClass, message) {
        return '<div class="tm-pending-list-placeholder flex items-center justify-center py-10 text-slate-400 text-sm">' +
            '<div class="text-center"><i class="ph ' + iconClass + ' text-xl mb-2"></i><p>' + message + '</p></div></div>';
    }

    function clearPendingListPlaceholders(list) {
        if (!list) return;
        list.querySelectorAll(':scope > :not(.pending-draft-card)').forEach(function (el) {
            el.remove();
        });
    }

    /* ---------- 待确认单据 Store ---------- */
    var TM_PendingOrdersStore = {
        records: [],
        initialLoaded: false,
        slowPollTimer: null,
        fastPollTimer: null,

        refresh: function (showSpinner) {
            var list = document.getElementById('pending-orders-list');
            if (!list || !window.wrappedFetch) return Promise.resolve();

            if (showSpinner && !this.initialLoaded) {
                list.innerHTML = pendingListPlaceholderHtml('ph-spinner ph-spin', '加载待确认单据中...');
            } else {
                list.classList.add('tm-pending-list-refreshing');
            }

            var self = this;
            return window.wrappedFetch('/api/v1/ai/records', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (response) {
                    var ct = response.headers.get('content-type') || '';
                    if (ct.indexOf('application/json') === -1) {
                        return response.text().then(function (t) {
                            throw new Error('非 JSON 响应');
                        });
                    }
                    return response.json();
                })
                .then(function (data) {
                    list.classList.remove('tm-pending-list-refreshing');
                    var rows = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : null);
                    if (!rows) {
                        list.innerHTML = pendingListPlaceholderHtml('ph-x-circle', '数据加载失败');
                        return;
                    }
                    var prevIds = (self.records || []).map(function (r) { return String(r.id); });
                    var filtered = rows
                        .filter(function (r) {
                            var op = String(r.opType || r.op_type || 'ORDER_EXTRACT').toUpperCase();
                            if (op && op !== 'ORDER_EXTRACT') return false;
                            // EXTRACTING / SUCCESS / FAILED 均展示，禁止静默消失
                            return r.status === 'SUCCESS' || r.status === 'EXTRACTING' || r.status === 'FAILED';
                        })
                        .sort(function (a, b) { return new Date(b.createTime || 0) - new Date(a.createTime || 0); })
                        .slice(0, 20);
                    // 若某条从 EXTRACTING 变为不可见以外的失败/空壳，提示用户
                    filtered.forEach(function (r) {
                        if (prevIds.indexOf(String(r.id)) < 0) return;
                        if (r.status === 'FAILED' && typeof window.TM_UI !== 'undefined' && window.TM_UI.showNotification) {
                            var prev = (self.records || []).find(function (x) { return String(x.id) === String(r.id); });
                            if (prev && prev.status === 'EXTRACTING') {
                                window.TM_UI.showNotification('单据 #' + r.id + ' 识别失败，请查看待确认列表', 'error');
                            }
                        }
                    });
                    self.records = filtered;
                    window.pendingRecordsCache = filtered;
                    window.__TM_PENDING_RECORDS = filtered;
                    self.renderList(list, filtered);
                    self.initialLoaded = true;
                    self.syncPolling(filtered);
                    var countEl = document.getElementById('dashboard-pending-recognition-count');
                    if (countEl) {
                        var extractingN = filtered.filter(function (r) { return r.status === 'EXTRACTING'; }).length;
                        countEl.textContent = String(extractingN);
                    }
                })
                .catch(function (err) {
                    list.classList.remove('tm-pending-list-refreshing');
                    console.error('[PendingStore] 加载失败', err);
                    if (!self.initialLoaded) {
                        list.innerHTML = pendingListPlaceholderHtml('ph-x-circle', '加载失败，请刷新');
                    }
                });
        },

        renderList: function (list, records) {
            if (!records.length) {
                list.innerHTML = pendingListPlaceholderHtml('ph-check-circle', '暂无待确认单据');
                return;
            }

            clearPendingListPlaceholders(list);

            var existingMap = {};
            list.querySelectorAll('.pending-draft-card[data-record-id]').forEach(function (el) {
                existingMap[el.getAttribute('data-record-id')] = el;
            });

            var nextIds = records.map(function (r) { return String(r.id); });

            Object.keys(existingMap).forEach(function (id) {
                if (nextIds.indexOf(id) === -1) {
                    existingMap[id].remove();
                }
            });

            records.forEach(function (record, index) {
                var id = String(record.id);
                var card = existingMap[id];
                var isNew = !card;
                if (!card) {
                    card = document.createElement('div');
                    card.className = 'pending-draft-card p-4 border border-slate-50 rounded-xl bg-white hover:border-brand-500 transition-all cursor-pointer flex justify-between items-center group';
                    card.setAttribute('data-record-id', id);
                    if (index < list.children.length) {
                        list.insertBefore(card, list.children[index]);
                    } else {
                        list.appendChild(card);
                    }
                }
                if (isNew) card.classList.add('tm-pending-new');

                var parsed = typeof window.parseAiEnvelope === 'function'
                    ? window.parseAiEnvelope(record.aiResult || record.ai_result || '')
                    : { data: {} };
                var customerName = typeof window.getStructuredCustomerName === 'function'
                    ? window.getStructuredCustomerName(parsed.data)
                    : (record.customerName || '未知客户');
                var orderItems = (parsed.data && parsed.data.order_data && Array.isArray(parsed.data.order_data.items))
                    ? parsed.data.order_data.items : [];
                var recognitionTime = record.createTime
                    ? new Date(record.createTime).toLocaleString('zh-CN')
                    : '--';
                var isExtracting = record.status === 'EXTRACTING';
                var isFailed = record.status === 'FAILED';
                var isEmptyShell = record.status === 'SUCCESS' && orderItems.length === 0;
                var statusLabel = record.status === 'SUCCESS'
                    ? (isEmptyShell ? '已完成·无明细' : '已提取')
                    : (isExtracting ? '提取中' : (isFailed ? '识别失败' : (record.status || '处理中')));
                var statusClass = record.status === 'SUCCESS'
                    ? (isEmptyShell ? 'text-amber-600' : 'text-brand-600')
                    : (isFailed ? 'text-rose-600' : 'text-orange-500');
                var deleteBtnClass = 'tm-pending-delete' + (isExtracting ? ' opacity-35 pointer-events-none cursor-not-allowed' : '');
                var deleteTitle = isExtracting ? 'AI 识别中，暂不可删除' : '删除';
                var errLine = '';
                if (isFailed) {
                    var hint = record.errorHint || '';
                    if (!hint && record.aiResult) {
                        hint = String(record.aiResult).slice(0, 80);
                    }
                    errLine = hint
                        ? ('<p class="text-[9px] text-rose-500 mt-0.5 truncate">' + escapeHtml(hint) + '</p>')
                        : '<p class="text-[9px] text-rose-500 mt-0.5">识别失败，可删除后重试</p>';
                } else if (isEmptyShell) {
                    errLine = '<p class="text-[9px] text-amber-600 mt-0.5">未解析出商品行，请打开核对或删除重提</p>';
                }

                card.innerHTML =
                    '<div class="flex-1 min-w-0" data-open-audit="1">' +
                    '<p class="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition-colors truncate">客户：' + escapeHtml(customerName) + '</p>' +
                    '<div class="flex items-center gap-2 mt-1 flex-wrap">' +
                    '<span class="text-[9px] text-slate-400 uppercase tracking-tighter">' + escapeHtml(recognitionTime) + '</span>' +
                    '<span class="w-1 h-1 bg-slate-200 rounded-full"></span>' +
                    '<span class="text-[9px] ' + statusClass + ' font-bold">' + statusLabel + '</span>' +
                    '</div>' + errLine + '</div>' +
                    '<div class="flex items-center gap-2 shrink-0">' +
                    '<div class="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-black text-[10px]">' + orderItems.length + '</div>' +
                    '<button type="button" class="' + deleteBtnClass + '" title="' + escapeHtml(deleteTitle) + '" aria-label="删除待确认单据" aria-disabled="' + (isExtracting ? 'true' : 'false') + '" data-delete-id="' + escapeHtml(id) + '">' +
                    '<i class="ph ph-trash text-base"></i></button></div>';

                card.onclick = function (e) {
                    if (e.target.closest('.tm-pending-delete')) return;
                    if (isFailed || isEmptyShell) {
                        if (window.TM_UI && window.TM_UI.showNotification) {
                            window.TM_UI.showNotification(
                                isFailed ? '该单据识别失败，请删除后重新提交' : '未解析出商品，建议删除后重试',
                                'warning'
                            );
                        }
                        return;
                    }
                    if (typeof window.openAuditModal === 'function') {
                        window.openAuditModal(record.id);
                    }
                };
                var delBtn = card.querySelector('.tm-pending-delete');
                if (delBtn && !isExtracting) {
                    delBtn.onclick = function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        window.deletePendingOrder(record.id);
                    };
                }
            });
        },

        syncPolling: function (records) {
            var hasExtracting = records.some(function (r) { return r.status === 'EXTRACTING'; });
            if (hasExtracting) {
                this.startSlowPoll(60000);
            } else {
                this.stopSlowPoll();
            }
        },

        startSlowPoll: function (intervalMs) {
            var self = this;
            if (this.slowPollTimer) return;
            this.slowPollTimer = setInterval(function () {
                self.refresh(false);
            }, intervalMs);
        },

        stopSlowPoll: function () {
            if (this.slowPollTimer) {
                clearInterval(this.slowPollTimer);
                this.slowPollTimer = null;
            }
        },

        scheduleAfterSubmit: function () {
            var self = this;
            var fastCount = 0;
            if (this.fastPollTimer) clearInterval(this.fastPollTimer);
            setTimeout(function () { self.refresh(false); }, 800);
            this.fastPollTimer = setInterval(function () {
                self.refresh(false);
                fastCount++;
                if (fastCount >= 8) {
                    clearInterval(self.fastPollTimer);
                    self.fastPollTimer = null;
                }
            }, 15000);
            this.startSlowPoll(60000);
        }
    };

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    window.deletePendingOrder = async function (recordId) {
        var rec = TM_PendingOrdersStore.records.find(function (r) { return String(r.id) === String(recordId); });
        if (rec && rec.status === 'EXTRACTING') {
            notify('AI 正在识别该单据，请稍后再删除', 'error');
            return;
        }
        var msg = '确认删除该待确认单据？删除后不可恢复。';
        if (window.TM_UI && typeof window.TM_UI.confirm === 'function') {
            var ok = await window.TM_UI.confirm({ title: '确认', message: msg, confirmLabel: '确定' });
            if (!ok) return;
        } else if (!confirm(msg)) {
            return;
        }
        try {
            var resp = await window.wrappedFetch('/api/v1/ai/records/' + recordId, { method: 'DELETE' });
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                var errMsg = err.message || err.msg || '删除失败';
                if (resp.status === 409) {
                    errMsg = errMsg || 'AI 正在识别该单据，请稍后再删除';
                }
                throw new Error(errMsg);
            }
            notify('已删除待确认单据', 'success');
            await TM_PendingOrdersStore.refresh(false);
        } catch (e) {
            notify('删除失败: ' + (e.message || String(e)), 'error');
        }
    };

    window.TM_PendingOrdersStore = TM_PendingOrdersStore;

    /* ---------- 审核：小计重算、增删行、历史价、日期默认 ---------- */
    window.fillMissingAuditPrices = fillMissingAuditPrices;

    window.recalcAuditOrderTotals = function () {
        var total = 0;
        document.querySelectorAll('#order-items-body tr').forEach(function (row) {
            var qtyInp = row.querySelector('.audit-qty-input');
            var priceInp = row.querySelector('.price-input');
            var qty = qtyInp ? parseInt(qtyInp.value, 10) || 0 : 0;
            var price = priceInp ? parseFloat(priceInp.value) || 0 : 0;
            var sub = qty * price;
            var subEl = row.querySelector('.audit-line-subtotal');
            if (subEl) subEl.textContent = sub.toFixed(2);
            total += sub;
        });
        var totalEl = document.getElementById('audit-order-total') || document.getElementById('order-total-amount');
        if (totalEl) {
            totalEl.textContent = typeof window.TM_formatCNY === 'function'
                ? window.TM_formatCNY(total)
                : ('¥' + total.toFixed(2));
        }
    };

    window.auditFormAddLine = function () {
        if (!window.auditState || !window.auditState.aiStructured) return;
        if (!window.auditState.aiStructured.order_data) {
            window.auditState.aiStructured.order_data = { items: [] };
        }
        if (!Array.isArray(window.auditState.aiStructured.order_data.items)) {
            window.auditState.aiStructured.order_data.items = [];
        }
        window.auditState.aiStructured.order_data.items.push({
            product_name_raw: '',
            quantity: 1,
            unit: '',
            price_at_time: 0,
            total_amount: 0,
            matched_product_id: 0
        });
        if (typeof window.generateProductSelects === 'function') {
            window.generateProductSelects();
        }
        window.recalcAuditOrderTotals();
    };

    window.auditFormRemoveLine = function (btn) {
        var row = btn && btn.closest ? btn.closest('tr') : null;
        if (!row || !window.auditState || !window.auditState.aiStructured) return;
        var idx = Number(row.getAttribute('data-row-index'));
        var items = window.auditState.aiStructured.order_data && window.auditState.aiStructured.order_data.items;
        if (!items || isNaN(idx)) return;
        items.splice(idx, 1);
        if (typeof window.generateProductSelects === 'function') {
            window.generateProductSelects();
        }
        window.recalcAuditOrderTotals();
    };

    async function fillMissingAuditPrices() {
        var custSelect = document.getElementById('order-customer');
        if (!custSelect) return;
        var custVal = custSelect.value;
        if (!/^\d+$/.test(custVal)) return;
        var custId = parseInt(custVal, 10);
        var productIds = [];
        var rowMeta = [];
        document.querySelectorAll('#order-items-body tr').forEach(function (row, index) {
            var sel = row.querySelector('.product-select');
            var priceInp = row.querySelector('.price-input');
            if (!sel || !priceInp) return;
            var pid = sel.value;
            if (!/^\d+$/.test(pid)) return;
            var p = parseInt(pid, 10);
            var cur = parseFloat(priceInp.value);
            if (!cur || cur <= 0) {
                productIds.push(p);
                rowMeta.push({ row: row, productId: p, priceInp: priceInp });
            }
        });
        if (!productIds.length) return;
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/orders/last-unit-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ custId: custId, productIds: productIds })
            });
            var data = await (window.handleApiResponse ? window.handleApiResponse(resp) : resp.json());
            var map = (data && data.data) ? data.data : (data || {});
            rowMeta.forEach(function (meta) {
                var key = String(meta.productId);
                var price = map[key] != null ? parseFloat(map[key]) : null;
                if (price == null || price <= 0) {
                    if (typeof window.getProductPriceById === 'function') {
                        price = window.getProductPriceById(meta.productId);
                    }
                }
                if (price != null && price > 0) {
                    meta.priceInp.value = price.toFixed(2);
                    meta.priceInp.classList.add('price-input--history');
                    meta.priceInp.title = '已按该客户最近一次拿货价补全';
                    var idx = Number(meta.row.getAttribute('data-row-index'));
                    var items = window.auditState.aiStructured.order_data.items;
                    if (items && items[idx]) items[idx].price_at_time = price;
                }
            });
            window.recalcAuditOrderTotals();
        } catch (e) {
            console.warn('[Audit] 历史价补全失败', e);
        }
    }

    /* ---------- 确认下单前自动建档（路径 B：仅基本单位，不含包装换算） ---------- */
    async function quickSaveProduct(productName, sku, baseUnit, extra) {
        extra = extra || {};
        var nm = (productName || '').trim();
        if (!nm) throw new Error('产品名称不能为空');
        // 禁止复用目录已有 SKU 码（如 SKU-{spuId}-hash），避免 uq_products_tenant_sku
        var rawSku = (sku || '').trim();
        var looksLikeCatalog = /^SKU-\d+-\d+$/i.test(rawSku);
        var sk = (!rawSku || looksLikeCatalog)
            ? ('SKU-N-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8))
            : rawSku;
        var bu = (baseUnit || '').trim() || '件';
        var price = extra.price != null ? parseFloat(extra.price) : 0;
        if (isNaN(price)) price = 0;
        var stock = extra.stock != null ? parseInt(extra.stock, 10) : 0;
        if (isNaN(stock)) stock = 0;
        var body = {
            product: {
                name: nm,
                sku: sk,
                baseUnit: bu,
                purchaseUnit: bu,
                salesUnit: bu,
                price: price,
                stock: stock,
                tenantId: window.currentTenantId
            },
            warehouseStocks: []
        };
        var resp = await window.wrappedFetch('/api/v1/rd/products/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp && resp.status === 409) {
            var conflict = await resp.json().catch(function () { return {}; });
            var existId = conflict && conflict.data && (conflict.data.productId || conflict.data.product_id);
            if (existId) return Number(existId);
            throw new Error((conflict && conflict.message) || '产品 SKU 已存在');
        }
        var data = await (window.handleApiResponse ? window.handleApiResponse(resp) : resp.json());
        if (!data) throw new Error('保存产品无响应');
        var saved = data.data || data;
        var productId = saved.productId || saved.product_id || saved.id;
        if (!productId && saved.product) {
            productId = saved.product.productId || saved.product.product_id || saved.product.id;
        }
        if (!productId) throw new Error('保存产品未返回 ID');
        if (window.productList && Array.isArray(window.productList)) {
            window.productList.unshift({
                productId: Number(productId),
                name: nm,
                sku: sk,
                baseUnit: bu,
                salesUnit: bu
            });
        }
        return Number(productId);
    }

    function mergeAuditDraftForIndex(index) {
        var list = (window.auditState && window.auditState.aiStructured && window.auditState.aiStructured.new_products_found) || [];
        var npItem = list[index] || {};
        var draft = (window.auditState && window.auditState.newProductDrafts && window.auditState.newProductDrafts[index]) || {};
        var merged = Object.assign({}, npItem);
        Object.keys(draft).forEach(function (key) {
            var val = draft[key];
            if (val != null && String(val).trim() !== '') merged[key] = val;
        });
        return merged;
    }

    async function autoSaveNewProductsFromAudit() {
        if (!window.auditState || !window.auditState.aiStructured) return;
        var np = window.auditState.aiStructured.new_products_found;
        if (!Array.isArray(np) || !np.length) return;

        if (typeof window.readAuditProductFormToDraft === 'function') {
            window.readAuditProductFormToDraft(window.auditState.activeNewProductIndex || 0);
        }

        while (np.length > 0) {
            var merged = mergeAuditDraftForIndex(0);
            var pname = String(merged.name || merged.product_name || '').trim();
            if (!pname) throw new Error('新产品「' + (merged.product_name || '未命名') + '」缺少名称，无法自动建档');
            var sku = merged.sku || merged.product_sku || '';
            var bu = merged.base_unit || merged.baseUnit || merged.unit || '件';
            var pid = await quickSaveProduct(pname, sku, bu, {
                price: merged.price || merged.sale_price,
                stock: merged.stock
            });
            if (typeof window.linkOrderItemsToSavedProduct === 'function') {
                var defaultPrice = 0;
                if (typeof window.getNewProductDefaultPrice === 'function') {
                    defaultPrice = window.getNewProductDefaultPrice(merged);
                } else {
                    var rawP = merged.price != null ? merged.price : (merged.sale_price != null ? merged.sale_price : 0);
                    defaultPrice = Number(rawP) || 0;
                }
                window.linkOrderItemsToSavedProduct(
                    pid, pname, sku, [pname, merged.name, merged.product_name], bu, defaultPrice
                );
            }
            np.splice(0, 1);
            if (window.auditState.newProductDrafts) {
                var nextDrafts = {};
                Object.keys(window.auditState.newProductDrafts).forEach(function (k) {
                    var idx = Number(k);
                    if (idx > 0) nextDrafts[idx - 1] = window.auditState.newProductDrafts[k];
                });
                window.auditState.newProductDrafts = nextDrafts;
            }
        }

        if (typeof window.syncAuditOrderDetailsFromDom === 'function') {
            window.syncAuditOrderDetailsFromDom();
        }
        if (typeof window.generateProductSelects === 'function') {
            window.generateProductSelects();
        }
        if (typeof window.persistAuditResult === 'function') {
            try { await window.persistAuditResult(); } catch (e) { /* ignore draft persist */ }
        }
        if (typeof window.syncAuditNewProductSubtabs === 'function') {
            window.syncAuditNewProductSubtabs();
        }
    }

    async function saveCustomerInline(name, phone) {
        var registryRoot = document.getElementById('audit-customer-registry-root');
        var fromRegistry = (window.TmCustomerRegistry && registryRoot)
            ? window.TmCustomerRegistry.readPayloadWithMeta(registryRoot, { source: 'OTHER' })
            : null;
        var customerData = fromRegistry || {
            name: name,
            email: '',
            source: 'OTHER',
            region: '',
            address: '',
            summary: ''
        };
        if (name) customerData.name = name;
        if (phone) customerData.phone = phone;
        else if (!customerData.phone) customerData.phone = null;
        var response = await window.wrappedFetch('/api/v1/crm/customers/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customerData)
        });
        var raw = await response.text();
        var result = {};
        try { result = JSON.parse(raw); } catch (e) { /* ignore */ }
        if (!response.ok || result.success === false) {
            throw new Error((result && result.message) || '客户创建失败');
        }
        var payload = result.data || result;
        var custId = payload && (payload.id || payload.custId || payload.cust_id);
        if (!custId) throw new Error('客户创建未返回 ID');
        if (typeof window.TM_emitCustomersChanged === 'function') {
            window.TM_emitCustomersChanged({ customerId: Number(custId) });
        }
        return Number(custId);
    }

    async function ensureCustomerIdBeforeConfirm() {
        var customerSelect = document.getElementById('order-customer');
        if (!customerSelect) return null;

        if (window.auditState && window.auditState.aiStructured) {
            var resolvedEarly = typeof window.getMatchedCustomerId === 'function'
                ? window.getMatchedCustomerId(window.auditState.aiStructured)
                : 0;
            if (resolvedEarly > 0) {
                var rname = (window.auditState.aiStructured.customer_data && window.auditState.aiStructured.customer_data.matched_customer_name) || '';
                if (typeof window.ensureCustomerOptionInSelect === 'function') {
                    window.ensureCustomerOptionInSelect(customerSelect, resolvedEarly, rname || ('客户#' + resolvedEarly));
                } else {
                    customerSelect.value = String(resolvedEarly);
                }
                return resolvedEarly;
            }
        }

        var val = customerSelect.value;
        if (/^\d+$/.test(val)) return parseInt(val, 10);

        var registryRoot = document.getElementById('audit-customer-registry-root');
        var registryPayload = (window.TmCustomerRegistry && registryRoot)
            ? window.TmCustomerRegistry.readPayload(registryRoot)
            : null;
        var nameEl = registryRoot && registryRoot.querySelector('#cust-name');
        var phoneEl = registryRoot && registryRoot.querySelector('#cust-phone');
        var name = registryPayload ? registryPayload.name : (nameEl ? nameEl.value.trim() : '');
        var phone = registryPayload ? (registryPayload.phone || '') : (phoneEl ? phoneEl.value.trim() : '');
        if (window.auditState && window.auditState.aiStructured) {
            var nc = window.auditState.aiStructured.new_customers_found;
            if (Array.isArray(nc) && nc[0]) {
                if (!name) name = nc[0].name || '';
                if (!phone) phone = nc[0].phone || '';
            }
        }
        if (!name) {
            var opt = customerSelect.options[customerSelect.selectedIndex];
            name = opt ? (opt.getAttribute('data-name') || opt.textContent || '').trim() : '';
        }
        if (!name) throw new Error('无法确定客户名称，请先填写客户资料');

        var lookupHit = window.customerLookupByName && window.customerLookupByName[name];
        var custId;
        if (lookupHit && lookupHit.id) {
            custId = Number(lookupHit.id);
        } else {
            custId = await saveCustomerInline(name, phone || null);
        }
        if (window.auditState && window.auditState.aiStructured) {
            if (typeof window.markCustomerResolvedInAudit === 'function') {
                window.markCustomerResolvedInAudit(custId, name);
            } else {
                if (!window.auditState.aiStructured.customer_data) {
                    window.auditState.aiStructured.customer_data = {};
                }
                window.auditState.aiStructured.customer_data.matched_customer_id = custId;
                window.auditState.aiStructured.customer_data.matched_customer_name = name;
                window.auditState.aiStructured.new_customers_found = [];
            }
            if (typeof window.persistAuditResult === 'function') await window.persistAuditResult();
        }
        if (typeof window.ensureCustomerOptionInSelect === 'function') {
            window.ensureCustomerOptionInSelect(customerSelect, custId, name);
        } else {
            var option = document.createElement('option');
            option.value = String(custId);
            option.textContent = name;
            option.setAttribute('data-name', name);
            customerSelect.appendChild(option);
            customerSelect.value = String(custId);
        }
        return custId;
    }

    function TM_writeAuditItemMatchedFromRow(row, overrides) {
        overrides = overrides || {};
        if (!row || !window.auditState || !window.auditState.aiStructured) return;
        var idx = Number(row.getAttribute('data-row-index'));
        var items = window.auditState.aiStructured.order_data && window.auditState.aiStructured.order_data.items;
        if (!items || isNaN(idx) || !items[idx]) return;
        var item = items[idx];
        var sel = row.querySelector('.product-select');
        var opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        var spuKey = sel ? String(sel.value || '').trim() : '';
        var m = spuKey.match(/^(spu|legacy):(\d+)$/);
        if (m) {
            if (m[1] === 'spu') item.matched_spu_id = Number(m[2]);
            if (m[1] === 'legacy') item.matched_product_id = Number(m[2]);
        } else if (/^\d+$/.test(spuKey)) {
            item.matched_product_id = Number(spuKey);
        }
        var legacyPid = overrides.legacyProductId != null
            ? Number(overrides.legacyProductId)
            : (row.dataset.legacyProductId ? Number(row.dataset.legacyProductId) : null);
        var skuId = overrides.skuId != null
            ? Number(overrides.skuId)
            : (row.dataset.skuId ? Number(row.dataset.skuId) : null);
        if (legacyPid > 0) item.matched_product_id = legacyPid;
        if (skuId > 0) item.matched_sku_id = skuId;
        if (opt) {
            var nm = (opt.getAttribute('data-name') || opt.textContent || '').trim();
            if (nm) {
                item.matched_product_name = nm;
                item.product_name_raw = nm;
            }
            var legAttr = opt.getAttribute('data-legacy-product-id');
            if (legAttr && !(item.matched_product_id > 0)) {
                item.matched_product_id = Number(legAttr);
            }
            var spuAttr = opt.getAttribute('data-spu-id');
            if (spuAttr && !(item.matched_spu_id > 0)) {
                item.matched_spu_id = Number(spuAttr);
            }
        }
        if (overrides.attributesDisplay) item.attributes_display = overrides.attributesDisplay;
        if (overrides.skuCode) item.sku = overrides.skuCode;
        if (overrides.unit) item.unit = overrides.unit;
    }

    async function ensureProductIdsBeforeConfirm() {
        var rows = document.querySelectorAll('#order-items-body tr');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var sel = row.querySelector('.product-select');
            if (!sel) continue;
            var val = String(sel.value || '').trim();
            var rowNo = i + 1;

            // 已选目录产品（旧纯数字 productId）
            if (/^\d+$/.test(val)) {
                TM_writeAuditItemMatchedFromRow(row);
                continue;
            }
            // 新选型：spu:N / legacy:N —— 禁止误走建档
            if (/^(spu|legacy):\d+$/.test(val)) {
                var skuId = row.dataset.skuId ? parseInt(row.dataset.skuId, 10) : 0;
                var legacyPid = row.dataset.legacyProductId ? parseInt(row.dataset.legacyProductId, 10) : 0;
                var skus = typeof TM_findSkusForSpuKey === 'function' ? TM_findSkusForSpuKey(val) : [];
                if (!(skuId > 0) && skus.length === 1) {
                    TM_applyAuditSkuToRow(row, skus[0]);
                    skuId = row.dataset.skuId ? parseInt(row.dataset.skuId, 10) : 0;
                    legacyPid = row.dataset.legacyProductId ? parseInt(row.dataset.legacyProductId, 10) : 0;
                }
                if (skus.length > 1 && !(skuId > 0)) {
                    throw new Error('第 ' + rowNo + ' 行：请选择规格');
                }
                if (!(skuId > 0) && !(legacyPid > 0)) {
                    throw new Error('第 ' + rowNo + ' 行：请选择有效产品/规格');
                }
                TM_writeAuditItemMatchedFromRow(row);
                continue;
            }
            if (!val || val.indexOf('matched-product-placeholder-') === 0) {
                throw new Error('第 ' + rowNo + ' 行：请选择产品');
            }
            throw new Error('第 ' + rowNo + ' 行：请从产品目录选择产品');
        }

        // 仅真正「新产品信息 Tab」内未建档项才自动建档
        if (window.auditState && window.hasNewProducts && window.hasNewProducts(window.auditState.aiStructured)) {
            await autoSaveNewProductsFromAudit();
        }
    }

    window.syncAuditOrderItemUnitFromDom = function (inp) {
        var row = inp && inp.closest ? inp.closest('tr') : null;
        if (!row || !window.auditState || !window.auditState.aiStructured) return;
        var idx = Number(row.getAttribute('data-row-index'));
        var items = window.auditState.aiStructured.order_data && window.auditState.aiStructured.order_data.items;
        if (items && !isNaN(idx) && items[idx]) {
            items[idx].unit = inp.value ? String(inp.value).trim() : '';
        }
    };

    /* ---------- 审核弹窗 / 列表 / 确认下单补丁 ---------- */
    function TM_capAsBool(v, fallback) {
        if (v === undefined || v === null || v === '') return !!fallback;
        if (typeof v === 'string') return v === 'true' || v === '1';
        return !!v;
    }

    function TM_getAuditIndustryVertical() {
        var iv = '';
        if (window.TM_WorkbenchProfile) {
            iv = window.TM_WorkbenchProfile.industryVertical
                || (window.TM_WorkbenchProfile.getIndustryVertical && window.TM_WorkbenchProfile.getIndustryVertical())
                || '';
        }
        if (!iv && window.ProductModule && typeof window.ProductModule.getIndustryVertical === 'function') {
            iv = window.ProductModule.getIndustryVertical();
        }
        try {
            if (!iv) {
                iv = document.documentElement.getAttribute('data-industry-vertical') || '';
            }
        } catch (e) { /* ignore */ }
        iv = String(iv || 'GENERAL').toUpperCase().trim();
        if (iv === 'PENDING') return 'GENERAL';
        return iv;
    }

    /** 行业硬门控（不依赖外部实现，避免服饰误开序列号/批次） */
    function TM_auditIndustryAllows(capKey) {
        var iv = TM_getAuditIndustryVertical();
        if (iv === 'GENERAL' || iv === 'PENDING') return false;
        if (capKey === 'allowExpiry') return iv === 'FOOD';
        if (capKey === 'allowSerial') return iv === 'DIGITAL_3C';
        if (capKey === 'allowVariants') {
            return iv === 'CLOTHING' || iv === 'FOOD' || iv === 'DIGITAL_3C';
        }
        return false;
    }

    function TM_normalizeAuditCaps(raw) {
        var src = raw || window.TM_productCapabilities || {};
        var industryOn = {
            allowVariants: TM_auditIndustryAllows('allowVariants'),
            allowExpiry: TM_auditIndustryAllows('allowExpiry'),
            allowSerial: TM_auditIndustryAllows('allowSerial')
        };
        return {
            allowVariants: industryOn.allowVariants && TM_capAsBool(src.allowVariants, industryOn.allowVariants),
            allowExpiry: industryOn.allowExpiry && TM_capAsBool(src.allowExpiry, industryOn.allowExpiry),
            allowSerial: industryOn.allowSerial && TM_capAsBool(src.allowSerial, industryOn.allowSerial)
        };
    }

    function TM_getAuditCaps() {
        return TM_normalizeAuditCaps(window.TM_productCapabilities || {});
    }

    function TM_syncAuditTableHeaders() {
        var caps = TM_getAuditCaps();
        var showVariant = !!caps.allowVariants;
        var showExpiry = !!caps.allowExpiry;
        var showSerial = !!caps.allowSerial;
        document.querySelectorAll('.tm-audit-col-variant').forEach(function (el) {
            el.classList.toggle('hidden', !showVariant);
        });
        document.querySelectorAll('.tm-audit-col-batch').forEach(function (el) {
            el.classList.toggle('hidden', !showExpiry);
        });
        document.querySelectorAll('.tm-audit-col-serial').forEach(function (el) {
            el.classList.toggle('hidden', !showSerial);
        });
        // 表体多余列直接移除，避免仅表头 hidden 后与单元格错位（「已录 0 个」悬浮列）
        if (!showExpiry) {
            document.querySelectorAll('#order-items-body td.tm-audit-col-batch').forEach(function (el) {
                el.parentNode && el.parentNode.removeChild(el);
            });
        }
        if (!showSerial) {
            document.querySelectorAll('#order-items-body td.tm-audit-col-serial').forEach(function (el) {
                el.parentNode && el.parentNode.removeChild(el);
            });
        }
        return { showVariant: showVariant, showExpiry: showExpiry, showSerial: showSerial };
    }

    function TM_getAuditSkuCatalog() {
        if (window.TM_SkuCatalogCache && typeof window.TM_SkuCatalogCache.getRows === 'function') {
            var cached = window.TM_SkuCatalogCache.getRows();
            if (cached && cached.length) return cached;
        }
        return window.skuList || window.productList || [];
    }

    function TM_buildSpuSelectOptionsHtml(selectedSpuKey) {
        var list = TM_getAuditSkuCatalog();
        var map = {};
        list.forEach(function (sku) {
            var spuId = sku.spu_id != null ? sku.spu_id : sku.spuId;
            var legacyId = sku.legacy_product_id || sku.legacyProductId || sku.productId || sku.product_id;
            var key = spuId != null ? ('spu:' + spuId) : (legacyId != null ? ('legacy:' + legacyId) : null);
            if (!key) return;
            var name = sku.spu_name || sku.spuName || (window.getProductName && window.getProductName(sku)) || '';
            if (!name) return;
            if (!map[key]) {
                map[key] = {
                    key: key,
                    spuId: spuId,
                    legacyId: legacyId,
                    name: name,
                    skus: []
                };
            }
            map[key].skus.push(sku);
        });
        return Object.keys(map).map(function (k) {
            var g = map[k];
            var sel = selectedSpuKey && String(selectedSpuKey) === String(g.key) ? ' selected' : '';
            return '<option value="' + escapeHtml(g.key) + '"' + sel
                + (g.spuId != null ? (' data-spu-id="' + g.spuId + '"') : '')
                + (g.legacyId != null ? (' data-legacy-product-id="' + g.legacyId + '"') : '')
                + ' data-name="' + escapeHtml(g.name) + '">' + escapeHtml(g.name) + '</option>';
        }).join('');
    }

    function TM_findSkusForSpuKey(spuKey) {
        var list = TM_getAuditSkuCatalog();
        if (!spuKey) return [];
        var m = String(spuKey).match(/^(spu|legacy):(.+)$/);
        if (!m) return [];
        var kind = m[1];
        var id = m[2];
        return list.filter(function (sku) {
            if (kind === 'spu') {
                var spuId = sku.spu_id != null ? sku.spu_id : sku.spuId;
                return String(spuId) === String(id);
            }
            var legacyId = sku.legacy_product_id || sku.legacyProductId || sku.productId || sku.product_id;
            return String(legacyId) === String(id);
        });
    }

    function TM_skuSpecLabel(sku) {
        if (!sku) return '';
        if (window.TM_ProductDomain && typeof window.TM_ProductDomain.formatSkuSpecLabel === 'function') {
            var lab = window.TM_ProductDomain.formatSkuSpecLabel(sku);
            if (lab) return lab;
        }
        var attrs = sku.attributes_display || sku.attributesDisplay || sku.specDisplay || '';
        if (attrs) return attrs;
        if (sku.attributes && typeof sku.attributes === 'object') {
            return Object.keys(sku.attributes).map(function (k) { return sku.attributes[k]; }).filter(Boolean).join(' / ');
        }
        return sku.sku_code || sku.skuCode || ('SKU#' + (sku.sku_id || sku.skuId || ''));
    }

    /** @deprecated 保留兼容；审核表产品列已改为 SPU 下拉 */
    function TM_buildSkuSelectOptionsHtml() {
        return TM_buildSpuSelectOptionsHtml(null);
    }

    function TM_ensureAuditSpecSheet() {
        var sheet = document.getElementById('tm-audit-spec-sheet');
        if (sheet) return sheet;
        sheet = document.createElement('div');
        sheet.id = 'tm-audit-spec-sheet';
        sheet.className = 'fixed inset-0 z-[180] hidden';
        sheet.setAttribute('aria-hidden', 'true');
        sheet.innerHTML =
            '<div class="absolute inset-0 bg-slate-900/40" data-audit-spec-backdrop></div>'
            + '<div class="absolute left-0 right-0 bottom-0 max-h-[70vh] bg-white rounded-t-2xl shadow-2xl flex flex-col">'
            + '<div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">'
            + '<p class="text-sm font-bold text-slate-800">选择规格</p>'
            + '<button type="button" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500" data-audit-spec-close aria-label="关闭">'
            + '<i class="ph ph-x"></i></button></div>'
            + '<div id="tm-audit-spec-sheet-body" class="overflow-y-auto px-3 py-2 space-y-1"></div>'
            + '<div class="px-4 py-3 border-t border-slate-100 safe-area-pb">'
            + '<button type="button" class="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold" data-audit-spec-confirm>确认</button>'
            + '</div></div>';
        document.body.appendChild(sheet);
        sheet.addEventListener('click', function (e) {
            if (e.target.closest('[data-audit-spec-backdrop]') || e.target.closest('[data-audit-spec-close]')) {
                TM_closeAuditSpecSheet();
            }
            if (e.target.closest('[data-audit-spec-confirm]')) {
                TM_confirmAuditSpecSheet();
            }
            var item = e.target.closest('[data-audit-sku-id]');
            if (item && sheet.contains(item)) {
                sheet.querySelectorAll('[data-audit-sku-id]').forEach(function (el) {
                    el.classList.remove('ring-2', 'ring-brand-400', 'bg-brand-50');
                });
                item.classList.add('ring-2', 'ring-brand-400', 'bg-brand-50');
                sheet._pendingSkuId = item.getAttribute('data-audit-sku-id');
            }
        });
        return sheet;
    }

    function TM_closeAuditSpecSheet() {
        var sheet = document.getElementById('tm-audit-spec-sheet');
        if (!sheet) return;
        sheet.classList.add('hidden');
        sheet.setAttribute('aria-hidden', 'true');
        sheet._auditRow = null;
        sheet._auditSkus = null;
        sheet._pendingSkuId = null;
    }

    function TM_confirmAuditSpecSheet() {
        var sheet = document.getElementById('tm-audit-spec-sheet');
        if (!sheet || !sheet._auditRow || !sheet._auditSkus) {
            TM_closeAuditSpecSheet();
            return;
        }
        var sid = sheet._pendingSkuId;
        var hit = sheet._auditSkus.find(function (s) {
            return String(s.sku_id || s.skuId) === String(sid);
        });
        if (hit) TM_applyAuditSkuToRow(sheet._auditRow, hit);
        TM_closeAuditSpecSheet();
    }

    window.TM_openAuditSpecPicker = function (btn) {
        var row = btn && btn.closest ? btn.closest('tr') : null;
        if (!row) return;
        var spuSel = row.querySelector('.product-select');
        var spuKey = spuSel && spuSel.value;
        if (!spuKey) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请先选择产品', 'warning');
            }
            return;
        }
        var skus = TM_findSkusForSpuKey(spuKey);
        if (!skus.length) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('该产品暂无规格', 'warning');
            }
            return;
        }
        if (skus.length === 1) {
            TM_applyAuditSkuToRow(row, skus[0]);
            return;
        }
        var sheet = TM_ensureAuditSpecSheet();
        var body = document.getElementById('tm-audit-spec-sheet-body');
        var curSku = row.dataset.skuId;
        sheet._auditRow = row;
        sheet._auditSkus = skus;
        sheet._pendingSkuId = curSku || String(skus[0].sku_id || skus[0].skuId);
        body.innerHTML = skus.map(function (sku) {
            var sid = sku.sku_id || sku.skuId;
            var label = escapeHtml(TM_skuSpecLabel(sku) || ('SKU#' + sid));
            var selected = String(sid) === String(sheet._pendingSkuId);
            return '<button type="button" data-audit-sku-id="' + sid + '" class="w-full text-left px-3 py-3 rounded-xl border border-slate-100 text-sm font-bold text-slate-700 '
                + (selected ? 'ring-2 ring-brand-400 bg-brand-50' : 'bg-white hover:bg-slate-50') + '">'
                + label + '</button>';
        }).join('');
        sheet.classList.remove('hidden');
        sheet.setAttribute('aria-hidden', 'false');
    };

    function TM_applyAuditSkuToRow(row, sku) {
        if (!row || !sku) return;
        var sid = sku.sku_id || sku.skuId;
        var legacyId = sku.legacy_product_id || sku.legacyProductId || sku.productId || sku.product_id;
        var spuId = sku.spu_id != null ? sku.spu_id : sku.spuId;
        var label = TM_skuSpecLabel(sku);
        var skuCode = sku.sku_code || sku.skuCode || '';
        var unit = sku.sales_unit || sku.salesUnit || sku.base_unit || sku.baseUnit;
        row.dataset.skuId = String(sid);
        if (legacyId != null) row.dataset.legacyProductId = String(legacyId);
        var btn = row.querySelector('.audit-spec-btn');
        if (btn) {
            btn.textContent = label || ('SKU#' + sid);
            btn.classList.add('is-selected');
            btn.classList.remove('is-missing');
        }
        var variantInp = row.querySelector('.audit-variant-input');
        if (variantInp) variantInp.value = label;
        var priceInp = row.querySelector('.price-input');
        var p = Number(sku.price);
        if (priceInp && isFinite(p) && p > 0 && priceInp.dataset.userEdited !== '1') {
            priceInp.value = p;
        }
        var unitInp = row.querySelector('.audit-unit-input') || row.querySelector('.unit-input');
        if (unitInp && unit) unitInp.value = unit;
        TM_writeAuditItemMatchedFromRow(row, {
            skuId: sid,
            legacyProductId: legacyId,
            attributesDisplay: label,
            skuCode: skuCode,
            unit: unit
        });
        if (spuId != null && window.auditState && window.auditState.aiStructured
            && window.auditState.aiStructured.order_data
            && Array.isArray(window.auditState.aiStructured.order_data.items)) {
            var idx = Number(row.getAttribute('data-row-index'));
            var it = window.auditState.aiStructured.order_data.items[idx];
            if (it) it.matched_spu_id = Number(spuId);
        }
        if (typeof window.recalcAuditOrderTotals === 'function') window.recalcAuditOrderTotals();
        else if (typeof window.recalcAuditOrderTotal === 'function') window.recalcAuditOrderTotal();
        else if (typeof window.updateAuditTotal === 'function') window.updateAuditTotal();
    }

    window.TM_loadSkuListAndCapabilities = async function () {
        try {
            var capsRes = await window.wrappedFetch('/api/v1/rd/products/capabilities');
            var capsData = capsRes.ok ? await capsRes.json() : null;
            if (capsData && capsData.success && capsData.data) {
                window.TM_productCapabilities = capsData.data;
            }
        } catch (e) { /* ignore */ }
        window.TM_productCapabilities = TM_normalizeAuditCaps(window.TM_productCapabilities || {});
        try {
            if (window.TM_SkuCatalogCache && typeof window.TM_SkuCatalogCache.load === 'function') {
                await window.TM_SkuCatalogCache.load(null, false);
            }
        } catch (e2) { /* ignore */ }
        if (typeof window.loadProductList === 'function') {
            await window.loadProductList();
        }
        TM_syncAuditTableHeaders();
    };

    function patchAuditAndPending() {
        window.loadPendingOrders = function () {
            return TM_PendingOrdersStore.refresh(true);
        };
        window.schedulePendingOrdersRefresh = function () {
            TM_PendingOrdersStore.scheduleAfterSubmit();
        };
        window.TM_refreshDashboardPendingOrders = function () {
            return TM_PendingOrdersStore.refresh(false);
        };

        var origGenerate = window.generateProductSelects;
        window.generateProductSelects = function () {
            var orderItemsBody = document.getElementById('order-items-body');
            if (!orderItemsBody) return;
            orderItemsBody.innerHTML = '';

            var orderData = (window.auditState && window.auditState.aiStructured && window.auditState.aiStructured.order_data)
                ? window.auditState.aiStructured.order_data : {};
            var items = Array.isArray(orderData.items) ? orderData.items : [];

            var caps = TM_getAuditCaps();
            var colVis = TM_syncAuditTableHeaders() || {};
            var showVariant = !!colVis.showVariant && !!caps.allowVariants;
            var showExpiry = !!colVis.showExpiry && !!caps.allowExpiry;
            var showSerial = !!colVis.showSerial && !!caps.allowSerial;
            // 服饰/通用行业：绝不渲染批次与序列号单元格（防止表头 hidden、表体仍有「已录 0 个」错位）
            var iv = TM_getAuditIndustryVertical();
            if (iv === 'CLOTHING' || iv === 'GENERAL') {
                showExpiry = false;
                showSerial = false;
            }

            items.forEach(function (item, index) {
                if (typeof window.normalizeAuditOrderItem === 'function') {
                    window.normalizeAuditOrderItem(item);
                }
                var displayMatchedName = (item.matched_product_name || item.matched_spu_name || '').trim();
                var matchedSkuId = item.matched_sku_id ? Number(item.matched_sku_id) : 0;
                var matchedSpuId = item.matched_spu_id != null ? Number(item.matched_spu_id) : null;
                var legacyPid = item.matched_product_id ? Number(item.matched_product_id) : null;
                var attrsDisplay = item.attributes_display || '';
                var spuKey = matchedSpuId ? ('spu:' + matchedSpuId)
                    : (legacyPid ? ('legacy:' + legacyPid) : '');
                // 若仅有 skuId，反查 SPU key
                if (!spuKey && matchedSkuId > 0) {
                    var hitSku = TM_getAuditSkuCatalog().find(function (s) {
                        return Number(s.sku_id || s.skuId) === matchedSkuId;
                    });
                    if (hitSku) {
                        var sid = hitSku.spu_id != null ? hitSku.spu_id : hitSku.spuId;
                        var lid = hitSku.legacy_product_id || hitSku.legacyProductId;
                        spuKey = sid != null ? ('spu:' + sid) : (lid != null ? ('legacy:' + lid) : '');
                        if (!attrsDisplay) attrsDisplay = TM_skuSpecLabel(hitSku);
                        if (legacyPid == null && lid != null) legacyPid = Number(lid);
                    }
                }
                var lineUnit = typeof window.resolveAuditItemUnit === 'function'
                    ? window.resolveAuditItemUnit(item, matchedSkuId > 0 ? matchedSkuId : null)
                    : (item.unit || '件');
                var unitReadonly = matchedSkuId > 0;
                var productNameValue = (displayMatchedName || item.product_name_raw || '').trim();
                var selectOptions = TM_buildSpuSelectOptionsHtml(spuKey);
                var skusForSpu = spuKey ? TM_findSkusForSpuKey(spuKey) : [];
                var needSpec = showVariant && skusForSpu.length > 1;
                // 未启用/单规格：不展示 AI 回填的假规格文案
                if (!needSpec) {
                    attrsDisplay = matchedSkuId > 0
                        ? (TM_skuSpecLabel(skusForSpu[0]) || '默认规格')
                        : '默认规格';
                }
                var specLabel = needSpec
                    ? (attrsDisplay || (matchedSkuId ? ('SKU#' + matchedSkuId) : '选择规格'))
                    : (attrsDisplay || '默认规格');
                var specMissing = needSpec && !(matchedSkuId > 0);
                var specBtnClass = 'audit-spec-btn text-xs font-bold px-2 py-1.5 rounded-lg border w-full text-left '
                    + (specMissing ? 'border-rose-300 text-rose-600 bg-rose-50 is-missing'
                        : (matchedSkuId ? 'border-teal-200 text-teal-700 bg-teal-50 is-selected' : 'border-slate-200 text-slate-500 bg-slate-50'));

                var variantCell = showVariant
                    ? ('<td class="tm-audit-td tm-audit-col-variant">'
                        + '<button type="button" class="' + specBtnClass + '" onclick="event.stopPropagation(); TM_openAuditSpecPicker(this)">'
                        + escapeHtml(specLabel) + '</button>'
                        + '<input type="hidden" class="audit-variant-input" value="' + escapeHtml(attrsDisplay) + '" /></td>')
                    : '';
                var batchCell = showExpiry
                    ? ('<td class="tm-audit-td tm-audit-col-batch"><input type="text" class="form-input tm-audit-cell-input audit-batch-input text-xs" value="' + escapeHtml(item.batch_no || '') + '" placeholder="批次号" /><input type="date" class="form-input tm-audit-cell-input audit-prod-date-input text-xs mt-1" value="' + escapeHtml((item.production_date || '').slice(0, 10)) + '" /></td>')
                    : '';
                var serialCell = showSerial
                    ? ('<td class="tm-audit-td tm-audit-col-serial"><button type="button" class="text-xs text-brand-600 audit-serial-btn" data-index="' + index + '">已录 ' + ((item.serial_nos || []).length) + ' 个</button></td>')
                    : '';

                var row = document.createElement('tr');
                row.setAttribute('data-row-index', String(index));
                if (matchedSkuId > 0) row.dataset.skuId = String(matchedSkuId);
                if (legacyPid != null && legacyPid > 0) row.dataset.legacyProductId = String(legacyPid);
                row.innerHTML =
                    '<td class="tm-audit-td tm-audit-td--product">' +
                    '<select class="form-input tm-audit-cell-input product-select" data-index="' + index + '" onchange="handleAuditProductSelectChange(this)">' +
                    '<option value="">-- 选择产品 --</option>' + selectOptions + '</select></td>' +
                    variantCell +
                    '<td class="tm-audit-td tm-audit-td--qty">' +
                    '<input type="number" value="' + (item.quantity || 1) + '" min="1" class="form-input tm-audit-cell-input audit-qty-input text-center" oninput="recalcAuditOrderTotals()"></td>' +
                    '<td class="tm-audit-td tm-audit-td--unit">' +
                    '<input type="text" value="' + escapeHtml(lineUnit) + '" maxlength="20" class="form-input tm-audit-cell-input audit-unit-input text-center' +
                    (unitReadonly ? ' tm-audit-unit-readonly' : '') + '"' +
                    (unitReadonly ? ' readonly' : '') +
                    ' oninput="syncAuditOrderItemUnitFromDom(this)"></td>' +
                    batchCell +
                    serialCell +
                    '<td class="tm-audit-td tm-audit-td--price">' +
                    '<input type="number" value="' + (item.price_at_time || 0) + '" step="0.01" min="0" class="form-input tm-audit-cell-input price-input text-center" oninput="recalcAuditOrderTotals()"></td>' +
                    '<td class="tm-audit-td tm-audit-td--sub text-right font-mono font-bold text-slate-900">' +
                    '<span class="audit-line-subtotal">' + (Number(item.total_amount || 0)).toFixed(2) + '</span></td>' +
                    '<td class="tm-audit-td tm-audit-td--action">' +
                    '<button type="button" class="tm-audit-row-delete" onclick="auditFormRemoveLine(this)" aria-label="删除行"><i class="ph ph-trash"></i></button></td>';

                orderItemsBody.appendChild(row);
                var select = row.querySelector('.product-select');
                if (select) {
                    if (spuKey && select.querySelector('option[value="' + spuKey.replace(/"/g, '\\"') + '"]')) {
                        select.value = spuKey;
                    } else if (productNameValue) {
                        var options = Array.from(select.options);
                        var byName = options.find(function (opt) {
                            return (opt.getAttribute('data-name') || '').trim() === productNameValue;
                        });
                        if (byName) {
                            select.value = byName.value;
                            spuKey = byName.value;
                        }
                    }
                    // 单规格自动绑定
                    if (select.value) {
                        var autoSkus = TM_findSkusForSpuKey(select.value);
                        if (autoSkus.length === 1 && !(row.dataset.skuId > 0)) {
                            TM_applyAuditSkuToRow(row, autoSkus[0]);
                        }
                    } else if (productNameValue) {
                        var placeholder = document.createElement('option');
                        placeholder.value = 'matched-product-placeholder-' + index;
                        placeholder.textContent = productNameValue;
                        placeholder.setAttribute('data-name', productNameValue);
                        placeholder.selected = true;
                        select.insertBefore(placeholder, select.firstChild);
                    }
                }
                var serialBtn = row.querySelector('.audit-serial-btn');
                if (serialBtn && window.TmSerialCapture) {
                    serialBtn.addEventListener('click', function () {
                        var idx = Number(serialBtn.getAttribute('data-index'));
                        var it = items[idx];
                        if (!it) return;
                        var skuId = it.matched_sku_id || it.matched_product_id;
                        window.TmSerialCapture.open({
                            mode: 'inbound',
                            skuId: skuId,
                            expectedQty: it.quantity || 1,
                            initialSerials: it.serial_nos || [],
                            onComplete: function (serials) {
                                it.serial_nos = serials;
                                serialBtn.textContent = '已录 ' + serials.length + ' 个';
                            }
                        });
                    });
                }
            });

            var customerSelect = document.getElementById('order-customer');
            if (customerSelect && window.auditState && window.auditState.aiStructured) {
                if (typeof window.applyAuditCustomerSelectState === 'function') {
                    window.applyAuditCustomerSelectState(customerSelect);
                }
            }

            window.recalcAuditOrderTotals();
            fillMissingAuditPrices();
            TM_syncAuditTableHeaders();
        };

        var origOpen = window.__TM_DASHBOARD_OPEN_AUDIT_ORIG
            || window.__TM_DASHBOARD_OPEN_AUDIT
            || window.openAuditModal;
        if (typeof origOpen === 'function' && !origOpen.__tmAuditPatched) {
            window.__TM_DASHBOARD_OPEN_AUDIT_ORIG = origOpen;
        } else if (typeof window.__TM_DASHBOARD_OPEN_AUDIT_ORIG === 'function') {
            origOpen = window.__TM_DASHBOARD_OPEN_AUDIT_ORIG;
        }
        var patchedOpen = async function (recordId) {
            if (typeof window.TM_loadSkuListAndCapabilities === 'function') {
                await window.TM_loadSkuListAndCapabilities();
            }
            await origOpen(recordId);
            TM_syncAuditTableHeaders();
            var dateEl = document.getElementById('order-delivery-date');
            if (dateEl && !dateEl.value && typeof window.getTodayDateInput === 'function') {
                dateEl.value = window.getTodayDateInput();
            }
            var custSelect = document.getElementById('order-customer');
            if (custSelect && !custSelect.dataset.tmAuditPriceBound) {
                custSelect.dataset.tmAuditPriceBound = '1';
                custSelect.addEventListener('change', function () {
                    setTimeout(fillMissingAuditPrices, 100);
                });
            }
        };
        patchedOpen.__tmAuditPatched = true;
        window.openAuditModal = patchedOpen;
        // 主壳 ui-main 走 __TM_DASHBOARD_OPEN_AUDIT，需同步挂载补丁后的打开逻辑
        window.__TM_DASHBOARD_OPEN_AUDIT = patchedOpen;

        function hasUnsavedAuditUnitConversions() {
            if (!window.auditState || typeof window.hasNewProducts !== 'function'
                || !window.hasNewProducts(window.auditState.aiStructured)) {
                return false;
            }
            var PM = window.ProductModule;
            if (PM && typeof PM.resolveUnitConversionsForSave === 'function') {
                var live = PM.resolveUnitConversionsForSave();
                if (live && live.length) return true;
            }
            var drafts = window.auditState.newProductDrafts || {};
            var keys = Object.keys(drafts);
            for (var i = 0; i < keys.length; i++) {
                var d = drafts[keys[i]];
                var uc = d && (d.unit_conversions || d.unitConversions);
                if (Array.isArray(uc) && uc.length) return true;
            }
            return false;
        }

        function confirmAuditPathBWarning() {
            if (!hasUnsavedAuditUnitConversions()) {
                return Promise.resolve(true);
            }
            var msg = '尚有新产品未保存档案。确认下单将按基本单位自动建档，包装单位换算不会生效。如需按包装单位进货，请先点击「保存当前产品」。';
            if (window.TmConfirm && typeof window.TmConfirm.open === 'function') {
                return new Promise(function (resolve) {
                    window.TmConfirm.open({
                        title: '未保存包装换算',
                        message: msg,
                        confirmLabel: '继续下单',
                        cancelLabel: '返回保存',
                        onConfirm: function () { resolve(true); },
                        onCancel: function () { resolve(false); }
                    });
                });
            }
            return Promise.resolve(window.confirm(msg + '\n\n点击「确定」继续下单'));
        }

        var origConfirm = window.confirmAuditOrder;
        window.confirmAuditOrder = async function () {
            try {
                var proceed = await confirmAuditPathBWarning();
                if (!proceed) return;
                await ensureProductIdsBeforeConfirm();
                await ensureCustomerIdBeforeConfirm();
            } catch (e) {
                notify(e.message || '自动建档失败', 'error');
                return;
            }
            return origConfirm();
        };

        window.TM_confirmAuditShortageIfNeeded = async function (items) {
            var list = window.skuList || window.productList || [];
            function findStock(skuId, productId) {
                for (var i = 0; i < list.length; i++) {
                    var s = list[i];
                    var sid = s.sku_id || s.skuId;
                    var pid = s.legacy_product_id || s.legacyProductId || s.productId || s.product_id;
                    if ((skuId && String(sid) === String(skuId)) || (productId && String(pid) === String(productId))) {
                        var stock = s.stock != null ? s.stock : (s.quantity != null ? s.quantity : s.available_qty);
                        if (stock == null) return null;
                        return Number(stock) || 0;
                    }
                }
                return null;
            }
            var shortages = [];
            (items || []).forEach(function (item) {
                var stock = findStock(item.skuId, item.productId);
                if (stock == null) return;
                if (stock < item.quantity) {
                    var name = item._name || ('SKU#' + (item.skuId || item.productId));
                    shortages.push({ name: name, qty: item.quantity, stock: stock, lack: item.quantity - Math.max(0, stock) });
                }
            });
            if (!shortages.length) return true;
            var msg = shortages.map(function (x) {
                return x.name + '：需 ' + x.qty + '，可用 ' + x.stock + '，欠 ' + x.lack;
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
        };

        window.collectAuditOrderItemsForSubmit = function (deliveryDate) {
            var items = [];
            var errors = [];
            var rows = document.querySelectorAll('#order-items-body tr');
            var caps = TM_getAuditCaps();
            rows.forEach(function (row, rowIndex) {
                var productSelect = row.querySelector('.product-select');
                var qtyInput = row.querySelector('.audit-qty-input') || row.querySelector('.tm-audit-td--qty input[type="number"]');
                var priceInput = row.querySelector('.price-input');
                var spuKey = productSelect ? String(productSelect.value || '').trim() : '';
                if (!spuKey || spuKey.indexOf('matched-product-placeholder-') === 0) {
                    errors.push('第 ' + (rowIndex + 1) + ' 行：请选择产品');
                    return;
                }
                var opt = productSelect.options[productSelect.selectedIndex];
                var legacyPid = row.dataset.legacyProductId
                    ? parseInt(row.dataset.legacyProductId, 10)
                    : (opt && opt.getAttribute('data-legacy-product-id')
                        ? parseInt(opt.getAttribute('data-legacy-product-id'), 10) : null);
                var skuId = row.dataset.skuId ? parseInt(row.dataset.skuId, 10) : null;
                var skus = TM_findSkusForSpuKey(spuKey);
                if (!(skuId > 0) && skus.length === 1) {
                    skuId = Number(skus[0].sku_id || skus[0].skuId);
                    if (legacyPid == null) {
                        legacyPid = Number(skus[0].legacy_product_id || skus[0].legacyProductId) || null;
                    }
                }
                if (caps.allowVariants && skus.length > 1 && !(skuId > 0)) {
                    errors.push('第 ' + (rowIndex + 1) + ' 行：请选择规格');
                    return;
                }
                if (!(skuId > 0) && !(legacyPid > 0)) {
                    errors.push('第 ' + (rowIndex + 1) + ' 行：请选择有效产品/规格');
                    return;
                }
                var qty = parseInt(qtyInput && qtyInput.value ? qtyInput.value : '0', 10);
                var unitPrice = parseFloat(priceInput && priceInput.value ? priceInput.value : '0');
                if ((!unitPrice || unitPrice <= 0) || isNaN(unitPrice)) {
                    var hit = skus.find(function (s) { return Number(s.sku_id || s.skuId) === Number(skuId); });
                    if (hit && Number(hit.price) > 0) unitPrice = Number(hit.price);
                }
                if (!qty || qty <= 0) {
                    errors.push('第 ' + (rowIndex + 1) + ' 行：数量须大于 0');
                    return;
                }
                if (!unitPrice || unitPrice <= 0) {
                    errors.push('第 ' + (rowIndex + 1) + ' 行：请填写单价');
                    return;
                }
                var lineTotal = Math.round(qty * unitPrice * 100) / 100;
                var line = {
                    skuId: skuId > 0 ? skuId : null,
                    quantity: qty,
                    unitPrice: unitPrice,
                    totalAmount: lineTotal,
                    itemStatus: 'PENDING',
                    _name: (opt && opt.getAttribute('data-name')) || ''
                };
                if (legacyPid > 0) line.productId = legacyPid;
                var batchInp = row.querySelector('.audit-batch-input');
                if (batchInp && batchInp.value) line.batchNo = batchInp.value.trim();
                var prodDateInp = row.querySelector('.audit-prod-date-input');
                if (prodDateInp && prodDateInp.value) line.productionDate = prodDateInp.value;
                items.push(line);
            });
            if (errors.length) {
                return { items: items, errors: errors };
            }
            return { items: items, errors: [] };
        };

        // 覆盖：产品列选 SPU 后清空 SKU，多规格时提示选择；并回写 matched_*
        var origHandleAuditProduct = window.handleAuditProductSelectChange;
        window.handleAuditProductSelectChange = function (selectEl, opts) {
            opts = opts || {};
            var row = selectEl.closest('tr');
            if (!row) return;
            var spuKey = selectEl.value || '';
            delete row.dataset.skuId;
            var opt = selectEl.options[selectEl.selectedIndex];
            var legacyId = opt && opt.getAttribute('data-legacy-product-id');
            if (legacyId) row.dataset.legacyProductId = legacyId;
            else delete row.dataset.legacyProductId;
            var btn = row.querySelector('.audit-spec-btn');
            var skus = spuKey ? TM_findSkusForSpuKey(spuKey) : [];
            if (!spuKey) {
                if (btn) {
                    btn.textContent = '选择规格';
                    btn.classList.add('is-missing');
                    btn.classList.remove('is-selected');
                }
                TM_writeAuditItemMatchedFromRow(row);
                return;
            }
            if (skus.length === 1) {
                TM_applyAuditSkuToRow(row, skus[0]);
                return;
            }
            if (skus.length > 1) {
                if (btn) {
                    btn.textContent = '选择规格';
                    btn.classList.add('is-missing');
                    btn.classList.remove('is-selected');
                }
                TM_writeAuditItemMatchedFromRow(row);
                if (!opts.preserveExistingPrice) {
                    TM_openAuditSpecPicker(btn || row);
                }
                return;
            }
            TM_writeAuditItemMatchedFromRow(row);
            if (typeof origHandleAuditProduct === 'function') {
                try { origHandleAuditProduct(selectEl, opts); } catch (e) { /* ignore */ }
            }
        };

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                TM_PendingOrdersStore.refresh(false);
            }
        });
    }

    /* ---------- 手动添加订单（进行中业务） ---------- */
    function tmManualOrderShowErrors(messages) {
        var box = document.getElementById('manual-order-form-errors');
        if (!box) return;
        if (!messages || !messages.length) {
            box.classList.add('hidden');
            box.innerHTML = '';
            return;
        }
        box.classList.remove('hidden');
        box.innerHTML = '<ul class="list-disc pl-4 space-y-0.5">' +
            messages.map(function (m) { return '<li>' + String(m) + '</li>'; }).join('') +
            '</ul>';
    }

    function tmBuildManualProductOptions() {
        var list = window.productList || [];
        var opts = '<option value="">请选择产品</option>';
        list.forEach(function (p) {
            var pid = p.productId || p.id;
            var name = p.productName || p.name || ('产品#' + pid);
            var sku = p.productSku || p.sku || '';
            var price = p.salePrice != null ? p.salePrice : (p.price != null ? p.price : 0);
            if (!pid) return;
            opts += '<option value="' + pid + '" data-price="' + price + '">' +
                name + (sku ? ' (' + sku + ')' : '') + '</option>';
        });
        return opts;
    }

    var TM_MANUAL_FIN_LABELS = {
        UNPAID: '未收款',
        PARTIAL_PAID: '部分收款',
        SETTLED: '已结清',
        BAD_DEBT: '坏账'
    };

    function tmManualFinLabel(code) {
        var c = String(code || 'UNPAID').trim().toUpperCase();
        return TM_MANUAL_FIN_LABELS[c] || c;
    }

    function tmRoundMoney(v) {
        return window.TM_OrderModal && window.TM_OrderModal.roundMoney
            ? window.TM_OrderModal.roundMoney(v)
            : Math.round((Number(v) || 0) * 100) / 100;
    }

    function tmGetManualOrderTotal() {
        var totalEl = document.getElementById('manual-pay-total');
        if (!totalEl) return 0;
        var txt = String(totalEl.textContent || '').replace(/[¥$,]/g, '').trim();
        return tmRoundMoney(parseFloat(txt) || 0);
    }

    function tmRefreshManualItemsLayout() {
        if (window.TM_OrderModal && window.TM_OrderModal.refreshItemsScroll) {
            window.TM_OrderModal.refreshItemsScroll('manual-order-modal');
        }
    }

    function tmSyncManualFinStatusUI() {
        var finSel = document.getElementById('manual-fin-status');
        var amountEl = document.getElementById('manual-receive-amount');
        var payBtn = document.getElementById('manual-confirm-receive-btn');
        var hintEl = document.getElementById('manual-fin-disabled-hint');
        var finVal = finSel ? finSel.value : 'UNPAID';
        var remaining = tmGetManualOrderTotal();
        var remEl = document.getElementById('manual-remaining-sum');
        if (remEl) remEl.textContent = '¥' + remaining.toFixed(2);
        if (amountEl) {
            if (finVal === 'UNPAID' || finVal === 'BAD_DEBT') {
                amountEl.value = '';
                amountEl.disabled = true;
                amountEl.readOnly = false;
                amountEl.placeholder = '';
            } else {
                amountEl.disabled = false;
                amountEl.readOnly = (finVal === 'SETTLED');
                amountEl.removeAttribute('disabled');
                if (finVal === 'SETTLED' && remaining > 0) {
                    amountEl.value = remaining.toFixed(2);
                } else if (finVal === 'PARTIAL_PAID' && remaining > 0) {
                    amountEl.placeholder = '请输入本次收款（最多 ¥' + remaining.toFixed(2) + '）';
                } else {
                    amountEl.placeholder = '';
                }
            }
        }
        var canPay = (finVal === 'PARTIAL_PAID' || finVal === 'SETTLED') && remaining > 0.001;
        var payAmount = amountEl && amountEl.value ? tmRoundMoney(amountEl.value) : 0;
        if (finVal === 'PARTIAL_PAID') canPay = canPay && payAmount > 0;
        if (finVal === 'SETTLED' && remaining > 0) canPay = true;
        var accSel = document.getElementById('manual-order-account');
        var virtualFin = window.TM_TenantOps && window.TM_TenantOps.isVirtualFinance(window.__tmOpsProfile);
        var hasAccounts = window.TM_TenantOps && window.TM_TenantOps.hasSelectableAccounts
            ? window.TM_TenantOps.hasSelectableAccounts(accSel)
            : false;
        var accId = accSel && accSel.value ? parseInt(accSel.value, 10) : null;
        var needsAccount = canPay && !virtualFin && hasAccounts && (!accId || isNaN(accId));
        if (payBtn) {
            payBtn.disabled = !canPay || needsAccount;
            payBtn.title = needsAccount ? '请先设置或选择收款账户' : (!canPay ? '请选择收款状态并填写金额' : '');
        }
        if (hintEl) {
            if (canPay && !needsAccount) {
                hintEl.textContent = virtualFin || !hasAccounts ? '保存时将记录收款（无账户则先挂账）' : '保存时将一并记账';
            } else if (needsAccount) {
                hintEl.textContent = '请先设置或选择收款账户';
            } else {
                hintEl.textContent = '选择「部分收款」或「已结清」后保存时将一并记账；无账户可先挂账';
            }
        }
    }

    function tmSyncManualOrderUI() {
        var statusSel = document.getElementById('manual-order-status');
        var finSel = document.getElementById('manual-fin-status');
        var whSel = document.getElementById('manual-order-warehouse');
        var logEl = document.getElementById('manual-badge-logistics');
        var finEl = document.getElementById('manual-badge-finance');
        var auxEl = document.getElementById('manual-aux-summary');
        var statusLabel = '待配货';
        if (statusSel && statusSel.selectedIndex >= 0) {
            statusLabel = statusSel.options[statusSel.selectedIndex].textContent || statusLabel;
        }
        var finVal = finSel ? finSel.value : 'UNPAID';
        if (logEl) {
            logEl.innerHTML = '<i class="ph ph-truck"></i> ' + statusLabel;
        }
        if (finEl) {
            finEl.innerHTML = '<i class="ph ph-currency-cny"></i> ' + tmManualFinLabel(finVal);
            finEl.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ' +
                (finVal === 'SETTLED' ? 'bg-emerald-50 text-emerald-700' :
                    finVal === 'PARTIAL_PAID' ? 'bg-sky-50 text-sky-700' :
                        finVal === 'BAD_DEBT' ? 'bg-slate-100 text-slate-600' :
                            'bg-amber-50 text-amber-700');
        }
        tmSyncManualFinStatusUI();
        if (auxEl) {
            var whSel = document.getElementById('manual-order-warehouse');
            var whLabel = window.TM_TenantOps
                ? window.TM_TenantOps.warehouseLabelFromSelect(whSel, null, window.__tmOpsProfile)
                : (whSel && whSel.selectedIndex >= 0 ? whSel.options[whSel.selectedIndex].textContent : '暂无仓库');
            var remEl = document.getElementById('manual-remaining-sum');
            var remText = remEl ? remEl.textContent.replace('¥', '') : '0.00';
            auxEl.textContent = whLabel + ' · ' + tmManualFinLabel(finVal) + ' · 剩 ' + remText;
        }
    }

    function tmBindManualOrderPanelEvents() {
        if (window._manualOrderPanelBound) return;
        window._manualOrderPanelBound = true;
        var statusSel = document.getElementById('manual-order-status');
        var finSel = document.getElementById('manual-fin-status');
        var whSel = document.getElementById('manual-order-warehouse');
        if (statusSel) statusSel.addEventListener('change', tmSyncManualOrderUI);
        if (finSel) finSel.addEventListener('change', tmSyncManualOrderUI);
        if (whSel) whSel.addEventListener('change', tmSyncManualOrderUI);
        var amountEl = document.getElementById('manual-receive-amount');
        if (amountEl && !amountEl.__tmManualAmtBound) {
            amountEl.__tmManualAmtBound = true;
            amountEl.addEventListener('input', function () {
                var finSel2 = document.getElementById('manual-fin-status');
                if (finSel2 && finSel2.value === 'SETTLED') {
                    var rem = tmGetManualOrderTotal();
                    var val = tmRoundMoney(amountEl.value);
                    if (rem > 0 && Math.abs(val - rem) > 0.009) {
                        finSel2.value = 'PARTIAL_PAID';
                        tmSyncManualOrderUI();
                    }
                }
            });
        }
    }

    function tmPopulateManualWarehouseSelect() {
        var sel = document.getElementById('manual-order-warehouse');
        if (!sel) return Promise.resolve();
        var whP = window.wrappedFetch('/api/v1/rd/products/warehouses', { method: 'GET' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                return (res && res.success && Array.isArray(res.data)) ? res.data : [];
            })
            .catch(function () { return []; });
        var prP = window.TM_TenantOps ? window.TM_TenantOps.fetchOpsProfile() : Promise.resolve(null);
        return Promise.all([whP, prP]).then(function (arr) {
            window.__tmOpsProfile = arr[1];
            if (window.TM_TenantOps) {
                sel.innerHTML = window.TM_TenantOps.buildWarehouseOptionsHtml(arr[0], arr[1], null);
            } else if ((arr[0] || []).length) {
                var html = '';
                (arr[0] || []).forEach(function (w, idx) {
                    var id = w.warehouseId != null ? w.warehouseId : w.id;
                    html += '<option value="' + id + '"' + (idx === 0 ? ' selected' : '') + '>' +
                        (w.name || ('仓库#' + id)) + '</option>';
                });
                sel.innerHTML = html;
            } else {
                sel.innerHTML = '<option value="">暂无仓库</option>';
            }
        });
    }

    function tmRecalcManualOrderTotal() {
        var tbody = document.getElementById('manual-order-tbody');
        if (!tbody) return;
        var sum = 0;
        tbody.querySelectorAll('tr').forEach(function (row) {
            var qty = parseFloat(row.querySelector('.manual-qty') && row.querySelector('.manual-qty').value) || 0;
            var price = parseFloat(row.querySelector('.manual-price') && row.querySelector('.manual-price').value) || 0;
            var sub = Math.round(qty * price * 100) / 100;
            var subEl = row.querySelector('.manual-row-total');
            if (subEl) subEl.textContent = '¥' + sub.toFixed(2);
            sum += sub;
        });
        sum = Math.round(sum * 100) / 100;
        var fmt = '¥' + sum.toFixed(2);
        ['manual-order-total', 'manual-pay-total', 'manual-remaining-sum', 'manual-grand-total'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = fmt;
        });
        tmSyncManualOrderUI();
        tmRefreshManualItemsLayout();
    }

    async function tmApplyManualOrderLastPrices() {
        var custSel = document.getElementById('manual-order-customer');
        if (!custSel || !/^\d+$/.test(custSel.value)) return;
        var custId = parseInt(custSel.value, 10);
        var tbody = document.getElementById('manual-order-tbody');
        if (!tbody) return;
        var productIds = [];
        var rowMeta = [];
        tbody.querySelectorAll('tr').forEach(function (row) {
            var sel = row.querySelector('.manual-product-select');
            var priceInp = row.querySelector('.manual-price');
            if (!sel || !priceInp || !/^\d+$/.test(sel.value)) return;
            var pid = parseInt(sel.value, 10);
            productIds.push(pid);
            rowMeta.push({ priceInp: priceInp, productId: pid, sel: sel });
        });
        if (!productIds.length) return;
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/orders/last-unit-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ custId: custId, productIds: productIds })
            });
            var data = await (window.handleApiResponse ? window.handleApiResponse(resp) : resp.json());
            var map = (data && data.data) ? data.data : (data || {});
            rowMeta.forEach(function (meta) {
                var key = String(meta.productId);
                var price = map[key] != null ? parseFloat(map[key]) : null;
                if (price != null && price > 0) {
                    meta.priceInp.value = price.toFixed(2);
                    meta.priceInp.title = '已按该客户最近一次拿货价填充';
                } else {
                    var opt = meta.sel.options[meta.sel.selectedIndex];
                    var p = opt && opt.getAttribute('data-price');
                    if (p != null && p !== '' && (!meta.priceInp.value || parseFloat(meta.priceInp.value) <= 0)) {
                        meta.priceInp.value = p;
                    }
                }
            });
            tmRecalcManualOrderTotal();
        } catch (e) {
            console.warn('[ManualOrder] 历史价查询失败', e);
        }
    }

    function tmBindManualOrderRow(row) {
        if (!row) return;
        var sel = row.querySelector('.manual-product-select');
        var priceInp = row.querySelector('.manual-price');
        var qtyInp = row.querySelector('.manual-qty');
        if (sel) {
            sel.addEventListener('change', function () {
                var opt = sel.options[sel.selectedIndex];
                var p = opt && opt.getAttribute('data-price');
                if (priceInp && p != null && p !== '') priceInp.value = p;
                tmRecalcManualOrderTotal();
                tmApplyManualOrderLastPrices();
            });
        }
        [priceInp, qtyInp].forEach(function (inp) {
            if (inp) inp.addEventListener('input', tmRecalcManualOrderTotal);
        });
        var del = row.querySelector('.manual-row-delete');
        if (del) {
            del.addEventListener('click', function () {
                row.remove();
                tmRecalcManualOrderTotal();
                tmRefreshManualItemsLayout();
            });
        }
    }

    function tmCreateManualOrderRow() {
        var tbody = document.getElementById('manual-order-tbody');
        if (!tbody) return null;
        var tr = document.createElement('tr');
        tr.className = 'order-item-row border-t border-slate-100';
        tr.innerHTML =
            '<td class="tm-col-product px-3 py-2"><select class="form-input form-input--compact font-bold text-slate-700 manual-product-select tm-order-product-select">' +
            tmBuildManualProductOptions() + '</select></td>' +
            '<td class="tm-col-qty px-3 py-2 text-center"><input type="number" min="1" step="1" value="1" class="manual-qty tm-order-qty-input text-center form-input form-input--compact py-1 font-bold" /></td>' +
            '<td class="tm-col-price px-3 py-2 text-center"><input type="number" min="0" step="0.01" value="0" class="manual-price tm-order-price-input text-center form-input form-input--compact py-1 font-mono font-bold" /></td>' +
            '<td class="tm-col-sub px-3 py-2 text-right font-mono font-bold manual-row-total whitespace-nowrap">¥0.00</td>' +
            '<td class="tm-col-action px-1 py-2 text-center"><button type="button" class="manual-row-delete text-slate-400 hover:text-red-500" title="删除行"><i class="ph ph-trash"></i></button></td>';
        tbody.appendChild(tr);
        tmBindManualOrderRow(tr);
        return tr;
    }

    function tmFillManualOrderCustomers() {
        var sel = document.getElementById('manual-order-customer');
        if (!sel) return;
        sel.innerHTML = '<option value="">请选择客户</option>';
        var map = typeof customerLookupById !== 'undefined' ? customerLookupById : {};
        Object.keys(map).forEach(function (cid) {
            var c = map[cid];
            if (!c || !c.name) return;
            var opt = document.createElement('option');
            opt.value = cid;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
    }

    window.TM_openManualOrderModal = async function () {
        if (typeof window.TM_openRapidOrder === 'function') {
            return window.TM_openRapidOrder({ title: '添加订单', source: 'manual' });
        }
        notify('极速开单模块未加载，请刷新后重试', 'error');
    };

    window.TM_closeManualOrderModal = function () {
        var modal = document.getElementById('manual-order-modal');
        if (modal && typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    };

    window.TM_addManualOrderRow = function () {
        tmCreateManualOrderRow();
        tmRecalcManualOrderTotal();
        tmRefreshManualItemsLayout();
    };

    window.TM_saveManualOrder = async function () {
        var errors = [];
        var custSel = document.getElementById('manual-order-customer');
        var statusSel = document.getElementById('manual-order-status');
        var dateEl = document.getElementById('manual-order-delivery-date');
        var custId = custSel && custSel.value ? parseInt(custSel.value, 10) : NaN;
        if (!custId || isNaN(custId)) errors.push('请选择客户');
        var items = [];
        var tbody = document.getElementById('manual-order-tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(function (row) {
                var sel = row.querySelector('.manual-product-select');
                var pid = sel && sel.value ? parseInt(sel.value, 10) : NaN;
                var qty = parseInt(row.querySelector('.manual-qty') && row.querySelector('.manual-qty').value, 10) || 0;
                var unitPrice = parseFloat(row.querySelector('.manual-price') && row.querySelector('.manual-price').value) || 0;
                if (!pid || isNaN(pid) || qty <= 0) return;
                var lineTotal = Math.round(unitPrice * qty * 100) / 100;
                items.push({
                    productId: pid,
                    quantity: qty,
                    unitPrice: unitPrice,
                    totalAmount: lineTotal,
                    itemStatus: 'D011001'
                });
            });
        }
        if (!items.length) errors.push('请至少添加一行有效商品');
        tmManualOrderShowErrors(errors);
        if (errors.length) return;

        var grand = items.reduce(function (s, it) { return s + (it.totalAmount || 0); }, 0);
        var accountSel = document.getElementById('manual-order-account');
        var finSel = document.getElementById('manual-fin-status');
        var whSel = document.getElementById('manual-order-warehouse');
        var accountRaw = accountSel && accountSel.value ? String(accountSel.value).trim() : '';
        var accountId = accountRaw ? parseInt(accountRaw, 10) : null;
        if (accountRaw && Number.isNaN(accountId)) {
            errors.push('请选择有效的收款账户');
            tmManualOrderShowErrors(errors);
            return;
        }
        var finStatus = finSel && finSel.value ? finSel.value : 'UNPAID';
        var needPay = finStatus === 'PARTIAL_PAID' || finStatus === 'SETTLED';
        var virtualFin = window.TM_TenantOps && window.TM_TenantOps.isVirtualFinance(window.__tmOpsProfile);
        var hasAccounts = window.TM_TenantOps && window.TM_TenantOps.hasSelectableAccounts
            ? window.TM_TenantOps.hasSelectableAccounts(accountSel)
            : false;
        if (needPay && !virtualFin && hasAccounts && !accountId) {
            errors.push('请选择收款账户');
            tmManualOrderShowErrors(errors);
            return;
        }
        var warehouseRaw = whSel && whSel.value ? String(whSel.value).trim() : '';
        var warehouseId = warehouseRaw ? parseInt(warehouseRaw, 10) : null;
        if (warehouseRaw && Number.isNaN(warehouseId)) {
            errors.push('请选择有效的发出仓库');
            tmManualOrderShowErrors(errors);
            return;
        }
        var orderPayload = {
            order: {
                custId: custId,
                totalAmount: grand,
                orderStatus: statusSel && statusSel.value ? statusSel.value : 'D010001',
                finStatus: finStatus,
                deliveryDate: dateEl && dateEl.value ? (dateEl.value + 'T12:00:00') : null
            },
            orderItems: items
        };
        if (accountId != null) {
            orderPayload.order.accountId = accountId;
        }
        if (warehouseId != null) {
            orderPayload.order.warehouseId = warehouseId;
        }

        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var response = await window.wrappedFetch('/api/v1/rd/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });
            var data = await window.handleApiResponse(response);
            if (!data) return;
            var saved = data.data || {};
            var orderId = saved.orderId || saved.order_id || saved.id;
            var receiveEl = document.getElementById('manual-receive-amount');
            var receiveAmt = receiveEl && receiveEl.value ? tmRoundMoney(receiveEl.value) : 0;
            var needPay = finStatus === 'PARTIAL_PAID' || finStatus === 'SETTLED';
            if (orderId && needPay && receiveAmt > 0) {
                var payBody = { amount: receiveAmt, bizTypeCode: 'SALES_INCOME' };
                if (accountId != null) payBody.accountId = accountId;
                try {
                    var payResp = await window.wrappedFetch('/api/v1/rd/orders/' + orderId + '/record-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payBody)
                    });
                    await window.handleApiResponse(payResp);
                } catch (payErr) {
                    notify('订单已创建，但收款记账失败: ' + (payErr.message || ''), 'error');
                    TM_closeManualOrderModal();
                    if (typeof window.loadInProgressOrders === 'function') {
                        window.loadInProgressOrders();
                    }
                    return;
                }
            }
            notify('订单创建成功', 'success');
            TM_closeManualOrderModal();
            if (typeof window.loadInProgressOrders === 'function') {
                window.loadInProgressOrders();
            }
            if (typeof window.TM_emitOrderDataChanged === 'function') {
                window.TM_emitOrderDataChanged({ custId: custId, orderId: orderId });
            }
            if (typeof window.loadDashboardOverviewStats === 'function') {
                window.loadDashboardOverviewStats();
            }
            if (orderId && window.TM_PrintTriggers && window.TM_PrintTriggers.offerPrintAfterCreate) {
                await window.TM_PrintTriggers.offerPrintAfterCreate(orderId, null, '订单已创建，是否立即打印？');
            }
        } catch (e) {
            notify(e.message || '创建订单失败', 'error');
        }
    };

    window.openManualOrderModal = window.TM_openManualOrderModal;
    window.closeManualOrderModal = window.TM_closeManualOrderModal;
    window.addOrderRow = window.TM_addManualOrderRow;
    window.saveManualOrder = window.TM_saveManualOrder;

    function boot() {
        patchAuditAndPending();
        if (window.TM_loadWorkbenchProfile) {
            window.TM_loadWorkbenchProfile().catch(function (err) {
                console.warn('[DashboardWorkbench] 工作台配置加载失败', err);
            });
        }
        if (document.getElementById('pending-orders-list')) {
            TM_PendingOrdersStore.refresh(true);
        }
        if (document.getElementById('inprogress-list')) {
            var loadCust = typeof window.loadCustomerList === 'function'
                ? window.loadCustomerList()
                : Promise.resolve();
            var loadProg = typeof window.loadInProgressOrders === 'function'
                ? window.loadInProgressOrders()
                : Promise.resolve();
            Promise.all([loadCust, loadProg]).catch(function (err) {
                console.warn('[DashboardWorkbench] 工作台列表初始化失败', err);
            });
        }
    }

    whenDashboardReady(boot);
})();
