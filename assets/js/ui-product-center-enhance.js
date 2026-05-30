/**
 * 产品中心增强：对齐 UI 工程、校验、分仓库存、单位换算、调拨与滚动修复
 */
(function () {
    'use strict';
    var PM = window.ProductModule;
    if (!PM) {
        console.warn('[ProductEnhance] ProductModule 未加载');
        return;
    }

    PM.warehouseStockDraft = {};
    PM.sourceWarehouseProductStocks = [];
    PM.auditSaveCallback = null;
    PM._bodyScrollLock = 0;

    PM.isAuditContextActive = function () {
        if (window.auditState && window.auditState.currentRecordId) return true;
        var modal = document.getElementById('audit-modal');
        return !!(modal && !modal.classList.contains('hidden'));
    };

    PM.isAuditProductFormActive = function () {
        var pane = document.getElementById('confirm-product-tab');
        var root = document.getElementById('audit-product-registry-root');
        return !!(pane && !pane.classList.contains('hidden') && root && root.dataset.tmProductMounted === '1');
    };

    PM.getAuditProductRoot = function () {
        var root = document.getElementById('audit-product-registry-root');
        if (root && root.dataset.tmProductMounted === '1' && PM.isAuditContextActive()) {
            return root;
        }
        return null;
    };

    PM.el = function () {
        var ids = Array.prototype.slice.call(arguments);
        var productModal = PM.getProductDetailModal();
        if (productModal && !productModal.classList.contains('hidden')) {
            for (var p = 0; p < ids.length; p++) {
                if (!ids[p]) continue;
                var inModal = productModal.querySelector('#' + ids[p]);
                if (inModal) return inModal;
            }
        }
        var auditRoot = PM.getAuditProductRoot();
        if (auditRoot) {
            for (var i = 0; i < ids.length; i++) {
                if (!ids[i]) continue;
                var scoped = auditRoot.querySelector('#' + ids[i]);
                if (scoped) return scoped;
            }
        }
        for (var j = 0; j < ids.length; j++) {
            var id = ids[j];
            if (!id) continue;
            if (id.indexOf('detail-') === 0) continue;
            var node = document.getElementById(id);
            if (node) return node;
        }
        return null;
    };

    PM.formErrorBoxId = function () {
        return PM.isAuditProductFormActive() ? 'audit-product-form-errors' : 'product-form-errors';
    };

    PM.lockBodyScroll = function (on) {
        PM._bodyScrollLock += on ? 1 : -1;
        if (PM._bodyScrollLock < 0) PM._bodyScrollLock = 0;
        try {
            if ((window.__TM_shellOverlayDepth || 0) === 0) {
                document.body.style.overflow = PM._bodyScrollLock > 0 ? 'hidden' : '';
            }
        } catch (e) { /* ignore */ }
        /* 底栏显隐由 TM_openUnifiedModal / TM_closeUnifiedModal 引用计数统一管理，此处不再重复调用 */
    };

    PM.showFormErrors = function (boxId, messages) {
        var box = document.getElementById(boxId);
        if (!box) return;
        if (!messages || !messages.length) {
            box.classList.add('hidden');
            box.innerHTML = '';
            return;
        }
        box.classList.remove('hidden');
        box.innerHTML = '<ul class="list-disc pl-4 space-y-0.5">' +
            messages.map(function (m) { return '<li>' + PM.escHtmlText(m) + '</li>'; }).join('') +
            '</ul>';
        try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
    };

    PM.getBaseUnitLabel = function () {
        var inp = PM.el('detail-product-base-unit', 'audit-detail-product-base-unit', 'product-base-unit-input');
        var v = inp ? String(inp.value || '').trim() : '';
        return v || '件';
    };

    PM.getProductDetailModal = function () {
        return document.getElementById('product-detail-modal');
    };

    PM.getProductDetailAdvancedDrawer = function () {
        var auditRoot = PM.getAuditProductRoot();
        if (auditRoot) {
            var auditDrawer = auditRoot.querySelector('#product-advanced-drawer');
            if (auditDrawer) return auditDrawer;
        }
        var root = PM.getProductDetailModal();
        if (root) return root.querySelector('#product-advanced-drawer');
        return document.getElementById('product-advanced-drawer') || document.getElementById('audit-product-advanced-drawer');
    };

    PM.getProductDetailAdvancedToggle = function () {
        var auditRoot = PM.getAuditProductRoot();
        if (auditRoot) {
            var auditToggle = auditRoot.querySelector('.tm-product-advanced-toggle');
            if (auditToggle) return auditToggle;
        }
        var root = PM.getProductDetailModal();
        if (root) return root.querySelector('.tm-product-advanced-toggle');
        return document.querySelector('#confirm-product-tab .tm-product-advanced-toggle');
    };

    PM.getProductDetailAdvancedIcon = function () {
        var auditRoot = PM.getAuditProductRoot();
        if (auditRoot) {
            var auditIcon = auditRoot.querySelector('#product-detail-advanced-icon');
            if (auditIcon) return auditIcon;
        }
        var root = PM.getProductDetailModal();
        if (root) return root.querySelector('#product-detail-advanced-icon');
        return document.getElementById('product-detail-advanced-icon') || document.getElementById('audit-product-detail-advanced-icon');
    };

    PM.validateProductForm = function () {
        var errors = [];
        var nameEl = PM.el('detail-product-name', 'product-name-input');
        var priceEl = PM.el('detail-product-price', 'product-price-input');
        var baseEl = PM.el('detail-product-base-unit', 'product-base-unit-input');
        var stockEl = PM.el('detail-product-stock', 'product-stock-input');
        var name = nameEl ? nameEl.value.trim() : '';
        var priceRaw = priceEl ? priceEl.value : '';
        var base = baseEl ? baseEl.value.trim() : '';
        var stockRaw = stockEl ? stockEl.value : '';
        if (!name) errors.push('请填写产品名称');
        if (priceRaw === '' || priceRaw == null) {
            errors.push('请填写预设销售价');
        } else {
            var priceNum = parseFloat(priceRaw);
            if (isNaN(priceNum) || priceNum < 0) errors.push('预设销售价须为不小于 0 的数字');
        }
        if (!base) errors.push('请填写基本单位');
        if (stockRaw !== '' && stockRaw != null) {
            var stockNum = parseInt(stockRaw, 10);
            if (isNaN(stockNum) || stockNum < 0) errors.push('当前库存总量须为不小于 0 的整数');
        }
        PM.showFormErrors(PM.formErrorBoxId(), errors);
        if (errors.length && nameEl && !name) nameEl.focus();
        else if (errors.length && priceEl && (priceRaw === '' || isNaN(parseFloat(priceRaw)))) priceEl.focus();
        else if (errors.length && baseEl && !base) baseEl.focus();
        else if (errors.length && stockEl && stockRaw !== '' && isNaN(parseInt(stockRaw, 10))) stockEl.focus();
        return errors.length === 0;
    };

    PM.collapseAdvancedDrawer = function () {
        var drawer = PM.getProductDetailAdvancedDrawer();
        var icon = PM.getProductDetailAdvancedIcon();
        var btn = PM.getProductDetailAdvancedToggle();
        if (!drawer) return;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (icon) {
            icon.classList.add('ph-caret-down');
            icon.classList.remove('ph-caret-up');
        }
    };

    PM.resolveUnitConversionsForSave = function () {
        var valid = PM.collectValidConversionsFromDraft();
        var base = PM.getBaseUnitLabel();
        return valid.filter(function (c) {
            return c.unitName && c.unitName !== base;
        });
    };

    PM.buildProductSaveBodyWithUnits = function (validUnitConv) {
        if (!PM.validateProductForm()) {
            return { error: '__validation__', body: null };
        }
        var conv = validUnitConv && validUnitConv.length ? validUnitConv : PM.resolveUnitConversionsForSave();
        var nameInput = PM.el('detail-product-name', 'product-name-input');
        var skuInput = PM.el('detail-product-sku-input', 'product-sku-input');
        var priceInput = PM.el('detail-product-price', 'product-price-input');
        var categorySelect = PM.el('detail-product-category', 'product-category-select');
        var supplierSelect = PM.el('detail-product-supplier', 'product-supplier-select');
        var purchaseUnitSelect = PM.el('detail-product-purchase-unit', 'product-purchase-unit-select');
        var salesUnitSelect = PM.el('detail-product-sales-unit', 'product-sales-unit-select');
        var baseUnitInput = PM.el('detail-product-base-unit', 'product-base-unit-input');
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        var warningStockInput = PM.el('detail-product-warning-stock', 'product-warning-stock-input');
        var descTextarea = PM.el('detail-product-description', 'product-desc-textarea');

        var nm = nameInput ? nameInput.value.trim() : '';
        var baseUnitStr = baseUnitInput ? baseUnitInput.value.trim() : '';
        var sk = skuInput ? skuInput.value.trim() : '';
        if (!sk) {
            sk = 'SKU-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            if (skuInput) skuInput.value = sk;
        }

        var unitPayload = conv.map(function (c) {
            return { unitName: c.unitName, ratio: c.ratio, isDefault: false };
        });

        var catRaw = categorySelect && categorySelect.value ? parseInt(categorySelect.value, 10) : null;
        var supRaw = supplierSelect && supplierSelect.value ? parseInt(supplierSelect.value, 10) : null;
        var cp = PM.currentProduct || {};
        var purchaseUnit = purchaseUnitSelect && purchaseUnitSelect.value ? purchaseUnitSelect.value : baseUnitStr;
        var salesUnit = salesUnitSelect && salesUnitSelect.value ? salesUnitSelect.value : baseUnitStr;
        if (!purchaseUnit) purchaseUnit = baseUnitStr;
        if (!salesUnit) salesUnit = baseUnitStr;

        var stockVal = stockInput && stockInput.value !== '' ? parseInt(stockInput.value, 10) : 0;
        if (isNaN(stockVal)) stockVal = 0;

        var productPayload = {
            productId: cp.id || null,
            name: nm,
            sku: sk,
            categoryId: catRaw != null && !isNaN(catRaw) && catRaw > 0 ? catRaw : null,
            supplierId: supRaw != null && !isNaN(supRaw) ? supRaw : null,
            price: priceInput && priceInput.value !== '' ? parseFloat(priceInput.value) : 0,
            stock: stockVal,
            warningStock: warningStockInput && warningStockInput.value !== '' ? parseInt(warningStockInput.value, 10) : null,
            description: descTextarea ? descTextarea.value : '',
            baseUnit: baseUnitStr || null,
            purchaseUnit: purchaseUnit,
            salesUnit: salesUnit,
            region: cp.region != null ? cp.region : null,
            salesVolume: cp.salesVolume != null ? cp.salesVolume : null,
            tenantId: window.currentTenantId
        };

        var whStocks = PM.readWarehouseStockFromContainer();
        return {
            error: null,
            body: {
                product: productPayload,
                unitConversions: unitPayload,
                warehouseStocks: whStocks
            }
        };
    };

    PM.readWarehouseStockFromContainer = function () {
        var container = PM.el('detail-product-warehouse-stock');
        if (!container) return [];
        var rows = [];
        container.querySelectorAll('.detail-warehouse-stock-input').forEach(function (inp) {
            var wid = inp.getAttribute('data-warehouse-id');
            if (!wid) return;
            var q = parseInt(inp.value, 10);
            rows.push({
                warehouseId: parseInt(wid, 10),
                quantity: isNaN(q) ? 0 : Math.max(0, q)
            });
        });
        return rows;
    };

    PM.renderWarehouseStockSummary = function (items) {
        var el = PM.el('detail-product-warehouse-stock');
        if (!el) return;
        var base = PM.getBaseUnitLabel();
        var list = items || [];
        if (!list.length) {
            el.innerHTML = '<p class="text-[11px] text-slate-400 py-2">暂无仓库，请先在仓库管理中新增</p>';
            return;
        }
        el.innerHTML = list.map(function (w) {
            var name = PM.escHtmlText(w.warehouseName || w.name || '仓库');
            var wid = w.warehouseId != null ? w.warehouseId : w.id;
            var v = w.quantity != null ? w.quantity : 0;
            return '<div class="warehouse-stock-row flex flex-wrap items-center gap-2 justify-between text-xs border-b border-slate-100/80 pb-2 last:border-0 last:pb-0">' +
                '<span class="font-bold text-slate-700">' + name + '</span>' +
                '<div class="flex items-center gap-2">' +
                '<input type="number" min="0" step="1" class="form-input font-mono text-right w-[6.5rem] py-1.5 text-xs detail-warehouse-stock-input" data-warehouse-id="' + PM.escHtmlAttr(String(wid)) + '" value="' + PM.escHtmlAttr(String(v)) + '" autocomplete="off">' +
                '<span class="text-[10px] font-mono text-slate-500 whitespace-nowrap warehouse-stock-preview">' + PM.escHtmlText(base) + '</span>' +
                '</div></div>';
        }).join('');
        el.querySelectorAll('.warehouse-stock-row').forEach(function (row) {
            var inp = row.querySelector('.detail-warehouse-stock-input');
            var preview = row.querySelector('.warehouse-stock-preview');
            if (inp && preview) {
                inp.addEventListener('input', function () {
                    preview.textContent = PM.getBaseUnitLabel();
                });
            }
        });
    };

    PM.loadProductWarehouseStocks = async function (productId) {
        if (!productId) {
            await PM.loadWarehouses();
            var empty = (PM.warehouses || []).map(function (w) {
                return { warehouseId: w.id, warehouseName: w.name, quantity: 0 };
            });
            PM.renderWarehouseStockSummary(empty);
            return;
        }
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/' + productId + '/warehouse-stocks', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var list = data && data.data ? data.data : [];
            PM.warehouseStockDraft = list;
            PM.renderWarehouseStockSummary(list);
        } catch (e) {
            console.warn('[ProductEnhance] loadProductWarehouseStocks', e);
            PM.renderWarehouseStockSummary([]);
        }
    };

    PM.queryUnitModalRoots = function () {
        var m = document.getElementById('product-unit-modal');
        return m ? [m] : [];
    };

    PM.getUnitRowsContainer = function () {
        var modal = document.getElementById('product-unit-modal');
        return modal ? modal.querySelector('#unit-conversion-rows') : null;
    };

    PM.getActiveUnitRowsContainer = function () {
        var modal = document.getElementById('product-unit-modal');
        if (!modal || modal.classList.contains('hidden')) return null;
        return modal.querySelector('#unit-conversion-rows');
    };

    PM.setUnitModalRowsHtml = function (html) {
        var c = PM.getActiveUnitRowsContainer() || PM.getUnitRowsContainer();
        if (c) c.innerHTML = html;
    };

    PM.readUnitModalInputsIntoDraft = function () {
        var container = PM.getActiveUnitRowsContainer() || PM.getUnitRowsContainer();
        if (!container) return;
        var rowEls = container.querySelectorAll('.unit-conversion-row');
        var next = [];
        rowEls.forEach(function (row) {
            var nu = row.querySelector('.uc-unit-name');
            var nr = row.querySelector('.uc-ratio');
            next.push({
                unitName: nu ? nu.value : '',
                ratio: nr ? nr.value : ''
            });
        });
        if (next.length) {
            PM.unitConversionDraft = PM.normalizeUnitDraft(next);
        }
    };

    PM.rebuildPurchaseSalesUnitSelects = function (selectedPurchase, selectedSales) {
        var pu = PM.el('detail-product-purchase-unit', 'product-purchase-unit-select');
        var su = PM.el('detail-product-sales-unit', 'product-sales-unit-select');
        if (!pu || !su) return;

        var base = PM.getBaseUnitLabel();
        var conv = PM.collectValidConversionsFromDraft();
        var opts = [{ value: base, label: base + '（基本单位）' }];
        conv.forEach(function (c) {
            if (c.unitName === base) return;
            opts.push({
                value: c.unitName,
                label: c.unitName + '(1' + c.unitName + '=' + c.ratio + base + ')'
            });
        });

        function fillSelect(sel, selVal) {
            sel.innerHTML = opts.map(function (o) {
                return '<option value="' + PM.escHtmlAttr(o.value) + '">' + PM.escHtmlText(o.label) + '</option>';
            }).join('');
            if (selVal) {
                var has = Array.prototype.some.call(sel.options, function (op) { return op.value === selVal; });
                if (has) sel.value = selVal;
            }
        }

        fillSelect(pu, selectedPurchase);
        fillSelect(su, selectedSales);
        if (!pu.value && opts.length) pu.selectedIndex = 0;
        if (!su.value && opts.length) su.selectedIndex = 0;
    };

    PM.saveUnitConversionModal = async function () {
        var notify = function (msg, type) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(msg, type);
            } else {
                alert(msg);
            }
        };

        PM.readUnitModalInputsIntoDraft();
        var draft = PM.normalizeUnitDraft(PM.unitConversionDraft);
        var valid = [];
        var msgs = [];
        for (var i = 0; i < draft.length; i++) {
            var u = (draft[i].unitName || '').trim();
            var ratioNum = parseFloat(draft[i].ratio);
            var emptyPair = !u && (draft[i].ratio === '' || draft[i].ratio == null);
            if (emptyPair) continue;
            if (!u || !ratioNum || ratioNum <= 0 || isNaN(ratioNum)) {
                msgs.push('第 ' + (i + 1) + ' 行：请填写完整的包装单位与折合基本数量（大于 0）');
                continue;
            }
            valid.push({ unitName: u, ratio: ratioNum });
        }
        PM.showFormErrors('unit-form-errors', msgs);
        if (msgs.length) return;

        PM.unitConversionDraft = PM.normalizeUnitDraft(valid.length ? valid : []);
        PM.rebuildPurchaseSalesUnitSelects(
            PM.el('detail-product-purchase-unit', 'product-purchase-unit-select') && PM.el('detail-product-purchase-unit', 'product-purchase-unit-select').value,
            PM.el('detail-product-sales-unit', 'product-sales-unit-select') && PM.el('detail-product-sales-unit', 'product-sales-unit-select').value
        );

        var productId = PM.currentProduct && PM.currentProduct.id;
        if (!productId) {
            PM.closeUnitModal();
            notify('单位换算已保存到当前编辑（提交产品时将一并保存）', 'success');
            return;
        }

        if (!PM.validateProductForm()) {
            notify('请先完善产品名称与基本单位', 'error');
            return;
        }

        var built = PM.buildProductSaveBodyWithUnits(valid.length ? valid : PM.resolveUnitConversionsForSave());
        if (built.error) {
            if (built.error !== '__validation__') notify(built.error, 'error');
            return;
        }

        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var response = await window.wrappedFetch('/api/v1/rd/products/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(built.body)
            });
            var data = await window.handleApiResponse(response);
            if (!data) return;
            PM.unitConversionDraft = PM.normalizeUnitDraft(valid);
            PM.closeUnitModal();
            notify('单位换算已保存', 'success');
            await PM.loadProducts();
        } catch (error) {
            notify('保存单位换算失败: ' + (error.message || String(error)), 'error');
        }
    };

    PM.openUnitModal = function () {
        PM.unitConversionDraft = PM.normalizeUnitDraft(PM.unitConversionDraft);
        PM.showFormErrors('unit-form-errors', []);
        var modal = document.getElementById('product-unit-modal');
        if (modal) {
            modal.classList.remove('hidden');
            PM.lockBodyScroll(true);
        }
        PM.renderUnitModalRows();
    };

    PM.closeUnitModal = function () {
        var modal = document.getElementById('product-unit-modal');
        if (modal) modal.classList.add('hidden');
        PM.lockBodyScroll(false);
    };

    PM.toggleAdvanced = function () {
        var drawer = PM.getProductDetailAdvancedDrawer();
        var icon = PM.getProductDetailAdvancedIcon();
        var btn = PM.getProductDetailAdvancedToggle();
        if (!drawer) return;
        var open = drawer.classList.toggle('open');
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (icon) {
            icon.classList.toggle('ph-caret-down', !open);
            icon.classList.toggle('ph-caret-up', open);
        }
        if (open) {
            var section = drawer.closest('.tm-product-edit-section--advanced');
            if (section) {
                try { section.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
            }
        }
    };

    PM.populateCategorySelect = function (selectedCategoryId) {
        var select = PM.el('detail-product-category', 'product-category-select');
        if (!select) return;
        select.innerHTML = '<option value="">未分类（可选）</option>';
        (PM.categories || []).forEach(function (cat) {
            var option = document.createElement('option');
            option.value = cat.categoryId;
            option.textContent = cat.name;
            if (selectedCategoryId === cat.categoryId) option.selected = true;
            select.appendChild(option);
        });
    };

    PM.populateSupplierSelect = function (selectedSupplierId) {
        var select = PM.el('detail-product-supplier', 'product-supplier-select');
        if (!select) return;
        select.innerHTML = '<option value="">请选择供应商</option>';
        (PM.suppliers || []).forEach(function (s) {
            var sid = s.supplierId != null ? s.supplierId : s.id;
            var name = s.supplierName || s.name;
            if (sid == null) return;
            var option = document.createElement('option');
            option.value = sid;
            option.textContent = name;
            if (selectedSupplierId != null && String(selectedSupplierId) === String(sid)) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    };

    PM.populateProductForm = function (product) {
        var nameInput = PM.el('detail-product-name', 'product-name-input');
        var skuInput = PM.el('detail-product-sku-input', 'product-sku-input');
        var priceInput = PM.el('detail-product-price', 'product-price-input');
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        var baseUnitInput = PM.el('detail-product-base-unit', 'product-base-unit-input');
        var warningStockInput = PM.el('detail-product-warning-stock', 'product-warning-stock-input');
        var descTextarea = PM.el('detail-product-description', 'product-desc-textarea');

        if (nameInput) nameInput.value = product.name || '';
        if (skuInput) skuInput.value = product.sku || '';
        if (priceInput) priceInput.value = product.price != null ? product.price : '';
        if (stockInput) stockInput.value = product.stock != null ? product.stock : '';
        if (baseUnitInput) baseUnitInput.value = product.baseUnit || '';
        if (warningStockInput) warningStockInput.value = product.warningStock != null ? product.warningStock : '';
        if (descTextarea) descTextarea.value = product.description || '';

        PM.rebuildPurchaseSalesUnitSelects(product.purchaseUnit, product.salesUnit);
        PM.showFormErrors('product-form-errors', []);
    };

    var _openProductDetail = PM.openProductDetail;
    PM.openProductDetail = async function (productId) {
        await _openProductDetail.call(PM, productId);
        PM.collapseAdvancedDrawer();
        var hint = PM.el('detail-sku-hint', 'detail-sku');
        var sku = PM.currentProduct && PM.currentProduct.sku;
        if (hint) hint.textContent = sku ? ('SKU: ' + sku) : '填写必填项即可保存';
        await PM.loadProductWarehouseStocks(productId);
        if (typeof window.TM_openUnifiedModal !== 'function') {
            PM.lockBodyScroll(true);
        }
    };

    var _openCreate = PM.openCreateProductModal;
    PM.openCreateProductModal = async function (prefill) {
        await _openCreate.call(PM);
        PM.populateProductForm({
            name: '',
            sku: '',
            price: '',
            stock: '',
            baseUnit: '',
            warningStock: '',
            description: '',
            purchaseUnit: null,
            salesUnit: null
        });
        PM.unitConversionDraft = [{ unitName: '', ratio: '' }];
        PM.populateCategorySelect(null);
        PM.populateSupplierSelect(null);
        if (prefill && typeof prefill === 'object') {
            PM.populateProductForm({
                name: prefill.name || '',
                sku: prefill.sku || '',
                price: prefill.price != null ? prefill.price : (prefill.salePrice != null ? prefill.salePrice : ''),
                stock: prefill.stock != null ? prefill.stock : (prefill.stockQuantity != null ? prefill.stockQuantity : ''),
                baseUnit: prefill.baseUnit || '',
                warningStock: prefill.warningStock != null ? prefill.warningStock : '',
                description: prefill.description || '',
                purchaseUnit: prefill.purchaseUnit || null,
                salesUnit: prefill.salesUnit || null
            });
            if (prefill.categoryId != null) PM.populateCategorySelect(prefill.categoryId);
            if (prefill.supplierId != null) PM.populateSupplierSelect(prefill.supplierId);
            if (Array.isArray(prefill.unitConversions) && prefill.unitConversions.length) {
                PM.syncDraftFromApiConversions(prefill.unitConversions);
            }
        }
        PM.collapseAdvancedDrawer();
        var hint = PM.el('detail-sku-hint');
        if (hint) hint.textContent = '请填写名称、售价、基本单位与库存';
        await PM.loadProductWarehouseStocks(null);
        if (typeof window.TM_openUnifiedModal !== 'function') {
            PM.lockBodyScroll(true);
        }
    };

    var _closeDetail = PM.closeProductDetail;
    PM.closeProductDetail = function () {
        _closeDetail.call(PM);
        if (typeof window.TM_closeUnifiedModal !== 'function') {
            PM.lockBodyScroll(false);
        }
        PM.showFormErrors('product-form-errors', []);
    };

    var _saveProduct = PM.saveProduct;
    PM.saveProduct = async function () {
        PM.showFormErrors('product-form-errors', []);
        if (!PM.validateProductForm()) return;
        if (!PM.currentProduct) {
            PM.currentProduct = {};
        }
        var validUnitConv = PM.resolveUnitConversionsForSave();
        var built = PM.buildProductSaveBodyWithUnits(validUnitConv);
        if (built.error) {
            if (built.error !== '__validation__' && window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(built.error, 'error');
            }
            return;
        }
        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var response = await window.wrappedFetch('/api/v1/rd/products/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(built.body)
            });
            if (!response.ok) {
                var errBody = await response.json().catch(function () { return {}; });
                var errMsg = (errBody && (errBody.message || errBody.error)) || ('保存失败 (' + response.status + ')');
                PM.showFormErrors('product-form-errors', [errMsg]);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification(errMsg, 'error');
                }
                return;
            }
            var data = await window.handleApiResponse(response);
            if (!data) {
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('保存产品失败，请稍后重试', 'error');
                }
                return;
            }
            var saved = data.data || {};
            if (saved.productId != null && !PM.currentProduct.id) {
                PM.currentProduct.id = saved.productId;
            }
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('产品保存成功！', 'success');
            }
            if (typeof PM.auditSaveCallback === 'function') {
                var cb = PM.auditSaveCallback;
                PM.auditSaveCallback = null;
                cb(saved, built.body.product);
            } else {
                PM.closeProductDetail();
            }
            await PM.loadProducts();
        } catch (error) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存产品失败: ' + error.message, 'error');
            }
        }
    };

    PM.removeProductRow = function (rowId) {
        PM.readTransferRowsFromDom();
        PM.transferState.productRows = PM.transferState.productRows.filter(function (r) {
            return r.id !== rowId;
        });
        if (!PM.transferState.productRows.length) {
            PM.addProductRow();
        } else {
            PM.renderTransferProductList();
        }
    };

    PM.readTransferRowsFromDom = function () {
        var tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-row-id]').forEach(function (tr) {
            var rowId = parseInt(tr.getAttribute('data-row-id'), 10);
            var idx = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
            if (idx === -1) return;
            var sel = tr.querySelector('.transfer-product-select');
            var priceInp = tr.querySelector('.transfer-price-input');
            var qtyInp = tr.querySelector('.transfer-qty-input');
            if (sel) PM.transferState.productRows[idx].productId = sel.value ? parseInt(sel.value, 10) : null;
            if (priceInp) PM.transferState.productRows[idx].price = parseFloat(priceInp.value) || 0;
            if (qtyInp) PM.transferState.productRows[idx].quantity = parseInt(qtyInp.value, 10) || 0;
            PM.transferState.productRows[idx].total = PM.transferState.productRows[idx].price * PM.transferState.productRows[idx].quantity;
        });
    };

    PM.renderTransferProductList = function () {
        var tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;
        var stocks = PM.sourceWarehouseProductStocks || [];
        tbody.innerHTML = PM.transferState.productRows.map(function (row) {
            var opts = '<option value="">请选择产品</option>' + stocks.map(function (p) {
                var sel = row.productId === p.productId ? ' selected' : '';
                var maxQ = p.quantity != null ? p.quantity : 0;
                return '<option value="' + p.productId + '" data-price="' + p.price + '" data-max="' + maxQ + '"' + sel + '>' +
                    PM.escHtmlText(p.productName) + ' (' + PM.escHtmlText(p.sku || '') + ' · 可调' + maxQ + ')</option>';
            }).join('');
            return '<tr class="hover:bg-slate-50 transition-colors" data-row-id="' + row.id + '">' +
                '<td class="tm-transfer-td tm-transfer-td--product px-2 py-2"><select class="transfer-product-select form-input w-full text-xs" onchange="window.ProductModule.handleProductSelect(' + row.id + ', this.value)">' + opts + '</select></td>' +
                '<td class="tm-transfer-td tm-transfer-td--price px-2 py-2"><input type="number" readonly class="transfer-price-input tm-transfer-num-input form-input bg-slate-100" value="' + (row.price || 0).toFixed(2) + '"></td>' +
                '<td class="tm-transfer-td tm-transfer-td--qty px-2 py-2"><input type="number" min="0" class="transfer-qty-input tm-transfer-num-input form-input" value="' + (row.quantity || 0) + '" oninput="window.ProductModule.calculateRowTotal(' + row.id + ')"></td>' +
                '<td class="tm-transfer-td tm-transfer-td--total px-2 py-2"><span class="transfer-row-total">' + (row.total || 0).toFixed(2) + '</span></td>' +
                '<td class="tm-transfer-td tm-transfer-td--action px-2 py-2"><button type="button" class="tm-transfer-row-delete" onclick="window.ProductModule.removeProductRow(' + row.id + ')" aria-label="删除行"><i class="ph ph-trash"></i></button></td>' +
                '</tr>';
        }).join('');
        PM.calculateGrandTotal();
    };

    PM.handleProductSelect = function (rowId, productId) {
        var rowIndex = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
        if (rowIndex === -1) return;
        if (!productId) {
            PM.transferState.productRows[rowIndex] = { id: rowId, productId: null, productName: '', sku: '', price: 0, quantity: 0, total: 0, maxQty: 0 };
        } else {
            var p = PM.sourceWarehouseProductStocks.find(function (x) { return x.productId === parseInt(productId, 10); });
            if (p) {
                PM.transferState.productRows[rowIndex] = {
                    id: rowId,
                    productId: p.productId,
                    productName: p.productName,
                    sku: p.sku,
                    price: parseFloat(p.price) || 0,
                    quantity: Math.min(1, p.quantity || 0),
                    total: (parseFloat(p.price) || 0) * Math.min(1, p.quantity || 0),
                    maxQty: p.quantity || 0
                };
            }
        }
        PM.renderTransferProductList();
    };

    PM.calculateRowTotal = function (rowId) {
        var tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;
        var row = tbody.querySelector('tr[data-row-id="' + rowId + '"]');
        if (!row) return;
        var priceInput = row.querySelector('.transfer-price-input');
        var qtyInput = row.querySelector('.transfer-qty-input');
        var totalSpan = row.querySelector('.transfer-row-total');
        var price = parseFloat(priceInput && priceInput.value) || 0;
        var quantity = parseInt(qtyInput && qtyInput.value, 10) || 0;
        var rowIndex = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
        var maxQ = rowIndex >= 0 && PM.transferState.productRows[rowIndex].maxQty ? PM.transferState.productRows[rowIndex].maxQty : quantity;
        if (quantity > maxQ) {
            quantity = maxQ;
            if (qtyInput) qtyInput.value = String(quantity);
        }
        var total = price * quantity;
        if (totalSpan) totalSpan.textContent = total.toFixed(2);
        if (rowIndex !== -1) {
            PM.transferState.productRows[rowIndex].price = price;
            PM.transferState.productRows[rowIndex].quantity = quantity;
            PM.transferState.productRows[rowIndex].total = total;
        }
        PM.calculateGrandTotal();
    };

    PM.calculateGrandTotal = function () {
        var totalValueEl = document.getElementById('transfer-total-value');
        if (!totalValueEl) return;
        var grandTotal = PM.transferState.productRows.reduce(function (sum, row) { return sum + (row.total || 0); }, 0);
        totalValueEl.textContent = grandTotal.toFixed(2);
    };

    var _openTransfer = PM.openTransferModal;
    PM.openTransferModal = async function (warehouseId) {
        PM.transferState.isVariablePrice = false;
        PM.showFormErrors('transfer-form-errors', []);
        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var stocksResp = await window.wrappedFetch('/api/v1/rd/products/stocks/by-warehouse/' + warehouseId, { method: 'GET' });
            var stocksData = await window.handleApiResponse(stocksResp);
            PM.sourceWarehouseProductStocks = stocksData && stocksData.data ? stocksData.data : [];
        } catch (e) {
            PM.sourceWarehouseProductStocks = [];
        }
        await _openTransfer.call(PM, warehouseId);
        PM.lockBodyScroll(true);
    };

    PM.closeTransferModal = function () {
        var modal = document.getElementById('warehouse-transfer-modal');
        if (modal) modal.classList.add('hidden');
        PM.transferState = {
            sourceWarehouseId: null,
            sourceWarehouseName: '',
            targetWarehouseId: null,
            isVariablePrice: false,
            productRows: []
        };
        PM.sourceWarehouseProductStocks = [];
        PM.lockBodyScroll(false);
    };

    PM.switchTransferType = function () {
        /* 仅平价调拨，保留空实现兼容旧 onclick */
    };

    PM.confirmTransfer = async function () {
        PM.transferState.isVariablePrice = false;
        var msgs = [];
        var targetSelect = document.getElementById('target-warehouse-select');
        if (!targetSelect || !targetSelect.value) msgs.push('请选择目标仓库');
        PM.readTransferRowsFromDom();
        var validRows = PM.transferState.productRows.filter(function (r) { return r.productId && r.quantity > 0; });
        if (!validRows.length) msgs.push('请至少选择一个产品并填写调拨数量');
        PM.showFormErrors('transfer-form-errors', msgs);
        if (msgs.length) return;

        var transferData = {
            sourceWarehouseId: PM.transferState.sourceWarehouseId,
            targetWarehouseId: parseInt(targetSelect.value, 10),
            isVariablePrice: false,
            items: validRows.map(function (r) {
                return { productId: r.productId, quantity: r.quantity, price: r.price };
            })
        };

        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var response = await window.wrappedFetch('/api/v1/rd/products/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transferData)
            });
            var data = await window.handleApiResponse(response);
            if (!data) return;
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('调拨成功！', 'success');
            }
            await PM.loadProducts();
            PM.closeTransferModal();
        } catch (error) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('调拨失败: ' + error.message, 'error');
            }
        }
    };

    PM.populateAuditCategorySelect = function (selectedCategoryId) {
        var select = PM.el('detail-product-category', 'product-category-select');
        if (!select) return;
        select.innerHTML = '<option value="">未分类（可选）</option>';
        (PM.categories || []).forEach(function (cat) {
            var option = document.createElement('option');
            option.value = cat.categoryId;
            option.textContent = cat.name;
            if (selectedCategoryId != null && String(selectedCategoryId) === String(cat.categoryId)) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    };

    PM.mergeAuditProductPrefill = function (aiItem, draft) {
        var base = Object.assign({}, aiItem || {});
        if (!draft || typeof draft !== 'object') return base;
        Object.keys(draft).forEach(function (key) {
            var val = draft[key];
            if (val != null && String(val).trim() !== '') {
                base[key] = val;
            }
        });
        return base;
    };

    window.TM_initAuditProductForm = async function (np, index) {
        np = np || {};
        if (window.TmProductRegistry && typeof window.TmProductRegistry.normalizeAiProduct === 'function') {
            np = window.TmProductRegistry.normalizeAiProduct(np);
        }
        if (window.auditState && window.auditState.newProductDrafts && index != null && window.auditState.newProductDrafts[index]) {
            np = PM.mergeAuditProductPrefill(np, window.auditState.newProductDrafts[index]);
        }
        try {
            await Promise.all([PM.loadCategories(), PM.loadSuppliers(), PM.loadWarehouses()]);
        } catch (e) { /* ignore */ }
        PM.currentProduct = {};
        PM.unitConversionDraft = [{ unitName: '', ratio: '' }];
        PM.populateAuditCategorySelect(np.category_id != null ? np.category_id : np.categoryId);
        PM.populateSupplierSelect(np.supplier_id != null ? np.supplier_id : np.supplierId);
        var set = function (id, val) {
            var el = PM.el(id);
            if (!el) return;
            el.value = val != null && val !== undefined ? val : '';
        };
        var price = np.price != null ? np.price : (np.sale_price != null ? np.sale_price : np.unit_price);
        var stock = np.stock != null ? np.stock : np.stock_quantity;
        var aiSku = np.sku || np.product_sku || '';
        set('detail-product-name', np.name || np.product_name || '');
        set('detail-product-sku-input', aiSku);
        set('detail-product-price', price != null && price !== '' ? price : '');
        set('detail-product-base-unit', np.base_unit || np.baseUnit || np.unit || '件');
        set('detail-product-stock', stock != null && stock !== '' ? stock : '');
        set('detail-product-warning-stock', np.warning_stock != null ? np.warning_stock : np.warningStock);
        set('detail-product-description', np.description || np.summary || '');
        if (Array.isArray(np.unit_conversions || np.unitConversions)) {
            PM.syncDraftFromApiConversions(np.unit_conversions || np.unitConversions);
        }
        PM.rebuildPurchaseSalesUnitSelects(
            np.purchase_unit || np.purchaseUnit || null,
            np.sales_unit || np.salesUnit || null
        );
        await PM.loadProductWarehouseStocks(null);
        var hasAdvanced = !!(np.sku || np.product_sku || np.description || np.summary || stock);
        var drawer = PM.getProductDetailAdvancedDrawer();
        var icon = PM.getProductDetailAdvancedIcon();
        var btn = PM.getProductDetailAdvancedToggle();
        if (drawer) {
            if (hasAdvanced) {
                drawer.classList.add('open');
                drawer.setAttribute('aria-hidden', 'false');
            } else {
                drawer.classList.remove('open');
                drawer.setAttribute('aria-hidden', 'true');
            }
        }
        if (btn) btn.setAttribute('aria-expanded', hasAdvanced ? 'true' : 'false');
        if (icon) {
            icon.classList.toggle('ph-caret-down', !hasAdvanced);
            icon.classList.toggle('ph-caret-up', hasAdvanced);
        }
        PM.showFormErrors('audit-product-form-errors', []);
    };

    PM.saveAuditNewProduct = async function () {
        PM.showFormErrors('audit-product-form-errors', []);
        if (!PM.validateProductForm()) return;
        PM.currentProduct = {};
        var validUnitConv = PM.resolveUnitConversionsForSave();
        var built = PM.buildProductSaveBodyWithUnits(validUnitConv);
        if (built.error) {
            if (built.error !== '__validation__' && window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(built.error, 'error');
            }
            return;
        }
        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var response = await window.wrappedFetch('/api/v1/rd/products/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(built.body)
            });
            if (!response.ok) {
                var errBody = await response.json().catch(function () { return {}; });
                var errMsg = (errBody && (errBody.message || errBody.error)) || ('保存失败 (' + response.status + ')');
                if (errMsg.indexOf('uq_products_tenant_sku') !== -1 || errMsg.indexOf('duplicate key') !== -1) {
                    errMsg = '产品 SKU 已存在，请清空高级配置中的 SKU 后重试，或刷新页面重新加载';
                }
                PM.showFormErrors('audit-product-form-errors', [errMsg]);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification(errMsg, 'error');
                }
                return;
            }
            var data = await window.handleApiResponse(response);
            if (!data) return;
            var saved = data.data || {};
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('产品保存成功！', 'success');
            }
            if (typeof PM.auditSaveCallback === 'function') {
                var cb = PM.auditSaveCallback;
                PM.auditSaveCallback = null;
                await cb(saved, built.body.product);
            }
            await PM.loadProducts();
        } catch (error) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存产品失败: ' + error.message, 'error');
            }
        }
    };

    var _onBaseUnitChanged = PM.onBaseUnitChanged;
    PM.onBaseUnitChanged = function () {
        if (PM.isAuditProductFormActive()) {
            var pu = PM.el('detail-product-purchase-unit', 'product-purchase-unit-select');
            var su = PM.el('detail-product-sales-unit', 'product-sales-unit-select');
            PM.rebuildPurchaseSalesUnitSelects(pu ? pu.value : null, su ? su.value : null);
            var whPanel = PM.el('detail-product-warehouse-stock');
            if (whPanel) {
                whPanel.querySelectorAll('.warehouse-stock-preview').forEach(function (node) {
                    node.textContent = PM.getBaseUnitLabel();
                });
            }
            return;
        }
        if (typeof _onBaseUnitChanged === 'function') {
            _onBaseUnitChanged.call(PM);
        }
    };

    window.toggleAuditProductAdvanced = function () {
        var drawer = PM.getProductDetailAdvancedDrawer();
        var icon = PM.getProductDetailAdvancedIcon();
        var btn = PM.getProductDetailAdvancedToggle();
        if (!drawer) return;
        var open = drawer.classList.toggle('open');
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (icon) {
            icon.classList.toggle('ph-caret-down', !open);
            icon.classList.toggle('ph-caret-up', open);
        }
    };

    window.toggleProductDetailAdvanced = function () {
        PM.toggleAdvanced();
    };
    if (typeof window.TM_bindProductCenterGlobalFns === 'function') {
        window.TM_bindProductCenterGlobalFns();
    }

    window.openProductUnitModal = function () { PM.openUnitModal(); };
    window.closeProductUnitModal = function () { PM.closeUnitModal(); };
    window.openUnitModal = function () { PM.openUnitModal(); };
    window.closeUnitModal = function () { PM.closeUnitModal(); };
    window.removeProductRow = function (rowId) { PM.removeProductRow(rowId); };

    console.log('[ProductEnhance] 产品中心增强已应用');
})();
