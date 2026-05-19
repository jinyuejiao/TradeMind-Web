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
                list.innerHTML =
                    '<div class="flex items-center justify-center h-full text-slate-400 text-sm">' +
                    '<div class="text-center"><i class="ph ph-spinner ph-spin text-xl mb-2"></i><p>加载待确认单据中...</p></div></div>';
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
                        list.innerHTML =
                            '<div class="flex items-center justify-center h-full text-slate-400 text-sm">' +
                            '<div class="text-center"><i class="ph ph-x-circle text-xl mb-2"></i><p>数据加载失败</p></div></div>';
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
                    if (countEl) countEl.textContent = String(filtered.length);
                })
                .catch(function (err) {
                    list.classList.remove('tm-pending-list-refreshing');
                    console.error('[PendingStore] 加载失败', err);
                    if (!self.initialLoaded) {
                        list.innerHTML =
                            '<div class="flex items-center justify-center h-full text-slate-400 text-sm">' +
                            '<div class="text-center"><i class="ph ph-x-circle text-xl mb-2"></i><p>加载失败，请刷新</p></div></div>';
                    }
                });
        },

        renderList: function (list, records) {
            if (!records.length) {
                list.innerHTML =
                    '<div class="flex items-center justify-center h-full text-slate-400 text-sm">' +
                    '<div class="text-center"><i class="ph ph-check-circle text-xl mb-2"></i><p>暂无待确认单据</p></div></div>';
                return;
            }

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
                var statusLabel = record.status === 'SUCCESS' ? '已提取' : '提取中';
                var statusClass = record.status === 'SUCCESS' ? 'text-brand-600' : 'text-orange-500';

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
                    '<button type="button" class="tm-pending-delete" title="删除" aria-label="删除待确认单据" data-delete-id="' + escapeHtml(id) + '">' +
                    '<i class="ph ph-trash text-base"></i></button></div>';

                card.onclick = function (e) {
                    if (e.target.closest('.tm-pending-delete')) return;
                    if (typeof window.openAuditModal === 'function') {
                        window.openAuditModal(record.id);
                    }
                };
                var delBtn = card.querySelector('.tm-pending-delete');
                if (delBtn) {
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
        var msg = rec && rec.status === 'EXTRACTING'
            ? 'AI 仍在解析该单据，确定要删除吗？'
            : '确认删除该待确认单据？删除后不可恢复。';
        if (!confirm(msg)) return;
        try {
            var resp = await window.wrappedFetch('/api/v1/ai/records/' + recordId, { method: 'DELETE' });
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                throw new Error(err.message || '删除失败');
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
        var totalEl = document.getElementById('order-total-amount');
        if (totalEl) totalEl.textContent = total.toFixed(2);
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
        var customerData = {
            name: name,
            phone: phone,
            email: (document.getElementById('customer-email') && document.getElementById('customer-email').value) || '',
            source: (document.getElementById('customer-source') && document.getElementById('customer-source').value) || 'OTHER',
            custStatus: (document.getElementById('customer-status') && document.getElementById('customer-status').value) || 'ACTIVE',
            region: (document.getElementById('customer-region') && document.getElementById('customer-region').value) || '',
            address: (document.getElementById('customer-address') && document.getElementById('customer-address').value) || '',
            summary: (document.getElementById('customer-summary') && document.getElementById('customer-summary').value) || ''
        };
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

        var nameEl = document.getElementById('customer-name');
        var phoneEl = document.getElementById('customer-phone');
        var name = nameEl ? nameEl.value.trim() : '';
        var phone = phoneEl ? phoneEl.value.trim() : '';
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
        if (!phone) phone = '00000000000';

        var custId = await saveCustomerInline(name, phone);
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
                var first = np[0];
                var nameInp = document.getElementById('product-name');
                var skuInp = document.getElementById('product-sku');
                var baseInp = document.getElementById('product-base-unit');
                var nm = nameInp && nameInp.value ? nameInp.value.trim() : (first.name || '');
                var sk = skuInp && skuInp.value ? skuInp.value.trim() : (first.sku || '');
                var bu = baseInp && baseInp.value ? baseInp.value.trim() : '件';
                await quickSaveProduct(nm, sk, bu);
                window.auditState.aiStructured.new_products_found = [];
                if (typeof window.persistAuditResult === 'function') await window.persistAuditResult();
                var tabBtn = document.getElementById('tab-product');
                if (tabBtn) tabBtn.style.display = 'none';
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
                var displayMatchedName = (item.matched_product_name || '').trim();
                var productNameValue = (displayMatchedName || item.product_name_raw || '').trim();
                var matchedProductId = item.matched_product_id ? Number(item.matched_product_id) : 0;
                var selectOptions = (window.productList || []).map(function (product) {
                    var pid = window.getProductId(product);
                    var pname = window.getProductName(product);
                    var psku = window.getProductSku(product);
                    if (!pid || !pname) return '';
                    return '<option value="' + pid + '" data-name="' + escapeHtml(pname) + '" data-sku="' + escapeHtml(psku) + '">' +
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

    function boot() {
        patchAuditAndPending();
        console.log('[DashboardWorkbench] 工作台增强已加载');
        if (document.getElementById('pending-orders-list')) {
            TM_PendingOrdersStore.refresh(true);
        }
    }

    whenDashboardReady(boot);
})();
