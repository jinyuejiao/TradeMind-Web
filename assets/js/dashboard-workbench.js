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
                    var filtered = rows
                        .filter(function (r) { return r.status === 'SUCCESS' || r.status === 'EXTRACTING'; })
                        .sort(function (a, b) { return new Date(b.createTime || 0) - new Date(a.createTime || 0); })
                        .slice(0, 20);
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
                var statusLabel = record.status === 'SUCCESS' ? '已提取' : (isExtracting ? '提取中' : (record.status || '处理中'));
                var statusClass = record.status === 'SUCCESS' ? 'text-brand-600' : 'text-orange-500';
                var deleteBtnClass = 'tm-pending-delete' + (isExtracting ? ' opacity-35 pointer-events-none cursor-not-allowed' : '');
                var deleteTitle = isExtracting ? 'AI 识别中，暂不可删除' : '删除';

                card.innerHTML =
                    '<div class="flex-1 min-w-0" data-open-audit="1">' +
                    '<p class="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition-colors truncate">客户：' + escapeHtml(customerName) + '</p>' +
                    '<div class="flex items-center gap-2 mt-1 flex-wrap">' +
                    '<span class="text-[9px] text-slate-400 uppercase tracking-tighter">' + escapeHtml(recognitionTime) + '</span>' +
                    '<span class="w-1 h-1 bg-slate-200 rounded-full"></span>' +
                    '<span class="text-[9px] ' + statusClass + ' font-bold">' + statusLabel + '</span>' +
                    '</div></div>' +
                    '<div class="flex items-center gap-2 shrink-0">' +
                    '<div class="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-black text-[10px]">' + orderItems.length + '</div>' +
                    '<button type="button" class="' + deleteBtnClass + '" title="' + escapeHtml(deleteTitle) + '" aria-label="删除待确认单据" aria-disabled="' + (isExtracting ? 'true' : 'false') + '" data-delete-id="' + escapeHtml(id) + '">' +
                    '<i class="ph ph-trash text-base"></i></button></div>';

                card.onclick = function (e) {
                    if (e.target.closest('.tm-pending-delete')) return;
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

    /* ---------- 确认下单前自动建档 ---------- */
    async function quickSaveProduct(productName, sku, baseUnit) {
        var nm = (productName || '').trim();
        if (!nm) throw new Error('产品名称不能为空');
        var sk = (sku || '').trim() || ('SKU-' + Date.now().toString().slice(-8));
        var bu = (baseUnit || '').trim() || '件';
        var body = {
            product: {
                name: nm,
                sku: sk,
                baseUnit: bu,
                purchaseUnit: bu,
                salesUnit: bu,
                price: 0,
                stock: 0,
                tenantId: window.currentTenantId
            },
            unitConversions: [],
            warehouseStocks: []
        };
        var resp = await window.wrappedFetch('/api/v1/rd/products/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await (window.handleApiResponse ? window.handleApiResponse(resp) : resp.json());
        if (!data) throw new Error('保存产品无响应');
        var saved = data.data || data;
        var productId = saved.productId || saved.product_id || saved.id;
        if (!productId) throw new Error('保存产品未返回 ID');
        if (window.productList && Array.isArray(window.productList)) {
            window.productList.unshift({
                productId: Number(productId),
                name: nm,
                sku: sk
            });
        }
        return Number(productId);
    }

    async function saveCustomerInline(name, phone) {
        var registryRoot = document.getElementById('audit-customer-registry-root');
        var fromRegistry = (window.TmCustomerRegistry && registryRoot)
            ? window.TmCustomerRegistry.readPayloadWithMeta(registryRoot, { source: 'OTHER', custStatus: 'ACTIVE' })
            : null;
        var customerData = fromRegistry || {
            name: name,
            email: '',
            source: 'OTHER',
            custStatus: 'ACTIVE',
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
        return Number(custId);
    }

    async function ensureCustomerIdBeforeConfirm() {
        var customerSelect = document.getElementById('order-customer');
        if (!customerSelect) return null;
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

        var custId = await saveCustomerInline(name, phone || null);
        if (window.auditState && window.auditState.aiStructured) {
            if (!window.auditState.aiStructured.customer_data) {
                window.auditState.aiStructured.customer_data = {};
            }
            window.auditState.aiStructured.customer_data.matched_customer_id = custId;
            window.auditState.aiStructured.customer_data.matched_customer_name = name;
            window.auditState.aiStructured.new_customers_found = [];
            if (typeof window.persistAuditResult === 'function') await window.persistAuditResult();
        }
        var option = document.createElement('option');
        option.value = String(custId);
        option.textContent = name;
        option.setAttribute('data-name', name);
        customerSelect.appendChild(option);
        customerSelect.value = String(custId);
        return custId;
    }

    async function ensureProductIdsBeforeConfirm() {
        var rows = document.querySelectorAll('#order-items-body tr');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var sel = row.querySelector('.product-select');
            if (!sel) continue;
            var val = sel.value;
            if (/^\d+$/.test(val)) continue;

            var opt = sel.options[sel.selectedIndex];
            var pname = opt ? (opt.getAttribute('data-name') || opt.textContent || '').trim() : '';
            var idx = Number(sel.getAttribute('data-index'));
            var items = window.auditState && window.auditState.aiStructured && window.auditState.aiStructured.order_data
                ? window.auditState.aiStructured.order_data.items : [];
            var item = items[idx];
            if (item && item.product_name_raw && !pname) pname = item.product_name_raw;

            var baseUnit = '件';
            var sku = item && item.sku ? item.sku : '';
            var pid = await quickSaveProduct(pname, sku, baseUnit);
            var option = document.createElement('option');
            option.value = String(pid);
            option.textContent = pname;
            option.setAttribute('data-name', pname);
            sel.appendChild(option);
            sel.value = String(pid);
            if (item) {
                item.matched_product_id = pid;
                item.matched_product_name = pname;
            }
            if (typeof window.handleAuditProductSelectChange === 'function') {
                window.handleAuditProductSelectChange(sel);
            }
        }

        if (window.auditState && window.hasNewProducts && window.hasNewProducts(window.auditState.aiStructured)) {
            var np = window.auditState.aiStructured.new_products_found;
            if (Array.isArray(np) && np.length) {
                throw new Error('尚有 ' + np.length + ' 个新产品未保存，请先在「产品信息」标签中逐项保存');
            }
        }
    }

    /* ---------- 审核弹窗 / 列表 / 确认下单补丁 ---------- */
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

            items.forEach(function (item, index) {
                if (typeof window.normalizeAuditOrderItem === 'function') {
                    window.normalizeAuditOrderItem(item);
                }
                var displayMatchedName = (item.matched_product_name || '').trim();
                var productNameValue = (displayMatchedName || item.product_name_raw || '').trim();
                var matchedProductId = item.matched_product_id ? Number(item.matched_product_id) : 0;
                var selectOptions = (window.productList || []).map(function (product) {
                    var pid = window.getProductId(product);
                    var pname = window.getProductName(product);
                    var psku = window.getProductSku(product);
                    var pprice = product.price != null ? product.price : (product.salePrice != null ? product.salePrice : '');
                    if (!pid || !pname) return '';
                    return '<option value="' + pid + '" data-name="' + escapeHtml(pname) + '" data-sku="' + escapeHtml(psku) + '"' +
                        (pprice !== '' ? (' data-price="' + escapeHtml(String(pprice)) + '"') : '') + '>' +
                        escapeHtml(pname) + (psku ? ' (' + escapeHtml(psku) + ')' : '') + '</option>';
                }).join('');

                var row = document.createElement('tr');
                row.setAttribute('data-row-index', String(index));
                row.innerHTML =
                    '<td class="tm-audit-td tm-audit-td--product">' +
                    '<select class="form-input tm-audit-cell-input product-select" data-index="' + index + '" onchange="handleAuditProductSelectChange(this)">' +
                    '<option value="">-- 选择产品 --</option>' + selectOptions + '</select></td>' +
                    '<td class="tm-audit-td tm-audit-td--qty">' +
                    '<input type="number" value="' + (item.quantity || 1) + '" min="1" class="form-input tm-audit-cell-input audit-qty-input text-center" oninput="recalcAuditOrderTotals()"></td>' +
                    '<td class="tm-audit-td tm-audit-td--price">' +
                    '<input type="number" value="' + (item.price_at_time || 0) + '" step="0.01" min="0" class="form-input tm-audit-cell-input price-input text-center" oninput="recalcAuditOrderTotals()"></td>' +
                    '<td class="tm-audit-td tm-audit-td--sub text-right font-mono font-bold text-slate-900">' +
                    '<span class="audit-line-subtotal">' + (Number(item.total_amount || 0)).toFixed(2) + '</span></td>' +
                    '<td class="tm-audit-td tm-audit-td--action">' +
                    '<button type="button" class="tm-audit-row-delete" onclick="auditFormRemoveLine(this)" aria-label="删除行"><i class="ph ph-trash"></i></button></td>';

                orderItemsBody.appendChild(row);
                var select = row.querySelector('.product-select');
                if (select) {
                    if (matchedProductId && select.querySelector('option[value="' + matchedProductId + '"]')) {
                        select.value = String(matchedProductId);
                    } else if (productNameValue) {
                        var options = Array.from(select.options);
                        var byName = options.find(function (opt) {
                            return (opt.getAttribute('data-name') || '').trim() === productNameValue;
                        });
                        if (byName) {
                            select.value = byName.value;
                        } else {
                            var placeholder = document.createElement('option');
                            placeholder.value = 'matched-product-placeholder-' + index;
                            placeholder.textContent = productNameValue;
                            placeholder.setAttribute('data-name', productNameValue);
                            placeholder.selected = true;
                            select.insertBefore(placeholder, select.firstChild);
                        }
                    }
                    if (typeof window.handleAuditProductSelectChange === 'function') {
                        window.handleAuditProductSelectChange(select);
                    }
                }
            });

            var customerSelect = document.getElementById('order-customer');
            if (customerSelect && window.auditState && window.auditState.aiStructured) {
                var customerData = window.auditState.aiStructured.customer_data || {};
                var newCustomer = Array.isArray(window.auditState.aiStructured.new_customers_found)
                    ? window.auditState.aiStructured.new_customers_found[0] : null;
                if (customerData.matched_customer_name) {
                    var matchedId = customerData.matched_customer_id ? String(customerData.matched_customer_id) : '';
                    if (matchedId && customerSelect.querySelector('option[value="' + matchedId + '"]')) {
                        customerSelect.value = matchedId;
                    } else {
                        var ph = customerSelect.querySelector('option[value="matched-customer-placeholder"]');
                        if (!ph) {
                            ph = document.createElement('option');
                            ph.value = 'matched-customer-placeholder';
                            customerSelect.insertBefore(ph, customerSelect.firstChild);
                        }
                        ph.textContent = customerData.matched_customer_name;
                        ph.setAttribute('data-name', customerData.matched_customer_name);
                        customerSelect.value = 'matched-customer-placeholder';
                    }
                } else if (newCustomer && newCustomer.name) {
                    var ph2 = customerSelect.querySelector('option[value="new-customer-placeholder"]');
                    if (!ph2) {
                        ph2 = document.createElement('option');
                        ph2.value = 'new-customer-placeholder';
                        customerSelect.insertBefore(ph2, customerSelect.firstChild);
                    }
                    ph2.textContent = newCustomer.name;
                    ph2.setAttribute('data-name', newCustomer.name);
                    customerSelect.value = 'new-customer-placeholder';
                }
                if (typeof window.handleAuditCustomerSelectChange === 'function') {
                    window.handleAuditCustomerSelectChange(customerSelect);
                }
            }

            window.recalcAuditOrderTotals();
            fillMissingAuditPrices();
        };

        var origOpen = window.openAuditModal;
        window.openAuditModal = async function (recordId) {
            await origOpen(recordId);
            var dateEl = document.getElementById('order-delivery-date');
            if (dateEl && !dateEl.value && typeof window.getTodayDateInput === 'function') {
                dateEl.value = window.getTodayDateInput();
            }
            var custSelect = document.getElementById('order-customer');
            if (custSelect) {
                var prevOnChange = custSelect.onchange;
                custSelect.addEventListener('change', function () {
                    setTimeout(fillMissingAuditPrices, 100);
                });
            }
        };

        var origConfirm = window.confirmAuditOrder;
        window.confirmAuditOrder = async function () {
            try {
                await ensureProductIdsBeforeConfirm();
                await ensureCustomerIdBeforeConfirm();
            } catch (e) {
                notify(e.message || '自动建档失败', 'error');
                return;
            }
            return origConfirm();
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
        var finVal = finSel ? finSel.value : 'UNPAID';
        var remaining = tmGetManualOrderTotal();
        var remEl = document.getElementById('manual-remaining-sum');
        if (remEl) remEl.textContent = '¥' + remaining.toFixed(2);
        if (amountEl) {
            if (finVal === 'UNPAID' || finVal === 'BAD_DEBT') {
                amountEl.value = '';
                amountEl.disabled = true;
                amountEl.readOnly = true;
            } else {
                amountEl.disabled = false;
                amountEl.readOnly = false;
                amountEl.removeAttribute('disabled');
                if (finVal === 'SETTLED' && remaining > 0) {
                    amountEl.value = remaining.toFixed(2);
                } else if (finVal === 'PARTIAL_PAID' && (!amountEl.value || parseFloat(amountEl.value) <= 0) && remaining > 0) {
                    amountEl.placeholder = '最多 ¥' + remaining.toFixed(2);
                }
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
        var modal = document.getElementById('manual-order-modal');
        if (!modal) {
            notify('添加订单弹窗未加载', 'error');
            return;
        }
        tmManualOrderShowErrors([]);
        if (typeof window.loadCustomerList === 'function') await window.loadCustomerList();
        if (typeof window.loadProductList === 'function') await window.loadProductList();
        if (typeof window.loadOrderStatusDict === 'function') await window.loadOrderStatusDict();
        if (typeof window.loadBizAccounts === 'function') await window.loadBizAccounts();
        if (window.TM_TenantOps) await window.TM_TenantOps.fetchOpsProfile().then(function (p) { window.__tmOpsProfile = p; });
        tmBindManualOrderPanelEvents();
        if (typeof window.populateOrderStatusSelects === 'function') {
            window.populateOrderStatusSelects();
        } else if (typeof window.fillManualOrderStatusSelect === 'function') {
            window.fillManualOrderStatusSelect('D010001');
        }
        tmFillManualOrderCustomers();
        var acctSel = document.getElementById('manual-order-account');
        if (acctSel && typeof window.fillBizAccountSelect === 'function') {
            window.fillBizAccountSelect(acctSel, null);
        }
        var finSel = document.getElementById('manual-fin-status');
        if (finSel) finSel.value = 'UNPAID';
        await tmPopulateManualWarehouseSelect();
        var auxDetails = document.getElementById('manual-aux-details');
        if (auxDetails) auxDetails.open = false;
        if (window.TM_OrderModal && window.TM_OrderModal.setAuxOpen) {
            window.TM_OrderModal.setAuxOpen('manual-aux-details', false);
        }
        var receiveEl = document.getElementById('manual-receive-amount');
        if (receiveEl) receiveEl.value = '';
        var custSel = document.getElementById('manual-order-customer');
        if (custSel && !custSel.__tmManualCustBound) {
            custSel.__tmManualCustBound = true;
            custSel.addEventListener('change', function () {
                setTimeout(tmApplyManualOrderLastPrices, 80);
            });
        }
        var tbody = document.getElementById('manual-order-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            tmCreateManualOrderRow();
        }
        var dateEl = document.getElementById('manual-order-delivery-date');
        if (dateEl && typeof window.getTodayDateInput === 'function') {
            dateEl.value = window.getTodayDateInput();
        }
        if (typeof window.TM_applyDialogShell === 'function') {
            window.TM_applyDialogShell(modal);
        }
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        tmRecalcManualOrderTotal();
        tmSyncManualOrderUI();
        tmRefreshManualItemsLayout();
    };

    window.TM_closeManualOrderModal = function () {
        var modal = document.getElementById('manual-order-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
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
        console.log('[DashboardWorkbench] 工作台增强已加载');
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
