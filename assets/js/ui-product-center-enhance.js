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
    PM._stockSyncLock = false;

    PM.getWarehouseStockInputs = function () {
        var container = PM.el('detail-product-warehouse-stock');
        if (!container) return [];
        return Array.prototype.slice.call(container.querySelectorAll('.detail-warehouse-stock-input'));
    };

    PM.sumWarehouseStocks = function () {
        var sum = 0;
        PM.getWarehouseStockInputs().forEach(function (inp) {
            var q = parseInt(inp.value, 10);
            // 允许负库存（欠货开单），与规格弹窗仓合计一致
            if (!isNaN(q)) sum += q;
        });
        return sum;
    };

    PM.syncTotalFromWarehouses = function () {
        if (PM._stockSyncLock) return;
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        if (!stockInput) return;
        PM._stockSyncLock = true;
        stockInput.value = String(PM.sumWarehouseStocks());
        PM._stockSyncLock = false;
    };

    PM.syncWarehousesFromTotal = function () {
        if (PM._stockSyncLock) return;
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        var inputs = PM.getWarehouseStockInputs();
        if (!stockInput || !inputs.length) return;
        var newTotal = parseInt(stockInput.value, 10);
        if (isNaN(newTotal)) newTotal = 0;
        newTotal = Math.max(0, newTotal);
        PM._stockSyncLock = true;
        var oldSum = PM.sumWarehouseStocks();
        if (inputs.length === 1) {
            inputs[0].value = String(newTotal);
        } else {
            var delta = newTotal - oldSum;
            var def = inputs[0];
            var cur = parseInt(def.value, 10);
            if (isNaN(cur)) cur = 0;
            def.value = String(Math.max(0, cur + delta));
        }
        PM._stockSyncLock = false;
    };

    PM.syncStockBeforeSave = function () {
        var inputs = PM.getWarehouseStockInputs();
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        if (!stockInput) return;
        if (!inputs.length) return;
        var whSum = PM.sumWarehouseStocks();
        var totalRaw = stockInput.value;
        if (totalRaw === '' || totalRaw == null) {
            stockInput.value = String(whSum);
            return;
        }
        var total = parseInt(totalRaw, 10);
        if (isNaN(total)) total = whSum;
        if (whSum === 0 && total > 0 && inputs.length >= 1) {
            inputs[0].value = String(total);
        } else if (whSum > 0 && whSum !== total) {
            PM._stockSyncLock = true;
            stockInput.value = String(whSum);
            PM._stockSyncLock = false;
        }
    };

    PM.buildDefaultWarehouseStocksFromTotal = function (total) {
        var warehouses = PM.warehouses || [];
        if (!warehouses.length) return [];
        var qty = parseInt(total, 10);
        if (isNaN(qty) || qty <= 0) return [];
        return [{
            warehouseId: warehouses[0].id,
            quantity: qty
        }];
    };

    PM.bindStockSyncHandlers = function () {
        var stockInput = PM.el('detail-product-stock', 'product-stock-input');
        if (stockInput && !stockInput.dataset.tmStockBound) {
            stockInput.dataset.tmStockBound = '1';
            stockInput.addEventListener('input', function () { PM.syncWarehousesFromTotal(); });
            stockInput.addEventListener('change', function () { PM.syncWarehousesFromTotal(); });
        }
    };

    PM.writeAuditDraftUnitConversions = function (valid) {
        if (!window.auditState || !window.auditState.newProductDrafts) return;
        var idx = window.auditState.activeNewProductIndex || 0;
        if (!window.auditState.newProductDrafts[idx]) {
            window.auditState.newProductDrafts[idx] = {};
        }
        window.auditState.newProductDrafts[idx].unit_conversions = (valid || []).map(function (c) {
            return { unitName: c.unitName, ratio: c.ratio };
        });
    };

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

    PM.getProductFormRoot = function () {
        var auditRoot = PM.getAuditProductRoot && PM.getAuditProductRoot();
        if (auditRoot) return auditRoot;
        var modal = PM.getProductDetailModal && PM.getProductDetailModal();
        if (modal) {
            var formRoot = modal.querySelector('#product-detail-form-root');
            if (formRoot) return formRoot;
        }
        return document.getElementById('product-detail-form-root');
    };

    PM.resolveScopedId = function (id, root) {
        if (!id || !root) return id;
        var scope = root.dataset && root.dataset.tmFormScope;
        if (!scope || id.indexOf(scope + '-detail-') === 0) return id;
        if (id.indexOf('detail-') === 0) return scope + '-' + id;
        return id;
    };

    PM.el = function () {
        var ids = Array.prototype.slice.call(arguments);

        function findInRoot(root) {
            if (!root) return null;
            for (var i = 0; i < ids.length; i++) {
                if (!ids[i]) continue;
                var scopedId = PM.resolveScopedId(ids[i], root);
                var node = root.querySelector('#' + scopedId);
                if (node) return node;
                if (scopedId !== ids[i]) {
                    node = root.querySelector('#' + ids[i]);
                    if (node) return node;
                }
            }
            return null;
        }

        var auditRoot = PM.getAuditProductRoot();
        var hit = findInRoot(auditRoot);
        if (hit) return hit;

        var formRoot = PM.getProductFormRoot();
        hit = findInRoot(formRoot);
        if (hit) return hit;

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
            // 允负：欠货开单后仓存可为负，需与规格弹窗合计一致
            if (isNaN(stockNum)) errors.push('当前库存总量须为整数');
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
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                sk = 'SKU-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
            } else {
                sk = 'SKU-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            }
            if (skuInput) skuInput.value = sk;
        }

        var unitPayload = conv.map(function (c) {
            return { unitName: c.unitName, ratio: c.ratio, isDefault: false };
        });

        var catRaw = categorySelect && categorySelect.value ? parseInt(categorySelect.value, 10) : null;
        var supRaw = supplierSelect && supplierSelect.value ? parseInt(supplierSelect.value, 10) : null;
        var cp = PM.currentProduct || {};
        var productId = cp.id || cp.productId || null;
        var purchaseUnit = purchaseUnitSelect && purchaseUnitSelect.value ? purchaseUnitSelect.value : baseUnitStr;
        var salesUnit = salesUnitSelect && salesUnitSelect.value ? salesUnitSelect.value : baseUnitStr;
        if (!unitPayload.length) {
            purchaseUnit = baseUnitStr;
            salesUnit = baseUnitStr;
        } else {
            if (!purchaseUnit) purchaseUnit = baseUnitStr;
            if (!salesUnit) salesUnit = baseUnitStr;
        }

        PM.syncStockBeforeSave();

        var stockVal = stockInput && stockInput.value !== '' ? parseInt(stockInput.value, 10) : 0;
        if (isNaN(stockVal)) stockVal = 0;

        var productPayload = {
            productId: productId,
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
        if (!whStocks.length && stockVal > 0) {
            whStocks = PM.buildDefaultWarehouseStocksFromTotal(stockVal);
        }
        var resultBody = {
            product: productPayload,
            warehouseStocks: whStocks,
            spu: PM.buildSpuPayloadFromForm(productPayload),
            skus: [PM.buildDefaultSkuPayloadFromForm(productPayload, sk)]
        };
        if (unitPayload.length > 0) {
            resultBody.unitConversions = unitPayload;
        }
        var matrixPayload = PM.buildVariantMatrixPayload();
        if (matrixPayload) {
            resultBody.variantMatrix = matrixPayload;
        }
        return {
            error: null,
            body: resultBody
        };
    };

    PM.buildSpuPayloadFromForm = function (productPayload) {
        var cp = PM.currentProduct || {};
        var trackVariants = PM.el('detail-track-variants');
        var trackExpiry = PM.el('detail-track-expiry');
        var trackSerial = PM.el('detail-track-serial');
        var shelfLife = PM.el('detail-shelf-life-days');
        var expiryPolicy = PM.el('detail-expiry-policy');
        var serialMode = PM.el('detail-serial-mode');
        return {
            spuId: cp.spuId || null,
            name: productPayload.name,
            categoryId: productPayload.categoryId,
            description: productPayload.description,
            defaultSupplierId: productPayload.supplierId,
            trackVariants: trackVariants ? trackVariants.checked : false,
            trackExpiry: trackExpiry ? trackExpiry.checked : false,
            trackSerial: trackSerial ? trackSerial.checked : false,
            defaultShelfLifeDays: shelfLife && shelfLife.value ? parseInt(shelfLife.value, 10) : null,
            expiryPolicy: expiryPolicy ? expiryPolicy.value : null,
            serialOutboundMode: serialMode ? serialMode.value : null
        };
    };

    PM.buildDefaultSkuPayloadFromForm = function (productPayload, skuCode) {
        var cp = PM.currentProduct || {};
        return {
            skuId: cp.skuId || null,
            skuCode: skuCode,
            price: productPayload.price,
            warningStock: productPayload.warningStock,
            baseUnit: productPayload.baseUnit,
            purchaseUnit: productPayload.purchaseUnit,
            salesUnit: productPayload.salesUnit,
            stock: productPayload.stock,
            isDefault: true
        };
    };

    PM.parseJwtIndustryVertical = function () {
        try {
            var token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return '';
            var parts = String(token).split('.');
            if (parts.length < 2) return '';
            var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            var payload = JSON.parse(atob(b64));
            return String(payload.industryVertical || payload.industry_vertical || '').toUpperCase();
        } catch (e) {
            return '';
        }
    };

    PM.syncIndustryVerticalToShell = function (iv) {
        iv = String(iv || '').toUpperCase();
        if (!iv || iv === 'PENDING') return;
        try {
            document.documentElement.setAttribute('data-industry-vertical', iv);
        } catch (e) { /* ignore */ }
        if (window.TM_UI_CONTEXT) {
            window.TM_UI_CONTEXT.industryVertical = iv;
        }
        if (window.TM_WorkbenchProfile) {
            window.TM_WorkbenchProfile.industryVertical = iv;
        }
    };

    /**
     * 解析租户行业垂直：优先具体行业（CLOTHING/FOOD/DIGITAL_3C），避免 PENDING 被当成 GENERAL 后规格卡永不展示。
     */
    PM.getIndustryVertical = function () {
        var candidates = [];
        var p = window.TM_WorkbenchProfile || {};
        if (p.industryVertical) candidates.push(p.industryVertical);
        try {
            var domIv = document.documentElement.getAttribute('data-industry-vertical');
            if (domIv) candidates.push(domIv);
        } catch (e0) { /* ignore */ }
        if (window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.industryVertical) {
            candidates.push(window.TM_UI_CONTEXT.industryVertical);
        }
        var caps = window.TM_productCapabilities || {};
        if (caps.industryVertical) candidates.push(caps.industryVertical);
        var jwtIv = PM.parseJwtIndustryVertical();
        if (jwtIv) candidates.push(jwtIv);

        var specialized = null;
        var general = null;
        for (var i = 0; i < candidates.length; i++) {
            var iv = String(candidates[i] || '').toUpperCase().trim();
            if (!iv || iv === 'UNDEFINED' || iv === 'NULL') continue;
            if (iv === 'PENDING') continue;
            if (iv === 'GENERAL') {
                if (!general) general = 'GENERAL';
                continue;
            }
            if (iv === 'CLOTHING' || iv === 'FOOD' || iv === 'DIGITAL_3C' || iv === 'APPAREL') {
                specialized = iv === 'APPAREL' ? 'CLOTHING' : iv;
                break;
            }
            // 未知但非空：保留为首选
            if (!specialized) specialized = iv;
        }
        var resolved = specialized || general || 'GENERAL';
        if (specialized) PM.syncIndustryVerticalToShell(specialized);
        return resolved;
    };

    PM.isIndustryCardAllowed = function (cardKey, vertical) {
        if (window.TM_IndustryUI && typeof window.TM_IndustryUI.industryAllowsCapability === 'function') {
            var map = { variants: 'allowVariants', expiry: 'allowExpiry', serial: 'allowSerial' };
            return window.TM_IndustryUI.industryAllowsCapability(map[cardKey], vertical || PM.getIndustryVertical());
        }
        vertical = vertical || PM.getIndustryVertical();
        if (vertical === 'GENERAL') return false;
        if (cardKey === 'variants') {
            return vertical === 'CLOTHING' || vertical === 'FOOD' || vertical === 'DIGITAL_3C';
        }
        if (cardKey === 'expiry') return vertical === 'FOOD';
        if (cardKey === 'serial') return vertical === 'DIGITAL_3C';
        return false;
    };

    PM.applyIndustryProductDefaults = function (opts) {
        opts = opts || {};
        if (opts.editMode) return;
        var iv = PM.getIndustryVertical();
        if (iv === 'GENERAL') return;
        var tv = PM.el('detail-track-variants');
        var te = PM.el('detail-track-expiry');
        var ts = PM.el('detail-track-serial');
        if (iv === 'CLOTHING' || iv === 'FOOD' || iv === 'DIGITAL_3C') {
            if (tv) tv.checked = true;
        }
        if (iv === 'FOOD' && te) te.checked = true;
        if (iv === 'DIGITAL_3C' && ts) ts.checked = true;
        var days = PM.el('detail-shelf-life-days');
        var policy = PM.el('detail-expiry-policy');
        if (iv === 'FOOD' && days && !days.value) days.value = '180';
        if (iv === 'FOOD' && policy && !policy.value) policy.value = 'FEFO';
        if (iv === 'FOOD' && days && days.value) PM._expiryConfigConfirmed = true;
        PM.applyDefaultIndustryTemplate();
        if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
        if (typeof PM.syncVariantMatrixPanelVisibility === 'function') PM.syncVariantMatrixPanelVisibility();
        if (typeof PM.syncExpiryPanelVisibility === 'function') PM.syncExpiryPanelVisibility();
        if (typeof PM.updateExpiryEntrySummary === 'function') PM.updateExpiryEntrySummary();
    };

    PM.applyDefaultIndustryTemplate = function () {
        var sel = PM.el('detail-variant-template');
        if (!sel || sel.value) return;
        var iv = PM.getIndustryVertical();
        if (iv === 'GENERAL') return;
        var defaultId = PM._defaultAttributeTemplateId;
        if (defaultId) {
            sel.value = String(defaultId);
            PM.loadVariantMatrixFromTemplate(sel.value, { force: true });
            return;
        }
        var opts = Array.prototype.slice.call(sel.options);
        var hit = null;
        opts.forEach(function (o) {
            if (!o.value) return;
            var t = (o.getAttribute('data-industry') || '').toUpperCase();
            if (t === iv) hit = o;
        });
        if (!hit && opts.length > 1) hit = opts[1];
        if (hit) {
            sel.value = hit.value;
            PM.loadVariantMatrixFromTemplate(hit.value, { force: true });
        }
    };

    PM.loadProductCapabilities = function () {
        var fetchFn = window.wrappedFetch || fetch;
        return fetchFn('/api/v1/rd/products/capabilities', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }).then(function (r) { return r.json(); }).then(function (res) {
            if (!res.success) return null;
            var raw = res.data || {};
            var apiIv = raw.industryVertical || raw.industry_vertical;
            if (apiIv) {
                PM.syncIndustryVerticalToShell(apiIv);
                raw.industryVertical = String(apiIv).toUpperCase();
            }
            window.TM_productCapabilities = PM.normalizeProductCapabilities(raw);
            if (apiIv) {
                window.TM_productCapabilities.industryVertical = String(apiIv).toUpperCase();
            }
            PM.applyProductCapabilityVisibility();
            return window.TM_productCapabilities;
        }).catch(function () { return null; });
    };

    PM.normalizeProductCapabilities = function (raw) {
        raw = raw || {};
        var profile = window.TM_WorkbenchProfile || {};
        if (profile.capabilities && typeof profile.capabilities === 'object') {
            raw = Object.assign({}, profile.capabilities, raw);
        }
        var merchant = '';
        try {
            merchant = (document.documentElement.getAttribute('data-merchant-type') || '').toUpperCase();
        } catch (e) { /* ignore */ }
        var defaults = { allowVariants: false, allowExpiry: false, allowSerial: false };
        if (merchant === 'ECOM') {
            defaults.allowVariants = true;
        } else if (merchant === 'WHOLESALE') {
            defaults.allowVariants = true;
            defaults.allowExpiry = true;
            defaults.allowSerial = true;
        } else if (merchant === 'FACTORY_TRADE') {
            defaults.allowSerial = true;
            defaults.allowExpiry = true;
        }
        function asBool(v, def) {
            if (v === undefined || v === null || v === '') return def;
            if (typeof v === 'string') return v === 'true' || v === '1';
            return !!v;
        }
        var merged = {
            allowVariants: asBool(raw.allowVariants, defaults.allowVariants),
            allowExpiry: asBool(raw.allowExpiry, defaults.allowExpiry),
            allowSerial: asBool(raw.allowSerial, defaults.allowSerial)
        };
        // 行业硬约束：服饰不开批次/序列号；食品不开序列号；数码不开批次
        var vertical = '';
        try {
            vertical = String(
                (raw && raw.industryVertical) ||
                (profile.industryVertical) ||
                (PM.getIndustryVertical && PM.getIndustryVertical()) ||
                'GENERAL'
            ).toUpperCase();
            if (vertical === 'PENDING') vertical = 'GENERAL';
            if (vertical === 'APPAREL') vertical = 'CLOTHING';
        } catch (e2) {
            vertical = 'GENERAL';
        }
        if (vertical === 'CLOTHING') {
            merged.allowVariants = true;
            merged.allowExpiry = false;
            merged.allowSerial = false;
        } else if (vertical === 'FOOD') {
            merged.allowSerial = false;
        } else if (vertical === 'DIGITAL_3C') {
            merged.allowExpiry = false;
        } else if (vertical === 'GENERAL' || vertical === 'PENDING') {
            merged.allowVariants = false;
            merged.allowExpiry = false;
            merged.allowSerial = false;
        }
        return merged;
    };

    PM.getCapabilityFormRoot = function () {
        var auditRoot = PM.getAuditProductRoot && PM.getAuditProductRoot();
        if (auditRoot) return auditRoot;
        var modal = PM.getProductDetailModal && PM.getProductDetailModal();
        if (modal) return modal;
        return document.getElementById('product-detail-form-root') || document;
    };

    PM.applyProductCapabilityVisibility = function () {
        var caps = PM.normalizeProductCapabilities(window.TM_productCapabilities || {});
        var vertical = PM.getIndustryVertical();
        var root = PM.getCapabilityFormRoot();
        var section = root.querySelector('#product-capability-cards');
        if (!section) section = document.getElementById('product-capability-cards');
        if (!section) return;
        var showVariants = PM.isIndustryCardAllowed('variants', vertical) && caps.allowVariants;
        var showExpiry = PM.isIndustryCardAllowed('expiry', vertical) && caps.allowExpiry;
        var showSerial = PM.isIndustryCardAllowed('serial', vertical) && caps.allowSerial;
        var any = showVariants || showExpiry || showSerial;
        section.classList.toggle('hidden', !any);
        var hint = root.querySelector('#product-capability-hint') || document.getElementById('product-capability-hint');
        if (hint) {
            hint.classList.toggle('hidden', any);
            if (!any) {
                if (vertical === 'GENERAL') {
                    hint.textContent = '通用行业仅展示基础信息与高级配置；如需多规格/批次/序列号，请在租户档案中选择对应行业。';
                } else {
                    hint.textContent = '当前租户未开启规格/保质期/序列号能力，可在智能经营-租户档案中配置，或联系管理员。';
                }
            }
        }
        function card(id, visible) {
            var el = root.querySelector('#' + id) || document.getElementById(id);
            if (!el) return;
            el.classList.toggle('hidden', !visible);
        }
        card('cap-card-variants', showVariants);
        card('cap-card-expiry', showExpiry);
        card('cap-card-serial', showSerial);
    };

    PM.loadAttributeTemplates = function (force) {
        var sel = PM.el('detail-variant-template');
        if (!sel) return Promise.resolve();
        var iv = PM.getIndustryVertical();
        var applyList = function (list, defaultId) {
            PM._attributeTemplateListCache = list || [];
            PM._defaultAttributeTemplateId = defaultId != null ? defaultId : null;
            var cur = sel.value;
            sel.innerHTML = '<option value="">选择属性模板</option>' + (list || []).map(function (t) {
                var id = t.template_id != null ? t.template_id : t.templateId;
                var name = t.name || ('模板#' + id);
                var industry = t.industry_vertical != null ? t.industry_vertical : t.industryVertical;
                var isSystem = t.is_system === true || t.isSystem === true;
                var suffix = isSystem ? ' · 系统' : '';
                return '<option value="' + PM.escHtmlAttr(String(id)) + '" data-industry="' + PM.escHtmlAttr(String(industry || '')) + '">' + PM.escHtmlText(name + suffix) + '</option>';
            }).join('');
            if (cur) {
                sel.value = cur;
            } else if (defaultId != null) {
                var effectiveDefault = PM.resolveEffectiveTemplateId
                    ? PM.resolveEffectiveTemplateId(defaultId) : defaultId;
                sel.value = String(effectiveDefault);
            }
            PM.updateActiveTemplateNameLabel();
            if (!sel.__tmMatrixBound) {
                sel.__tmMatrixBound = true;
                sel.addEventListener('change', function () {
                    var tid = PM.resolveEffectiveTemplateId
                        ? PM.resolveEffectiveTemplateId(sel.value) : sel.value;
                    if (tid && String(tid) !== String(sel.value)) sel.value = String(tid);
                    PM.loadVariantMatrixFromTemplate(sel.value);
                    PM.updateActiveTemplateNameLabel();
                });
            }
        };
        if (window.TM_MasterDataCache) {
            return window.TM_MasterDataCache.getAttributeTemplates(iv, !!force).then(function (res) {
                applyList(res.list, res.defaultTemplateId);
            });
        }
        var fetchFn = window.wrappedFetch || fetch;
        var url = '/api/v1/rd/products/attribute-templates';
        if (iv && iv !== 'GENERAL') {
            url += '?industryVertical=' + encodeURIComponent(iv);
        }
        return fetchFn(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }).then(function (r) { return r.json(); }).then(function (res) {
            var list = res && res.success && Array.isArray(res.data) ? res.data : [];
            applyList(list, res && res.defaultTemplateId != null ? res.defaultTemplateId : null);
        }).catch(function () { /* ignore */ });
    };

    PM.resolveEffectiveTemplateId = function (templateId) {
        if (!templateId) return null;
        var list = PM._attributeTemplateListCache || [];
        var fork = list.find(function (t) {
            var src = t.source_template_id != null ? t.source_template_id : t.sourceTemplateId;
            return src != null && String(src) === String(templateId);
        });
        if (fork) {
            return fork.template_id != null ? fork.template_id : fork.templateId;
        }
        return templateId;
    };

    PM.updateActiveTemplateNameLabel = function () {
        var label = document.getElementById('tm-variant-active-template-name');
        var sel = PM.el('detail-variant-template');
        if (!label || !sel) return;
        if (!sel.value) {
            label.textContent = '未选择模板，请点击「管理模板」';
            return;
        }
        var opt = sel.options[sel.selectedIndex];
        var name = opt ? opt.textContent : '';
        var effectiveId = PM.resolveEffectiveTemplateId(sel.value);
        if (effectiveId && String(effectiveId) !== String(sel.value)) {
            label.textContent = name.replace(' · 系统', '') + '（已定制）';
        } else {
            label.textContent = name || ('模板 #' + sel.value);
        }
    };

    PM.invalidateAttributeTemplateCache = function () {
        PM._attributeTemplateListCache = null;
        if (window.TM_MasterDataCache && typeof window.TM_MasterDataCache.invalidateTemplates === 'function') {
            window.TM_MasterDataCache.invalidateTemplates();
        }
    };

    PM.applySpuFlagsFromSpuDetail = function (spuDetail, productId) {
        if (!spuDetail) {
            PM.populateCapabilityForm({});
            return;
        }
        var spu = spuDetail.spu || {};
        var skus = spuDetail.skus || [];
        var hit = null;
        if (productId != null) {
            hit = skus.find(function (r) {
                var legacy = r.legacy_product_id != null ? r.legacy_product_id : r.legacyProductId;
                return legacy != null && String(legacy) === String(productId);
            });
        }
        if (!hit && skus.length) hit = skus[0];
        PM.currentProduct = PM.currentProduct || {};
        if (spu.spu_id != null || spu.spuId != null) {
            PM.currentProduct.spuId = spu.spu_id != null ? spu.spu_id : spu.spuId;
        }
        if (hit) {
            PM.currentProduct.skuId = hit.sku_id || hit.skuId;
        }
        var capHit = Object.assign({}, hit || {}, {
            track_variants: spu.track_variants != null ? spu.track_variants : spu.trackVariants,
            track_expiry: spu.track_expiry != null ? spu.track_expiry : spu.trackExpiry,
            track_serial: spu.track_serial != null ? spu.track_serial : spu.trackSerial,
            spu_id: PM.currentProduct.spuId,
            sku_id: PM.currentProduct.skuId
        });
        PM.populateCapabilityForm(capHit);
    };

    PM.loadSpuFlagsForProduct = function (productId) {
        if (!productId) {
            PM.populateCapabilityForm({});
            return Promise.resolve();
        }
        var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        if (spuId && window.TM_MasterDataCache) {
            return window.TM_MasterDataCache.getSpuDetail(spuId, null).then(function (detail) {
                PM.applySpuFlagsFromSpuDetail(detail, productId);
            }).catch(function () {
                PM.populateCapabilityForm({});
            });
        }
        return Promise.resolve(PM.populateCapabilityForm({}));
    };

    PM.resolveDefinitionEnumValues = function (def) {
        def = def || {};
        var values = def.enum_values || def.enumValues || def.enum_options || def.enumOptions || [];
        if (typeof values === 'string') {
            try { values = JSON.parse(values); } catch (e) { values = []; }
        }
        if (values && typeof values === 'object' && !Array.isArray(values)) {
            if (values.value != null) {
                try { values = JSON.parse(String(values.value)); } catch (e2) { values = []; }
            } else {
                values = [];
            }
        }
        if (Array.isArray(values) && values.length && typeof values[0] === 'object') {
            return values.map(function (o) {
                return o.enum_label || o.enumLabel || o.label || o.name || '';
            }).filter(Boolean);
        }
        if (!Array.isArray(values)) return [];
        return values.map(function (v) { return String(v); }).filter(function (s) { return s.length > 0; });
    };

    PM.getTemplateMatrixAttrNames = function () {
        var names = {};
        var box = PM.getVariantTemplateAttrsBox
            ? PM.getVariantTemplateAttrsBox()
            : PM.el('detail-variant-matrix');
        if (box) {
            box.querySelectorAll('.tm-matrix-val').forEach(function (cb) {
                var attr = cb.getAttribute('data-attr');
                if (attr) names[attr] = true;
            });
        }
        return names;
    };

    PM.syncCustomAttrsToMatrix = function () {
        var list = null;
        var modal = document.getElementById('product-variant-modal');
        if (modal && !modal.classList.contains('hidden')) {
            list = document.getElementById('tm-variant-modal-custom-list');
        }
        if (!list) list = PM.el('detail-custom-attrs-list');
        if (!list) return;
        var templateNames = PM.getTemplateMatrixAttrNames();
        var customRows = [];
        list.querySelectorAll('.tm-custom-attr-row').forEach(function (row) {
            var nameInp = row.querySelector('.tm-custom-attr-name');
            var valInp = row.querySelector('.tm-custom-attr-values');
            if (!nameInp || !valInp) return;
            var name = String(nameInp.value || '').trim();
            var vals = String(valInp.value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
            var commonCb = row.querySelector('.tm-custom-attr-common');
            customRows.push({
                name: name,
                values: vals,
                asCommon: false
            });
        });
        PM._customAttrRows = customRows;
        if (Object.keys(templateNames).length > 0) {
            Object.keys(PM._variantMatrixSelection || {}).forEach(function (k) {
                if (!templateNames[k]) delete PM._variantMatrixSelection[k];
            });
        }
        customRows.forEach(function (row) {
            if (!row.name || !row.values.length) return;
            PM._variantMatrixSelection[row.name] = row.values.slice();
        });
        if (typeof PM.updateVariantEntrySummary === 'function') {
            PM.updateVariantEntrySummary();
        }
    };

    PM.syncCustomAttrRowsFromDom = function (listEl) {
        var list = listEl || null;
        if (!list) {
            var modal = document.getElementById('product-variant-modal');
            if (modal && !modal.classList.contains('hidden')) {
                list = document.getElementById('tm-variant-modal-custom-list');
            }
        }
        if (!list) list = PM.el('detail-custom-attrs-list');
        if (!list) return;
        var rows = [];
        list.querySelectorAll('.tm-custom-attr-row').forEach(function (row) {
            var nameInp = row.querySelector('.tm-custom-attr-name');
            var valInp = row.querySelector('.tm-custom-attr-values');
            var name = nameInp ? String(nameInp.value || '').trim() : '';
            var vals = valInp
                ? String(valInp.value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean)
                : [];
            var commonCb = row.querySelector('.tm-custom-attr-common');
            rows.push({ name: name, values: vals, asCommon: false });
        });
        PM._customAttrRows = rows;
    };

    PM.renderCustomAttrRows = function () {
        var list = PM.el('detail-custom-attrs-list');
        if (!list) return;
        var rows = PM._customAttrRows || [];
        list.innerHTML = rows.map(function (row, idx) {
            return '<div class="tm-custom-attr-row rounded-lg border border-slate-100 p-2 space-y-1" data-idx="' + idx + '">'
                + '<div class="flex gap-2 items-center">'
                + '<input type="text" class="tm-custom-attr-name form-input flex-1 text-xs py-1.5" placeholder="规格名，如：图案" value="' + PM.escHtmlAttr(row.name || '') + '" />'
                + '<button type="button" class="tm-custom-attr-del text-[10px] text-red-400 px-1" data-idx="' + idx + '">删除</button>'
                + '</div>'
                + '<input type="text" class="tm-custom-attr-values form-input w-full text-xs py-1.5" placeholder="取值，逗号分隔，如：大猫,史努比" value="' + PM.escHtmlAttr((row.values || []).join(',')) + '" />'
                + '</div>';
        }).join('');
        list.querySelectorAll('.tm-custom-attr-name, .tm-custom-attr-values').forEach(function (inp) {
            inp.addEventListener('input', function () { PM.syncCustomAttrsToMatrix(); });
            inp.addEventListener('change', function () { PM.syncCustomAttrsToMatrix(); });
        });
        list.querySelectorAll('.tm-custom-attr-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-idx'), 10);
                if (!isNaN(i)) {
                    PM._customAttrRows.splice(i, 1);
                    PM.renderCustomAttrRows();
                    PM.syncCustomAttrsToMatrix();
                }
            });
        });
    };

    PM.addCustomAttrRow = function (name, values) {
        PM.syncCustomAttrRowsFromDom();
        PM._customAttrRows = PM._customAttrRows || [];
        PM._customAttrRows.push({ name: name || '', values: values || [], asCommon: false });
        PM.renderCustomAttrRows();
        PM.syncCustomAttrsToMatrix();
    };

    PM.bindCustomAttrHandlers = function () {
        var btn = PM.el('detail-add-custom-attr');
        if (!btn || btn.__tmCustomBound) return;
        btn.__tmCustomBound = true;
        btn.addEventListener('click', function () { PM.addCustomAttrRow('', []); });
    };

    PM.resetVariantMatrixUi = function () {
        PM._variantMatrixSelection = {};
        PM._customAttrRows = [];
        var box = PM.el('detail-variant-matrix');
        var list = PM.el('detail-custom-attrs-list');
        if (box) box.innerHTML = '';
        if (list) list.innerHTML = '';
        if (typeof PM.updateVariantEntrySummary === 'function') {
            PM.updateVariantEntrySummary();
        }
    };
    PM.loadVariantMatrixFromTemplate = function (templateId, opts) {
        opts = opts || {};
        if (templateId && PM.resolveEffectiveTemplateId) {
            templateId = PM.resolveEffectiveTemplateId(templateId) || templateId;
        }
        var panel = PM.el('product-variant-matrix-panel');
        var box = PM.el('detail-variant-matrix');
        if (!opts.preserve) {
            PM.resetVariantMatrixUi();
        }
        if (!templateId || !box) {
            if (panel) panel.classList.add('hidden');
            return Promise.resolve();
        }
        var forNewProduct = !PM.currentProduct || !(PM.currentProduct.id || PM.currentProduct.productId);
        var spuIdForTpl = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        var fetchDetail = function () {
            if (window.TM_MasterDataCache && window.TM_MasterDataCache.getTemplateDetail) {
                return window.TM_MasterDataCache.getTemplateDetail(templateId, {
                    forNewProduct: forNewProduct,
                    spuId: spuIdForTpl || null,
                    force: !!opts.force
                });
            }
            var qsParts = [];
            if (forNewProduct) qsParts.push('forNewProduct=true');
            if (spuIdForTpl) qsParts.push('spuId=' + encodeURIComponent(spuIdForTpl));
            var qs = qsParts.length ? ('?' + qsParts.join('&')) : '';
            var fetchFn = window.wrappedFetch || fetch;
            return fetchFn('/api/v1/rd/products/attribute-templates/' + templateId + qs, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }).then(function (r) { return r.json(); }).then(function (res) {
                return res && res.success ? (res.data || {}) : {};
            });
        };
        return fetchDetail().then(function (detail) {
            var defs = detail.definitions || [];
            if (panel) panel.classList.add('hidden');
            PM.bindCustomAttrHandlers();
            var templateNames = {};
            defs.forEach(function (def) {
                if (def && def.name) templateNames[String(def.name).trim()] = true;
            });
            if (!opts.preserve) {
                Object.keys(PM._variantMatrixSelection || {}).forEach(function (k) {
                    if (templateNames[k]) PM._variantMatrixSelection[k] = [];
                });
            }
            box.innerHTML = defs.map(function (def) {
                var name = def.name || '';
                var values = PM.resolveDefinitionEnumValues(def);
                if (!opts.preserve) {
                    PM._variantMatrixSelection[name] = [];
                } else if (!PM._variantMatrixSelection[name]) {
                    PM._variantMatrixSelection[name] = [];
                }
                return '<div class="rounded-lg border border-slate-100 p-2" data-attr="' + PM.escHtmlAttr(name) + '">'
                    + '<p class="font-bold text-slate-700 mb-1">' + PM.escHtmlText(name) + '</p>'
                    + (values.length
                        ? ('<div class="flex flex-wrap gap-2">' + values.map(function (v) {
                            return '<label class="inline-flex items-center gap-1 text-[11px]">'
                                + '<input type="checkbox" class="tm-matrix-val" data-attr="' + PM.escHtmlAttr(name) + '" value="' + PM.escHtmlAttr(String(v)) + '" /> '
                                + PM.escHtmlText(String(v)) + '</label>';
                        }).join('') + '</div>')
                        : ('<p class="text-[10px] text-slate-400">模板未配置取值，请在「管理模板」中补充</p>'))
                    + '</div>';
            }).join('') || '<p class="text-slate-400 text-xs">暂无模板属性，请点击「管理模板」配置</p>';
            box.querySelectorAll('.tm-matrix-val').forEach(function (cb) {
                var attr = cb.getAttribute('data-attr');
                if (!PM._variantMatrixSelection[attr]) PM._variantMatrixSelection[attr] = [];
                var arr = PM._variantMatrixSelection[attr];
                if (opts.preserve && arr.indexOf(cb.value) >= 0) {
                    cb.checked = true;
                }
                cb.addEventListener('change', function () {
                    if (!PM._variantMatrixSelection[attr]) PM._variantMatrixSelection[attr] = [];
                    arr = PM._variantMatrixSelection[attr];
                    var val = cb.value;
                    var idx = arr.indexOf(val);
                    if (cb.checked && idx < 0) arr.push(val);
                    if (!cb.checked && idx >= 0) arr.splice(idx, 1);
                    if (typeof PM.updateVariantEntrySummary === 'function') {
                        PM.updateVariantEntrySummary();
                    }
                    if (typeof PM.generateVariantCombos === 'function') {
                        PM.generateVariantCombos();
                    }
                });
            });
            if (typeof PM.updateVariantEntrySummary === 'function') {
                PM.updateVariantEntrySummary();
            }
            if (typeof PM.updateActiveTemplateNameLabel === 'function') {
                PM.updateActiveTemplateNameLabel();
            }
        }).catch(function () {
            if (panel) panel.classList.add('hidden');
        });
    };

    /** 规格弹窗未确认时的轻量 fallback；完整 skuCombos 由 tm-product-variant-modal.js 提供 */
    PM.buildVariantMatrixPayload = function () {
        var tv = PM.el('detail-track-variants');
        if (!tv || !tv.checked) return null;
        PM.syncCustomAttrsToMatrix();
        var tplSel = PM.el('detail-variant-template');
        var templateId = tplSel && tplSel.value ? parseInt(tplSel.value, 10) : null;
        var selected = PM._variantMatrixSelection || {};
        var filtered = {};
        Object.keys(selected).forEach(function (k) {
            if (selected[k] && selected[k].length) filtered[k] = selected[k].slice();
        });
        if (!Object.keys(filtered).length) return null;
        return { templateId: templateId || null, selectedValues: filtered };
    };

    PM.syncVariantMatrixPanelVisibility = function () {
        var tv = PM.el('detail-track-variants');
        var panel = PM.el('product-variant-matrix-panel');
        var openBtn = PM.el('detail-variant-open-btn');
        var summary = PM.el('detail-variant-entry-summary');
        if (panel) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
        }
        if (openBtn && tv) {
            var show = !!tv.checked;
            openBtn.classList.toggle('opacity-0', !show);
            openBtn.classList.toggle('pointer-events-none', !show);
            openBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
        if (summary && tv && !tv.checked) {
            summary.textContent = '未启用多规格';
        }
    };

    PM.syncExpiryPanelVisibility = function () {
        var te = PM.el('detail-track-expiry');
        var root = PM.getCapabilityFormRoot();
        var panel = root.querySelector('#product-expiry-config-panel') || document.getElementById('product-expiry-config-panel');
        var openBtn = PM.el('detail-expiry-open-btn');
        if (panel) {
            panel.classList.add('hidden');
            panel.classList.add('tm-expiry-config-store');
            panel.setAttribute('aria-hidden', 'true');
        }
        if (openBtn && te) {
            var show = !!te.checked;
            openBtn.classList.toggle('opacity-0', !show);
            openBtn.classList.toggle('pointer-events-none', !show);
            openBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
    };

    PM.expiryPolicyLabel = function (code) {
        return String(code || 'FEFO').toUpperCase() === 'FIFO' ? '先进先出' : '先到期先出';
    };

    PM.updateExpiryEntrySummary = function () {
        var el = PM.el('detail-expiry-entry-summary');
        if (!el) return;
        var te = PM.el('detail-track-expiry');
        var root = PM.getCapabilityFormRoot();
        var capSe = root.querySelector('#cap-summary-expiry') || document.getElementById('cap-summary-expiry');
        if (!te || !te.checked) {
            el.textContent = '未启用';
            if (capSe) capSe.textContent = '未启用';
            return;
        }
        var days = PM.el('detail-shelf-life-days');
        var policy = PM.el('detail-expiry-policy');
        var daysVal = days && days.value ? String(days.value).trim() : '';
        var policyVal = policy ? policy.value : 'FEFO';
        if (!daysVal) {
            el.textContent = '已启用，点击「编辑」配置保质期';
            if (capSe) capSe.textContent = '已启用';
            return;
        }
        var txt = '默认保质期 ' + daysVal + ' 天 · ' + PM.expiryPolicyLabel(policyVal);
        el.textContent = txt;
        if (capSe) capSe.textContent = '默认保质期 ' + daysVal + ' 天 · 按批次管理';
    };

    PM.openExpiryConfigModal = async function () {
        var te = PM.el('detail-track-expiry');
        if (!te || !te.checked) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请先勾选启用保质期管理', 'warning');
            }
            return;
        }
        var modal = document.getElementById('product-expiry-modal');
        if (!modal && typeof window.TM_syncProductCenterOverlays === 'function') {
            try {
                await window.TM_syncProductCenterOverlays();
            } catch (e) { /* ignore */ }
            modal = document.getElementById('product-expiry-modal');
        }
        if (!modal) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保质期配置弹窗未加载，请刷新页面后重试', 'warning');
            }
            return;
        }
        var days = PM.el('detail-shelf-life-days');
        var policy = PM.el('detail-expiry-policy');
        var modalDays = document.getElementById('tm-expiry-modal-days');
        var modalPolicy = document.getElementById('tm-expiry-modal-policy');
        if (modalDays) modalDays.value = days && days.value ? days.value : '';
        if (modalPolicy) modalPolicy.value = policy && policy.value ? policy.value : 'FEFO';
        if (typeof window.TM_openUnifiedModal === 'function') {
            window.TM_openUnifiedModal(modal, { variant: 'sheet' });
        } else {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
    };

    PM.closeExpiryConfigModal = function () {
        var modal = document.getElementById('product-expiry-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        if (typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        }
    };

    PM.confirmExpiryConfigModal = function () {
        var modalDays = document.getElementById('tm-expiry-modal-days');
        var modalPolicy = document.getElementById('tm-expiry-modal-policy');
        var daysVal = modalDays && modalDays.value ? parseInt(modalDays.value, 10) : NaN;
        if (!daysVal || isNaN(daysVal) || daysVal < 1) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请填写有效的默认保质期天数', 'error');
            }
            return;
        }
        var days = PM.el('detail-shelf-life-days');
        var policy = PM.el('detail-expiry-policy');
        if (days) days.value = String(daysVal);
        if (policy && modalPolicy) policy.value = modalPolicy.value || 'FEFO';
        PM._expiryConfigConfirmed = true;
        PM.updateExpiryEntrySummary();
        if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
        PM.closeExpiryConfigModal();
    };

    PM.bindExpiryModalTriggers = function () {
        var te = PM.el('detail-track-expiry');
        if (te && !te.dataset.tmExpiryModalBound) {
            te.dataset.tmExpiryModalBound = '1';
            te.addEventListener('change', function () {
                PM.syncExpiryPanelVisibility();
                PM.updateExpiryEntrySummary();
                if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
                if (!te.checked) PM._expiryConfigConfirmed = false;
            });
        }
        var openBtn = PM.el('detail-expiry-open-btn');
        if (openBtn && !openBtn.dataset.tmExpiryOpenBound) {
            openBtn.dataset.tmExpiryOpenBound = '1';
            openBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                if (typeof PM.openExpiryConfigModal === 'function') PM.openExpiryConfigModal();
            });
        }
    };

    PM.populateCapabilityForm = function (spu) {
        spu = spu || {};
        var tv = PM.el('detail-track-variants');
        var te = PM.el('detail-track-expiry');
        var ts = PM.el('detail-track-serial');
        var days = PM.el('detail-shelf-life-days');
        var policy = PM.el('detail-expiry-policy');
        var serialMode = PM.el('detail-serial-mode');
        if (tv) tv.checked = !!(spu.track_variants || spu.trackVariants);
        if (te) te.checked = !!(spu.track_expiry || spu.trackExpiry);
        if (ts) ts.checked = !!(spu.track_serial || spu.trackSerial);
        if (days) {
            var d = spu.default_shelf_life_days != null ? spu.default_shelf_life_days : spu.defaultShelfLifeDays;
            days.value = d != null ? String(d) : '';
            PM._expiryConfigConfirmed = d != null && String(d).trim() !== '';
        }
        if (policy) {
            policy.value = spu.expiry_policy || spu.expiryPolicy || 'FEFO';
        }
        if (serialMode) {
            serialMode.value = spu.serial_outbound_mode || spu.serialOutboundMode || 'STRICT';
        }
        if (typeof PM.syncCapabilitySummaries === 'function') {
            PM.syncCapabilitySummaries();
        }
        if (typeof PM.syncVariantMatrixPanelVisibility === 'function') {
            PM.syncVariantMatrixPanelVisibility();
        }
        if (typeof PM.syncExpiryPanelVisibility === 'function') {
            PM.syncExpiryPanelVisibility();
        }
        if (typeof PM.updateExpiryEntrySummary === 'function') {
            PM.updateExpiryEntrySummary();
        }
        if (typeof PM.updateVariantEntrySummary === 'function') {
            PM.updateVariantEntrySummary();
        }
    };

    PM.bindCapabilityFormEvents = function () {
        var formRoot = PM.getProductFormRoot();
        if (!formRoot || formRoot.dataset.tmCapBound === '1') return;
        formRoot.dataset.tmCapBound = '1';
        ['detail-track-variants', 'detail-track-expiry', 'detail-track-serial', 'detail-shelf-life-days'].forEach(function (id) {
            var el = PM.el(id);
            if (!el) return;
            el.addEventListener('change', function () {
                if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
                if (id === 'detail-track-variants' && typeof PM.syncVariantMatrixPanelVisibility === 'function') {
                    PM.syncVariantMatrixPanelVisibility();
                }
                if (id === 'detail-track-expiry') {
                    if (typeof PM.syncExpiryPanelVisibility === 'function') PM.syncExpiryPanelVisibility();
                    if (typeof PM.updateExpiryEntrySummary === 'function') PM.updateExpiryEntrySummary();
                }
            });
            el.addEventListener('input', function () {
                if (typeof PM.syncCapabilitySummaries === 'function') PM.syncCapabilitySummaries();
                if (id === 'detail-shelf-life-days' && typeof PM.updateExpiryEntrySummary === 'function') {
                    PM.updateExpiryEntrySummary();
                }
            });
        });
    };

    PM._productDetailSession = 0;
    PM._activeDetailSpuId = null;

    PM.bumpProductDetailSession = function (spuId) {
        PM._productDetailSession = (PM._productDetailSession || 0) + 1;
        PM._activeDetailSpuId = spuId != null ? spuId : null;
        return PM._productDetailSession;
    };

    PM.shouldApplyProductDetailLoad = function (session, spuId) {
        if (session != null && session !== PM._productDetailSession) return false;
        if (spuId != null && PM._activeDetailSpuId != null && String(spuId) !== String(PM._activeDetailSpuId)) {
            return false;
        }
        return true;
    };

    PM.resetProductMediaDraft = function () {
        PM._pendingMediaFiles = [];
        PM._coverMedia = null;
        PM._galleryMedia = [];
        PM._skuCoverCandidates = [];
        if (typeof PM.renderMediaGrid === 'function') PM.renderMediaGrid();
    };

    /** 关闭/切换产品时清空媒体与规格草稿，避免串图 */
    PM.resetProductDetailTransientState = function () {
        PM.resetProductMediaDraft();
        PM._variantComboDraft = [];
        PM._variantDraftSpuId = null;
        PM._variantMatrixConfirmed = false;
        PM._variantMatrixSelection = {};
        PM._customAttrRows = [];
        if (typeof PM.resetVariantMatrixUi === 'function') PM.resetVariantMatrixUi();
    };

    PM.normalizeMediaKey = function (item) {
        if (!item) return '';
        var url = item.url || '';
        if (url) return 'url:' + String(url).split('?')[0];
        if (item.mediaId != null) return 'mid:' + item.mediaId;
        return '';
    };

    PM.mediaDedupKeys = function (item) {
        var keys = [];
        var primary = PM.normalizeMediaKey(item);
        if (primary) keys.push(primary);
        if (item && item.mediaId != null) {
            var mid = 'mid:' + item.mediaId;
            if (keys.indexOf(mid) < 0) keys.push(mid);
        }
        return keys;
    };

    PM.isMediaShown = function (item, shownKeys) {
        return PM.mediaDedupKeys(item).some(function (k) { return !!shownKeys[k]; });
    };

    PM.markMediaShown = function (item, shownKeys) {
        PM.mediaDedupKeys(item).forEach(function (k) { shownKeys[k] = true; });
    };

    PM.syncSkuCoversFromVariantDraft = function () {
        var curSpuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        if (PM._variantDraftSpuId != null && curSpuId != null
                && String(PM._variantDraftSpuId) !== String(curSpuId)) {
            return;
        }
        var byKey = {};
        (PM._skuCoverCandidates || []).forEach(function (x) {
            if (!x || !x.url) return;
            var k = PM.normalizeMediaKey(x);
            if (k) byKey[k] = Object.assign({}, x);
        });
        (PM._variantComboDraft || []).forEach(function (row) {
            if (!row || row.enabled === false) return;
            var url = row.coverUrl || row.coverPreview;
            if (!url) return;
            var label = '';
            if (row.attrs && typeof row.attrs === 'object') {
                label = Object.keys(row.attrs).map(function (ak) { return row.attrs[ak]; }).join(' / ');
            }
            var k = PM.normalizeMediaKey({ url: url });
            if (!k) return;
            if (!byKey[k]) {
                byKey[k] = {
                    skuId: row.skuId,
                    url: url,
                    label: label || ('SKU#' + (row.skuId || ''))
                };
            } else {
                if (!byKey[k].skuId && row.skuId) byKey[k].skuId = row.skuId;
                if (!byKey[k].label && label) byKey[k].label = label;
            }
        });
        PM._skuCoverCandidates = Object.keys(byKey).map(function (k) { return byKey[k]; });
    };

    PM.countMediaSlots = function () {
        var pending = PM._pendingMediaFiles || [];
        var gallery = PM._galleryMedia || [];
        var coverSlot = PM._coverMedia || pending.length > 0 ? 1 : 0;
        var pendingGallery = PM._coverMedia ? pending.length : Math.max(0, pending.length - 1);
        return coverSlot + gallery.length + pendingGallery;
    };

    PM.ensureProductMediaBindings = function () {
        if (typeof PM.bindProductMediaEvents === 'function') PM.bindProductMediaEvents();
        if (typeof PM.renderMediaGrid === 'function') PM.renderMediaGrid();
    };

    PM.ensureProductFormMounted = async function () {
        var root = document.getElementById('product-detail-form-root');
        if (!root) return;
        if (window.TM_WorkbenchProfile && typeof window.TM_WorkbenchProfile.load === 'function') {
            await window.TM_WorkbenchProfile.load();
        }
        if (window.TmProductRegistry && window.TmProductRegistry.mount) {
            await window.TmProductRegistry.mount(root);
        }
        delete root.dataset.tmCapBound;
        var tvReset = root.querySelector('[id$="detail-track-variants"]');
        if (tvReset) delete tvReset.dataset.tmVarModalBound;
        var teReset = root.querySelector('[id$="detail-track-expiry"]');
        if (teReset) delete teReset.dataset.tmExpiryModalBound;
        var expiryBtnReset = root.querySelector('[id$="detail-expiry-open-btn"]');
        if (expiryBtnReset) delete expiryBtnReset.dataset.tmExpiryOpenBound;
        PM.bindCapabilityFormEvents();
        PM.bindCustomAttrHandlers();
        if (typeof PM.bindVariantModalTriggers === 'function') {
            PM.bindVariantModalTriggers();
        }
        if (typeof PM.bindExpiryModalTriggers === 'function') {
            PM.bindExpiryModalTriggers();
        }
        if (typeof PM.ensureProductMediaBindings === 'function') {
            PM.ensureProductMediaBindings();
        }
        if (typeof PM.loadProductCapabilities === 'function') {
            await PM.loadProductCapabilities();
        }
        PM.applyProductCapabilityVisibility();
        if (typeof PM.loadAttributeTemplates === 'function') {
            await PM.loadAttributeTemplates();
        }
        if (typeof PM.syncExpiryPanelVisibility === 'function') PM.syncExpiryPanelVisibility();
        if (typeof PM.updateExpiryEntrySummary === 'function') PM.updateExpiryEntrySummary();
    };

    PM.syncCapabilitySummaries = function () {
        var tv = PM.el('detail-track-variants');
        var te = PM.el('detail-track-expiry');
        var ts = PM.el('detail-track-serial');
        var root = PM.getCapabilityFormRoot();
        var sv = root.querySelector('#cap-summary-variants') || document.getElementById('cap-summary-variants');
        var se = root.querySelector('#cap-summary-expiry') || document.getElementById('cap-summary-expiry');
        var ss = root.querySelector('#cap-summary-serial') || document.getElementById('cap-summary-serial');
        if (sv) sv.textContent = tv && tv.checked ? '已启用多规格' : '未启用规格';
        if (typeof PM.updateExpiryEntrySummary === 'function') {
            PM.updateExpiryEntrySummary();
        } else if (se && te) {
            var days = PM.el('detail-shelf-life-days');
            se.textContent = te.checked
                ? '默认保质期 ' + ((days && days.value) || '—') + ' 天 · 按批次管理'
                : '未启用';
        }
        if (ss) ss.textContent = ts && ts.checked ? '已启用 · 入库/出库需扫码' : '未启用';
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
                '<input type="number" step="1" class="form-input font-mono text-right w-[6.5rem] py-1.5 text-xs detail-warehouse-stock-input" data-warehouse-id="' + PM.escHtmlAttr(String(wid)) + '" value="' + PM.escHtmlAttr(String(v)) + '" autocomplete="off" title="可为负（欠货）">' +
                '<span class="text-[10px] font-mono text-slate-500 whitespace-nowrap warehouse-stock-preview">' + PM.escHtmlText(base) + '</span>' +
                '</div></div>';
        }).join('');
        el.querySelectorAll('.warehouse-stock-row').forEach(function (row) {
            var inp = row.querySelector('.detail-warehouse-stock-input');
            var preview = row.querySelector('.warehouse-stock-preview');
            if (inp && preview) {
                inp.addEventListener('input', function () {
                    preview.textContent = PM.getBaseUnitLabel();
                    PM.syncTotalFromWarehouses();
                });
                inp.addEventListener('change', function () {
                    PM.syncTotalFromWarehouses();
                });
            }
        });
        PM.bindStockSyncHandlers();
    };

    PM.loadProductWarehouseStocks = async function (productId) {
        if (!productId) {
            var warehouses = await PM.loadWarehouses();
            PM.warehouses = Array.isArray(warehouses) ? warehouses : (PM.warehouses || []);
            var empty = PM.warehouses.map(function (w) {
                return { warehouseId: w.id, warehouseName: w.name, quantity: 0 };
            });
            PM.renderWarehouseStockSummary(empty);
            PM.bindStockSyncHandlers();
            return;
        }
        try {
            if (!PM.warehouses || !PM.warehouses.length) {
                var loaded = await PM.loadWarehouses();
                PM.warehouses = Array.isArray(loaded) ? loaded : (PM.warehouses || []);
            }
            var resp = await window.wrappedFetch('/api/v1/rd/products/' + productId + '/warehouse-stocks', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var list = data && data.data ? data.data : [];
            PM.warehouseStockDraft = list;
            var whSum = list.reduce(function (sum, w) {
                var q = w && w.quantity != null ? parseInt(w.quantity, 10) : 0;
                return sum + (isNaN(q) ? 0 : q);
            }, 0);
            var productStock = PM.currentProduct && PM.currentProduct.stock != null
                ? (parseInt(PM.currentProduct.stock, 10) || 0) : 0;
            // 禁止把产品总量静默灌入第一仓；分仓为真源，总量由分仓汇总
            if (whSum === 0 && productStock > 0) {
                console.warn('[ProductEnhance] 分仓库存均为 0，但产品总量为 ' + productStock
                    + '。请保存分仓或执行库存纠偏，不再自动写入第一仓。');
            }
            PM.renderWarehouseStockSummary(list);
            PM.bindStockSyncHandlers();
            // 有分仓数据（含负库存）即以分仓汇总为「当前库存总量」
            if (list.length) {
                PM.syncTotalFromWarehouses();
            } else {
                var stockInput = PM.el('detail-product-stock', 'product-stock-input');
                if (stockInput && (stockInput.value === '' || stockInput.value == null)) {
                    stockInput.value = String(productStock || 0);
                }
            }
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
        if (!container) {
            return false;
        }
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
        return true;
    };

    PM.rebuildPurchaseSalesUnitSelects = function (selectedPurchase, selectedSales) {
        var pu = PM.el('detail-product-purchase-unit', 'product-purchase-unit-select');
        var su = PM.el('detail-product-sales-unit', 'product-sales-unit-select');
        if (!pu || !su) return;

        var opts = PM.buildPurchaseUnitSelectOptions();

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

        if (!PM.readUnitModalInputsIntoDraft()) {
            notify('未找到单位换算表单，请关闭后重试', 'error');
            return;
        }
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
        if (!valid.length) {
            notify('请至少配置一条包装单位换算，或点击取消', 'error');
            return;
        }

        PM.unitConversionDraft = PM.normalizeUnitDraft(valid);
        if (PM.isAuditProductFormActive()) {
            PM.writeAuditDraftUnitConversions(valid);
        }
        if (PM.currentProduct) {
            PM.currentProduct.unitConversions = valid.map(function (c) {
                return { unitName: c.unitName, ratio: c.ratio };
            });
        }
        PM.rebuildPurchaseSalesUnitSelects(
            PM.el('detail-product-purchase-unit', 'product-purchase-unit-select') && PM.el('detail-product-purchase-unit', 'product-purchase-unit-select').value,
            PM.el('detail-product-sales-unit', 'product-sales-unit-select') && PM.el('detail-product-sales-unit', 'product-sales-unit-select').value
        );
        PM.closeUnitModal();
        var saveHint = PM.isAuditProductFormActive()
            ? '请点击「保存当前产品」将单位换算写入数据库'
            : '请点击产品「保存」将单位换算写入数据库';
        notify('单位换算已暂存。' + saveHint, 'success');
    };

    PM.openUnitModal = async function () {
        var pid = PM.currentProduct && (PM.currentProduct.id || PM.currentProduct.productId);
        if (pid && typeof PM.refreshUnitConversionDraftFromApi === 'function') {
            await PM.refreshUnitConversionDraftFromApi(pid);
        } else if (PM.isAuditProductFormActive && PM.isAuditProductFormActive() && window.auditState && window.auditState.newProductDrafts) {
            var idx = window.auditState.activeNewProductIndex || 0;
            var d = window.auditState.newProductDrafts[idx];
            var uc = d && (d.unit_conversions || d.unitConversions);
            if (Array.isArray(uc) && uc.length) {
                PM.syncDraftFromApiConversions(uc);
            }
        }
        PM.unitConversionDraft = PM.normalizeUnitDraft(PM.unitConversionDraft);
        PM.showFormErrors('unit-form-errors', []);
        var modal = document.getElementById('product-unit-modal');
        if (!modal) return;
        PM.renderUnitModalRows();
        if (typeof window.TM_openUnifiedModal === 'function') {
            window.TM_openUnifiedModal(modal, { variant: 'center' });
        } else {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            PM.lockBodyScroll(true);
        }
    };

    PM.closeUnitModal = function () {
        var modal = document.getElementById('product-unit-modal');
        if (!modal) return;
        if (typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            PM.lockBodyScroll(false);
        }
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
        PM.bindStockSyncHandlers();
    };

    PM.repopulateProductDetailForm = function (product) {
        if (!product) return;
        PM.populateCategorySelect(product.categoryId);
        PM.populateSupplierSelect(product.supplierId || product.supplier);
        PM.populateProductForm(product);
    };

    PM.loadProductPriceTrend = async function (productId) {
        var body = document.getElementById('product-price-trend-body');
        if (!body || !productId) return;
        body.innerHTML = '<p class="text-slate-400">加载中…</p>';
        try {
            var skuId = PM.currentProduct && (PM.currentProduct.skuId || PM.currentProduct.sku_id);
            if (!skuId) {
                body.innerHTML = '<p class="text-slate-400">暂无 SKU 关联，无法展示趋势</p>';
                return;
            }
            var resp = await window.wrappedFetch('/api/v1/rd/products/sku/' + skuId + '/purchase-price-trend', { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var points = data && data.data ? data.data : [];
            if (!Array.isArray(points) || !points.length) {
                body.innerHTML = '<p class="text-slate-400">暂无进货价记录</p>';
                return;
            }
            body.innerHTML = '<ul class="space-y-1">' + points.slice(0, 12).map(function (pt) {
                var dt = pt.date || pt.purchase_date || pt.purchaseDate || '—';
                var price = pt.price != null ? pt.price : (pt.unit_price || pt.unitPrice);
                return '<li class="flex justify-between font-mono"><span class="text-slate-500">' + PM.escHtmlText(String(dt).slice(0, 10)) + '</span><span class="text-brand-600">¥' + Number(price || 0).toFixed(2) + '</span></li>';
            }).join('') + '</ul>';
        } catch (e) {
            body.innerHTML = '<p class="text-red-400">加载失败</p>';
        }
    };

    var _openProductDetail = PM.openProductDetail;
    PM.openProductDetail = async function (productId) {
        var detailSession = PM.bumpProductDetailSession(null);
        if (typeof PM.resetProductDetailTransientState === 'function') {
            PM.resetProductDetailTransientState();
        }
        await PM.ensureProductFormMounted();
        var unitsPromise = PM.loadTenantUnitNames();
        await _openProductDetail.call(PM, productId);
        if (!PM.shouldApplyProductDetailLoad(detailSession, null)) return;
        PM.repopulateProductDetailForm(PM.currentProduct);
        PM.collapseAdvancedDrawer();
        var hint = PM.el('detail-sku-hint', 'detail-sku');
        var sku = PM.currentProduct && PM.currentProduct.sku;
        if (hint) hint.textContent = sku ? ('SKU: ' + sku) : '填写必填项即可保存';
        PM.bindStockSyncHandlers();

        var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        PM._activeDetailSpuId = spuId || null;
        var whStocksPromise = PM.loadProductWarehouseStocks(productId);
        var templatesPromise = PM.loadAttributeTemplates(false);
        await unitsPromise;
        if (!PM.shouldApplyProductDetailLoad(detailSession, spuId)) return;

        var spuDetail = null;
        if (spuId && window.TM_MasterDataCache) {
            spuDetail = await window.TM_MasterDataCache.getSpuDetail(spuId, null, true);
        }
        if (!PM.shouldApplyProductDetailLoad(detailSession, spuId)) return;

        await Promise.all([
            whStocksPromise,
            templatesPromise,
            spuId ? PM.loadProductMediaPreview(spuId, { spuDetail: spuDetail, session: detailSession }) : Promise.resolve()
        ]);
        if (!PM.shouldApplyProductDetailLoad(detailSession, spuId)) return;

        if (spuDetail) {
            PM.applySpuFlagsFromSpuDetail(spuDetail, productId);
            if (typeof PM.loadVariantDraftFromSpu === 'function') {
                await PM.loadVariantDraftFromSpu(spuId, {
                    cachedDetail: spuDetail,
                    skipTemplateFetch: true,
                    force: true,
                    session: detailSession
                });
            }
            // 多规格：详情「当前库存总量」与规格弹窗仓合计对齐
            if (typeof PM.syncVariantStockToMainForm === 'function' && PM._variantMatrixConfirmed) {
                PM.syncVariantStockToMainForm();
            }
        } else if (typeof PM.loadSpuFlagsForProduct === 'function') {
            await PM.loadSpuFlagsForProduct(productId);
        }
        if (!PM.shouldApplyProductDetailLoad(detailSession, spuId)) return;

        PM.applyProductCapabilityVisibility();
        if (typeof PM.applyDefaultIndustryTemplate === 'function') {
            PM.applyDefaultIndustryTemplate();
        }
        if (typeof PM.initProductPriceTrendLazy === 'function') {
            PM.initProductPriceTrendLazy(productId);
        } else if (typeof PM.loadProductPriceTrend === 'function') {
            PM.loadProductPriceTrend(productId);
        }
        if (typeof PM.syncVariantMatrixPanelVisibility === 'function') {
            PM.syncVariantMatrixPanelVisibility();
        }
        if (typeof PM.syncExpiryPanelVisibility === 'function') {
            PM.syncExpiryPanelVisibility();
        }
        if (typeof PM.updateVariantEntrySummary === 'function') {
            PM.updateVariantEntrySummary();
        }
        if (typeof PM.updateExpiryEntrySummary === 'function') {
            PM.updateExpiryEntrySummary();
        }
        if (typeof PM.syncSkuCoversFromVariantDraft === 'function') {
            PM.syncSkuCoversFromVariantDraft();
        }
        if (typeof PM.renderMediaGrid === 'function') {
            PM.renderMediaGrid();
        }
        if (typeof window.TM_openUnifiedModal !== 'function') {
            PM.lockBodyScroll(true);
        }
    };

    PM.initProductPriceTrendLazy = function (productId) {
        var body = document.getElementById('product-price-trend-body');
        if (!body) return;
        body.innerHTML = '<p class="text-slate-400 text-xs">展开高级选项查看进货价趋势</p>';
        var drawer = document.getElementById('product-advanced-drawer');
        if (!drawer || drawer.dataset.tmPriceTrendBound === '1') return;
        drawer.dataset.tmPriceTrendBound = '1';
        drawer.addEventListener('toggle', function () {
            if (drawer.open && typeof PM.loadProductPriceTrend === 'function') {
                PM.loadProductPriceTrend(productId);
            }
        });
    };

    var _openCreate = PM.openCreateProductModal;
    PM.openCreateProductModal = async function (prefill) {
        PM.bumpProductDetailSession(null);
        if (typeof PM.resetProductDetailTransientState === 'function') {
            PM.resetProductDetailTransientState();
        }
        await PM.ensureProductFormMounted();
        await _openCreate.call(PM);
        PM.currentProduct = {};
        PM._variantDraftSpuId = null;
        PM._variantComboDraft = [];
        PM._variantMatrixConfirmed = false;
        PM._customAttrRows = [];
        if (typeof PM.resetVariantMatrixUi === 'function') PM.resetVariantMatrixUi();
        if (typeof PM.resetProductMediaDraft === 'function') {
            PM.resetProductMediaDraft();
        }
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
        PM.bindStockSyncHandlers();
        PM.populateCapabilityForm({});
        if (typeof PM.loadAttributeTemplates === 'function') {
            await PM.loadAttributeTemplates();
        }
        PM.applyProductCapabilityVisibility();
        if (typeof PM.applyIndustryProductDefaults === 'function') {
            PM.applyIndustryProductDefaults();
        }
        if (typeof PM.syncExpiryPanelVisibility === 'function') PM.syncExpiryPanelVisibility();
        if (typeof PM.updateExpiryEntrySummary === 'function') PM.updateExpiryEntrySummary();
        PM._customAttrRows = [];
        PM._variantMatrixSelection = {};
        PM._variantComboDraft = [];
        PM._variantMatrixConfirmed = false;
        PM._variantDraftSpuId = null;
        var customList = document.getElementById('tm-variant-modal-custom-list');
        if (customList) customList.innerHTML = '';
        if (typeof window.TM_openUnifiedModal !== 'function') {
            PM.lockBodyScroll(true);
        }
    };

    var _closeDetail = PM.closeProductDetail;
    PM.closeProductDetail = function () {
        if (PM._saveInProgress) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('正在保存产品，请稍候…', 'warning');
            }
            return;
        }
        PM.bumpProductDetailSession(null);
        if (typeof PM.resetProductDetailTransientState === 'function') {
            PM.resetProductDetailTransientState();
        }
        _closeDetail.call(PM);
        if (typeof window.TM_closeUnifiedModal !== 'function') {
            PM.lockBodyScroll(false);
        }
        PM.showFormErrors('product-form-errors', []);
    };

    var _saveProduct = PM.saveProduct;
    PM.saveProduct = async function () {
        if (PM._saveInProgress) return;
        PM._saveInProgress = true;
        PM.showFormErrors('product-form-errors', []);
        if (!PM.validateProductForm()) {
            PM._saveInProgress = false;
            return;
        }
        if (!PM.currentProduct) {
            PM.currentProduct = {};
        }
        var pid = PM.currentProduct.id || PM.currentProduct.productId;
        var validUnitConv = PM.resolveUnitConversionsForSave();
        if (pid && !validUnitConv.length && typeof PM.refreshUnitConversionDraftFromApi === 'function') {
            await PM.refreshUnitConversionDraftFromApi(pid);
            validUnitConv = PM.resolveUnitConversionsForSave();
        }
        var built = PM.buildProductSaveBodyWithUnits(validUnitConv);
        if (built.error) {
            if (built.error !== '__validation__' && window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(built.error, 'error');
            }
            PM._saveInProgress = false;
            return;
        }
        var saveSucceeded = false;
        var savedProductIdForRefresh = null;
        try {
            if (window.checkAuth && !window.checkAuth()) {
                PM._saveInProgress = false;
                return;
            }
            if (typeof window.TM_refreshSubscriptionToken === 'function') {
                await window.TM_refreshSubscriptionToken();
            }
            if (window.TM_WorkbenchProfile && typeof window.TM_WorkbenchProfile.canMutate === 'function'
                    && !window.TM_WorkbenchProfile.canMutate()) {
                if (window.TM_SubscriptionNotice && typeof window.TM_SubscriptionNotice.promptBlocked === 'function') {
                    window.TM_SubscriptionNotice.promptBlocked('save_product');
                } else if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('当前订阅已过期，无法保存产品，请续费后重试', 'warning');
                    if (typeof window.openMemberModal === 'function') window.openMemberModal();
                }
                PM._saveInProgress = false;
                return;
            }
            var response = await window.wrappedFetch('/api/v1/rd/products/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(built.body)
            });
            if (!response.ok) {
                var errBody = await response.json().catch(function () { return {}; });
                var errMsg = (errBody && (errBody.message || errBody.error)) || ('保存失败 (' + response.status + ')');
                if (response.status === 403 && /订阅状态不允许|只读|READ_ONLY|BILLING_ONLY/i.test(errMsg)) {
                    if (window.TM_SubscriptionNotice && typeof window.TM_SubscriptionNotice.promptBlocked === 'function') {
                        window.TM_SubscriptionNotice.promptBlocked('save_product', { openRenew: true, delayModalMs: 400 });
                    } else if (typeof window.openMemberModal === 'function') {
                        window.openMemberModal();
                    }
                    errMsg = window.TM_SubscriptionNotice && window.TM_SubscriptionNotice.getBlockedMessage
                        ? window.TM_SubscriptionNotice.getBlockedMessage('save_product')
                        : '当前订阅状态暂不支持保存产品，请续费后重试';
                }
                PM.showFormErrors('product-form-errors', [errMsg]);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification(errMsg, 'error');
                }
                PM._saveInProgress = false;
                return;
            }
            var data = await window.handleApiResponse(response);
            if (!data) {
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('保存产品失败，请稍后重试', 'error');
                }
                PM._saveInProgress = false;
                return;
            }
            var savedRaw = data.data || {};
            var saved = typeof PM.unwrapSavePayload === 'function'
                ? PM.unwrapSavePayload(savedRaw) : savedRaw;
            saveSucceeded = true;
            PM.currentProduct = PM.currentProduct || {};
            if (saved.productId != null) {
                PM.currentProduct.id = saved.productId;
                savedProductIdForRefresh = saved.productId;
            }
            if (saved.id != null && savedProductIdForRefresh == null) {
                PM.currentProduct.id = saved.id;
                savedProductIdForRefresh = saved.id;
            }
            if (saved.spuId != null) {
                PM.currentProduct.spuId = saved.spuId;
            }
            if (saved.spu_id != null) {
                PM.currentProduct.spuId = saved.spu_id;
            }
            var spuIdForCover = PM.currentProduct.spuId || saved.spuId || saved.spu_id;
            var mappedEarly = typeof PM.mapProductFromApi === 'function' ? PM.mapProductFromApi(saved) : null;
            if (mappedEarly && mappedEarly.unitConversions && mappedEarly.unitConversions.length) {
                PM.currentProduct.unitConversions = mappedEarly.unitConversions;
                PM.syncDraftFromApiConversions(mappedEarly.unitConversions);
            } else if (built.body && built.body.unitConversions && built.body.unitConversions.length) {
                PM.currentProduct.unitConversions = built.body.unitConversions;
            }
            var mediaOk = true;
            if (spuIdForCover && typeof PM.uploadPendingMedia === 'function') {
                mediaOk = await PM.uploadPendingMedia(spuIdForCover);
            }
            if (spuIdForCover && typeof PM.uploadPendingSkuMedia === 'function') {
                var skuMediaOk = await PM.uploadPendingSkuMedia(spuIdForCover);
                mediaOk = mediaOk && skuMediaOk;
            }
            if (spuIdForCover && window.TM_MasterDataCache && typeof window.TM_MasterDataCache.invalidateSpu === 'function') {
                window.TM_MasterDataCache.invalidateSpu(spuIdForCover);
            }
            var freshSpuDetail = null;
            if (spuIdForCover && window.TM_MasterDataCache) {
                freshSpuDetail = await window.TM_MasterDataCache.getSpuDetail(spuIdForCover, null, true);
            }
            if (typeof PM.syncSkuCoversFromVariantDraft === 'function') {
                PM.syncSkuCoversFromVariantDraft();
            }
            if (spuIdForCover && typeof PM.loadProductMediaPreview === 'function') {
                await PM.loadProductMediaPreview(spuIdForCover, { spuDetail: freshSpuDetail });
            }
            if (spuIdForCover && typeof PM.loadVariantDraftFromSpu === 'function') {
                await PM.loadVariantDraftFromSpu(spuIdForCover);
            }
            if (window.TM_UI && window.TM_UI.showNotification) {
                var mediaErr = PM._lastMediaUploadErrors && PM._lastMediaUploadErrors[0];
                window.TM_UI.showNotification(
                    mediaOk ? '产品保存成功！' : ('产品已保存，但图片上传失败' + (mediaErr ? '：' + mediaErr : '，请重新打开编辑后重试')),
                    mediaOk ? 'success' : 'warning'
                );
            }
            if (typeof PM.auditSaveCallback === 'function') {
                var cb = PM.auditSaveCallback;
                PM.auditSaveCallback = null;
                cb(saved, built.body.product);
            } else {
                PM._saveInProgress = false;
                PM.closeProductDetail();
            }
            savedProductIdForRefresh = savedProductIdForRefresh != null
                ? savedProductIdForRefresh
                : (saved.productId != null ? saved.productId : saved.id);
        } catch (error) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存产品失败: ' + error.message, 'error');
            }
        } finally {
            PM._saveInProgress = false;
            if (saveSucceeded) {
                try {
                    if (typeof PM.invalidateProductListCache === 'function') PM.invalidateProductListCache();
                    if (window.TM_MasterDataCache) {
                        window.TM_MasterDataCache.invalidateAll();
                    }
                    if (typeof window.TM_notifyProductCatalogChanged === 'function') {
                        window.TM_notifyProductCatalogChanged();
                    }
                    if (typeof PM.loadProducts === 'function') {
                        await PM.loadProducts({
                            focusProductId: savedProductIdForRefresh,
                            resetPage: true,
                            force: true
                        });
                    }
                } catch (refreshErr) {
                    console.warn('[ProductEnhance] 保存后刷新列表失败', refreshErr);
                }
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

    PM.findProductById = function (productId) {
        return (PM.products || []).find(function (p) { return Number(p.id) === Number(productId); }) || null;
    };

    PM.findTransferStockBySkuKey = function (skuKey) {
        return (PM.sourceWarehouseProductStocks || []).find(function (s) {
            return PM.transferStockKey(s) === String(skuKey);
        }) || null;
    };

    PM.transferStockKey = function (stockItem) {
        if (!stockItem) return '';
        if (stockItem.skuId != null) return 'sku:' + stockItem.skuId;
        if (stockItem.sku_id != null) return 'sku:' + stockItem.sku_id;
        return 'product:' + stockItem.productId;
    };

    PM.unitToBaseRatio = function (stockItem, unit) {
        var u = String(unit || '').trim();
        var base = String((stockItem && (stockItem.baseUnit || stockItem.stockUnit)) || '').trim();
        if (!u) return 1;
        if (base && u.toLowerCase() === base.toLowerCase()) return 1;
        var convs = (stockItem && stockItem.unitConversions) || [];
        for (var i = 0; i < convs.length; i++) {
            var c = convs[i];
            var un = String((c && (c.unitName || c.unit_name)) || '').trim();
            var ratio = Number(c && (c.ratio != null ? c.ratio : c.perBase));
            if (un && u.toLowerCase() === un.toLowerCase() && ratio > 0) return ratio;
        }
        return 1;
    };

    PM.listTransferUnits = function (stockItem) {
        var units = [];
        var seen = {};
        function add(u) {
            var t = String(u || '').trim();
            if (!t || seen[t]) return;
            seen[t] = true;
            units.push(t);
        }
        if (!stockItem) return units;
        add(stockItem.purchaseUnit);
        add(stockItem.salesUnit);
        add(stockItem.baseUnit || stockItem.stockUnit);
        (stockItem.unitConversions || []).forEach(function (c) {
            add(c.unitName || c.unit_name);
        });
        return units;
    };

    /** 进货价按调货单位换算：purchasePrice * r(transferUnit) / r(purchasePriceUnit) */
    PM.resolveTransferUnitPrice = function (stockItem, transferUnit) {
        if (!stockItem) return 0;
        var unit = String(transferUnit || stockItem.purchaseUnit || stockItem.baseUnit || '').trim();
        var purchasePrice = Number(stockItem.purchasePrice);
        var priceUnit = String(stockItem.purchasePriceUnit || stockItem.purchaseUnit || stockItem.baseUnit || '').trim();
        if (!(purchasePrice > 0)) {
            purchasePrice = Number(stockItem.price) || 0;
            priceUnit = unit || priceUnit;
        }
        if (!(purchasePrice > 0)) {
            var prod = PM.findProductById(stockItem.productId);
            if (prod) {
                if (prod.purchasePrice != null && !isNaN(parseFloat(prod.purchasePrice))) {
                    purchasePrice = parseFloat(prod.purchasePrice);
                    priceUnit = String(prod.purchaseUnit || prod.baseUnit || priceUnit).trim();
                } else if (prod.costPrice != null && !isNaN(parseFloat(prod.costPrice))) {
                    purchasePrice = parseFloat(prod.costPrice);
                } else if (prod.price != null && !isNaN(parseFloat(prod.price))) {
                    purchasePrice = parseFloat(prod.price);
                    priceUnit = String(prod.salesUnit || prod.baseUnit || priceUnit).trim();
                }
            }
        }
        if (!(purchasePrice > 0)) return 0;
        var toRatio = PM.unitToBaseRatio(stockItem, unit);
        var fromRatio = PM.unitToBaseRatio(stockItem, priceUnit);
        if (!(toRatio > 0) || !(fromRatio > 0)) return Math.round(purchasePrice * 100) / 100;
        return Math.round(purchasePrice * toRatio / fromRatio * 100) / 100;
    };

    PM.maxTransferQtyForUnit = function (stockItem, unit) {
        var baseQty = Number(stockItem && stockItem.quantity) || 0;
        var ratio = PM.unitToBaseRatio(stockItem, unit);
        if (!(ratio > 0)) return baseQty;
        return Math.floor(baseQty / ratio);
    };

    PM.getTransferStockGroupKey = function (stockItem) {
        if (stockItem && stockItem.spuId != null) return 'spu:' + stockItem.spuId;
        var prod = stockItem && PM.findProductById(stockItem.productId);
        if (prod && prod.spuId != null) return 'spu:' + prod.spuId;
        return 'name:' + String((stockItem && (stockItem.spuName || stockItem.productName))
            || (prod && prod.name) || (stockItem && stockItem.productId) || '');
    };

    PM.getTransferSkuLabel = function (stockItem) {
        if (!stockItem) return '默认规格';
        var direct = stockItem.attributesDisplay || stockItem.attributes_display;
        if (direct != null && String(direct).trim()) return String(direct).trim();
        if (window.TM_ProductDomain && typeof window.TM_ProductDomain.formatSkuSpecLabel === 'function') {
            var formatted = window.TM_ProductDomain.formatSkuSpecLabel(stockItem);
            if (formatted != null && String(formatted).trim()) return String(formatted).trim();
        }
        return '默认规格';
    };

    PM.getTransferStockGroups = function () {
        var stocks = (PM.sourceWarehouseProductStocks || []).filter(function (s) {
            return (s.quantity || 0) > 0;
        });
        var map = {};
        stocks.forEach(function (s) {
            var key = PM.getTransferStockGroupKey(s);
            if (!map[key]) {
                map[key] = {
                    key: key,
                    label: String(s.spuName || s.productName || (PM.findProductById(s.productId) || {}).name || ('产品#' + s.productId)),
                    items: []
                };
            }
            map[key].items.push(s);
        });
        return Object.keys(map).map(function (k) { return map[k]; })
            .sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'zh'); });
    };

    PM.buildTransferRowFromStock = function (rowId, spuKey, stockItem) {
        var unit = String(stockItem.purchaseUnit || stockItem.baseUnit || stockItem.stockUnit || '').trim();
        var maxQty = PM.maxTransferQtyForUnit(stockItem, unit);
        var price = PM.resolveTransferUnitPrice(stockItem, unit);
        var qty = Math.min(1, maxQty);
        return {
            id: rowId,
            spuKey: spuKey || PM.getTransferStockGroupKey(stockItem),
            productId: stockItem.productId,
            skuId: stockItem.skuId != null ? stockItem.skuId : stockItem.sku_id,
            skuKey: PM.transferStockKey(stockItem),
            productName: stockItem.spuName || stockItem.productName || '',
            sku: stockItem.sku || '',
            unit: unit,
            baseUnit: stockItem.baseUnit || stockItem.stockUnit || '',
            availableBase: Number(stockItem.quantity) || 0,
            price: price,
            quantity: qty,
            total: price * qty,
            maxQty: maxQty,
            stockItem: stockItem
        };
    };

    PM.readTransferRowsFromDom = function () {
        var tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-row-id]').forEach(function (tr) {
            var rowId = parseInt(tr.getAttribute('data-row-id'), 10);
            var idx = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
            if (idx === -1) return;
            var spuSel = tr.querySelector('.transfer-spu-select');
            var skuSel = tr.querySelector('.transfer-sku-select');
            var unitSel = tr.querySelector('.transfer-unit-select');
            var priceInp = tr.querySelector('.transfer-price-input');
            var qtyInp = tr.querySelector('.transfer-qty-input');
            if (spuSel) PM.transferState.productRows[idx].spuKey = spuSel.value || '';
            if (skuSel && skuSel.value) {
                var stock = PM.findTransferStockBySkuKey(skuSel.value);
                if (stock) {
                    PM.transferState.productRows[idx].skuKey = skuSel.value;
                    PM.transferState.productRows[idx].productId = stock.productId;
                    PM.transferState.productRows[idx].skuId = stock.skuId != null ? stock.skuId : stock.sku_id;
                    PM.transferState.productRows[idx].stockItem = stock;
                    PM.transferState.productRows[idx].availableBase = Number(stock.quantity) || 0;
                }
            } else if (skuSel) {
                PM.transferState.productRows[idx].skuKey = '';
                PM.transferState.productRows[idx].productId = null;
                PM.transferState.productRows[idx].skuId = null;
            }
            if (unitSel) PM.transferState.productRows[idx].unit = unitSel.value || '';
            if (priceInp) PM.transferState.productRows[idx].price = parseFloat(priceInp.value) || 0;
            if (qtyInp) PM.transferState.productRows[idx].quantity = parseInt(qtyInp.value, 10) || 0;
            var maxAttr = qtyInp && qtyInp.getAttribute('max');
            if (maxAttr != null && maxAttr !== '') {
                PM.transferState.productRows[idx].maxQty = parseInt(maxAttr, 10) || 0;
            }
            PM.transferState.productRows[idx].total =
                PM.transferState.productRows[idx].price * PM.transferState.productRows[idx].quantity;
        });
    };

    PM.renderTransferProductList = function () {
        var tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;
        var groups = PM.getTransferStockGroups();
        tbody.innerHTML = PM.transferState.productRows.map(function (row) {
            var spuOpts = '<option value="">请选择产品</option>' + groups.map(function (g) {
                var sel = row.spuKey === g.key ? ' selected' : '';
                return '<option value="' + PM.escHtmlAttr(g.key) + '"' + sel + '>' +
                    PM.escHtmlText(g.label) + '</option>';
            }).join('');
            var group = groups.find(function (g) { return g.key === row.spuKey; });
            var skuItems = group ? group.items : [];
            var skuOpts = '<option value="">请选择规格</option>' + skuItems.map(function (p) {
                var key = PM.transferStockKey(p);
                var sel = row.skuKey === key ? ' selected' : '';
                var unitHint = p.baseUnit || p.stockUnit || '';
                var maxBase = p.quantity != null ? p.quantity : 0;
                return '<option value="' + PM.escHtmlAttr(key) + '" data-max-base="' + maxBase + '"' + sel + '>' +
                    PM.escHtmlText(PM.getTransferSkuLabel(p)) +
                    ' · 库存' + maxBase + (unitHint ? PM.escHtmlText(unitHint) : '') + '</option>';
            }).join('');
            var stock = row.stockItem || PM.findTransferStockBySkuKey(row.skuKey);
            var units = PM.listTransferUnits(stock);
            if (row.unit && units.indexOf(row.unit) < 0) units.unshift(row.unit);
            var unitOpts = units.map(function (u) {
                var sel = row.unit === u ? ' selected' : '';
                return '<option value="' + PM.escHtmlAttr(u) + '"' + sel + '>' + PM.escHtmlText(u) + '</option>';
            }).join('');
            if (!unitOpts) unitOpts = '<option value="">—</option>';
            var maxQty = row.maxQty != null ? row.maxQty : 0;
            var specLabel = row.skuKey
                ? PM.getTransferSkuLabel(stock || PM.findTransferStockBySkuKey(row.skuKey))
                : '选择规格';
            var specBtnClass = 'tm-po-spec-btn tm-transfer-spec-btn' + (row.skuKey ? ' is-selected' : '');
            var specDisabled = row.spuKey ? '' : ' disabled';
            return '<tr class="hover:bg-slate-50 transition-colors" data-row-id="' + row.id + '">' +
                '<td class="tm-transfer-td tm-transfer-td--product px-2 py-2"><select class="transfer-spu-select form-input w-full text-xs" onchange="window.ProductModule.handleTransferSpuSelect(' + row.id + ', this.value)">' + spuOpts + '</select></td>' +
                '<td class="tm-transfer-td tm-transfer-td--spec px-2 py-2">' +
                '<button type="button" class="' + specBtnClass + '"' + specDisabled +
                ' onclick="window.ProductModule.openTransferSpecPicker(' + row.id + ')">' +
                PM.escHtmlText(specLabel) + '</button>' +
                '<select class="transfer-sku-select hidden" aria-hidden="true" tabindex="-1">' + skuOpts + '</select></td>' +
                '<td class="tm-transfer-td tm-transfer-td--qty px-2 py-2"><input type="number" min="0" step="1" max="' + maxQty + '" class="transfer-qty-input tm-transfer-num-input form-input" value="' + (row.quantity || 0) + '" oninput="window.ProductModule.calculateRowTotal(' + row.id + ')" title="最多可调 ' + maxQty + '"></td>' +
                '<td class="tm-transfer-td tm-transfer-td--unit px-2 py-2"><select class="transfer-unit-select form-input w-full text-xs" onchange="window.ProductModule.handleTransferUnitChange(' + row.id + ', this.value)"' + (row.skuKey ? '' : ' disabled') + '>' + unitOpts + '</select></td>' +
                '<td class="tm-transfer-td tm-transfer-td--price px-2 py-2"><input type="number" min="0" step="0.01" class="transfer-price-input tm-transfer-num-input form-input" value="' + (row.price || 0).toFixed(2) + '" readonly title="按进货价×单位换算自动计算"></td>' +
                '<td class="tm-transfer-td tm-transfer-td--total px-2 py-2"><span class="transfer-row-total">' + (row.total || 0).toFixed(2) + '</span></td>' +
                '<td class="tm-transfer-td tm-transfer-td--action px-2 py-2"><button type="button" class="tm-transfer-row-delete" onclick="window.ProductModule.removeProductRow(' + row.id + ')" aria-label="删除行"><i class="ph ph-trash"></i></button></td>' +
                '</tr>';
        }).join('');
        PM.bindTransferVariantSheet();
        PM.calculateGrandTotal();
    };

    PM.bindTransferVariantSheet = function () {
        if (PM._transferVariantBound) return;
        var sheet = document.getElementById('tm-transfer-variant-sheet');
        if (!sheet) return;
        PM._transferVariantBound = true;
        var closeBtn = document.getElementById('tm-transfer-variant-close');
        var mask = document.getElementById('tm-transfer-variant-mask');
        var confirmBtn = document.getElementById('tm-transfer-variant-confirm');
        if (closeBtn) closeBtn.addEventListener('click', function () { PM.closeTransferVariantSheet(); });
        if (mask) mask.addEventListener('click', function () { PM.closeTransferVariantSheet(); });
        if (confirmBtn) confirmBtn.addEventListener('click', function () { PM.confirmTransferVariantSheet(); });
    };

    PM.closeTransferVariantSheet = function () {
        var sheet = document.getElementById('tm-transfer-variant-sheet');
        if (sheet) {
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
        }
        PM._transferVariantState = null;
    };

    PM.openTransferSpecPicker = function (rowId) {
        var row = (PM.transferState.productRows || []).find(function (r) { return r.id === rowId; });
        if (!row || !row.spuKey) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请先选择产品', 'warning');
            }
            return;
        }
        var group = PM.getTransferStockGroups().find(function (g) { return g.key === row.spuKey; });
        var items = group ? group.items : [];
        if (!items.length) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('该产品暂无可调规格', 'warning');
            }
            return;
        }
        if (items.length === 1) {
            PM.handleProductSelect(rowId, PM.transferStockKey(items[0]));
            return;
        }
        PM.bindTransferVariantSheet();
        var sheet = document.getElementById('tm-transfer-variant-sheet');
        var body = document.getElementById('tm-transfer-variant-body');
        if (!sheet || !body) return;
        PM._transferVariantState = {
            rowId: rowId,
            spuKey: row.spuKey,
            label: group ? group.label : '产品',
            items: items,
            selectedKey: row.skuKey || ''
        };
        PM.renderTransferVariantSheetBody();
        sheet.classList.remove('hidden');
        sheet.setAttribute('aria-hidden', 'false');
    };

    PM.renderTransferVariantSheetBody = function () {
        var body = document.getElementById('tm-transfer-variant-body');
        var st = PM._transferVariantState;
        if (!body || !st) return;
        var chips = (st.items || []).map(function (item) {
            var key = PM.transferStockKey(item);
            var on = st.selectedKey === key ? ' is-on' : '';
            var unitHint = item.baseUnit || item.stockUnit || '';
            var maxBase = item.quantity != null ? item.quantity : 0;
            var label = PM.getTransferSkuLabel(item) + ' · 库存' + maxBase + (unitHint || '');
            return '<button type="button" class="tm-po-spec-chip' + on + '" data-sku-key="' +
                PM.escHtmlAttr(key) + '">' + PM.escHtmlText(label) + '</button>';
        }).join('');
        body.innerHTML =
            '<div class="tm-po-variant-hero"><div class="tm-po-variant-hero__info">' +
            '<p class="tm-po-variant-hero__name">' + PM.escHtmlText(st.label || '产品') + '</p>' +
            '<p class="tm-po-variant-hero__price text-slate-500 text-xs mt-1">请选择规格</p></div></div>' +
            '<div class="tm-po-spec-group"><p class="tm-po-spec-group__label">规格</p>' +
            '<div class="tm-po-spec-chips">' + chips + '</div></div>';
        body.querySelectorAll('.tm-po-spec-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                if (!PM._transferVariantState) return;
                PM._transferVariantState.selectedKey = chip.getAttribute('data-sku-key') || '';
                PM.renderTransferVariantSheetBody();
            });
        });
    };

    PM.confirmTransferVariantSheet = function () {
        var st = PM._transferVariantState;
        if (!st || !st.rowId) {
            PM.closeTransferVariantSheet();
            return;
        }
        if (!st.selectedKey) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请选择规格', 'warning');
            }
            return;
        }
        var rowId = st.rowId;
        var skuKey = st.selectedKey;
        PM.closeTransferVariantSheet();
        PM.handleProductSelect(rowId, skuKey);
    };

    PM.handleTransferSpuSelect = function (rowId, spuKey) {
        var rowIndex = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
        if (rowIndex === -1) return;
        if (!spuKey) {
            PM.transferState.productRows[rowIndex] = {
                id: rowId, spuKey: '', productId: null, skuId: null, skuKey: '', productName: '',
                sku: '', unit: '', price: 0, quantity: 0, total: 0, maxQty: 0, availableBase: 0
            };
            PM.renderTransferProductList();
            return;
        }
        var group = PM.getTransferStockGroups().find(function (g) { return g.key === spuKey; });
        var items = group ? group.items : [];
        if (items.length === 1) {
            PM.transferState.productRows[rowIndex] = PM.buildTransferRowFromStock(rowId, spuKey, items[0]);
            PM.renderTransferProductList();
            return;
        }
        PM.transferState.productRows[rowIndex] = {
            id: rowId, spuKey: spuKey, productId: null, skuId: null, skuKey: '',
            productName: group ? group.label : '', sku: '', unit: '', price: 0, quantity: 0,
            total: 0, maxQty: 0, availableBase: 0
        };
        PM.renderTransferProductList();
        // 多规格：自动打开规格 sheet（对齐进货单据）
        setTimeout(function () { PM.openTransferSpecPicker(rowId); }, 0);
    };

    PM.handleProductSelect = function (rowId, skuKey) {
        var rowIndex = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
        if (rowIndex === -1) return;
        var prev = PM.transferState.productRows[rowIndex] || {};
        if (!skuKey) {
            PM.transferState.productRows[rowIndex] = {
                id: rowId,
                spuKey: prev.spuKey || '',
                productId: null,
                skuId: null,
                skuKey: '',
                productName: prev.productName || '',
                sku: '',
                unit: '',
                price: 0,
                quantity: 0,
                total: 0,
                maxQty: 0,
                availableBase: 0
            };
        } else {
            var p = PM.findTransferStockBySkuKey(skuKey);
            if (p) {
                PM.transferState.productRows[rowIndex] = PM.buildTransferRowFromStock(
                    rowId,
                    prev.spuKey || PM.getTransferStockGroupKey(p),
                    p
                );
            }
        }
        PM.renderTransferProductList();
    };

    PM.handleTransferUnitChange = function (rowId, unit) {
        var rowIndex = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
        if (rowIndex === -1) return;
        var row = PM.transferState.productRows[rowIndex];
        var stock = row.stockItem || PM.findTransferStockBySkuKey(row.skuKey);
        if (!stock) return;
        row.unit = unit || '';
        row.maxQty = PM.maxTransferQtyForUnit(stock, row.unit);
        row.price = PM.resolveTransferUnitPrice(stock, row.unit);
        if (row.quantity > row.maxQty) row.quantity = row.maxQty;
        if (row.quantity < 0) row.quantity = 0;
        row.total = row.price * row.quantity;
        PM.renderTransferProductList();
    };

    PM.calculateRowTotal = function (rowId) {
        var tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;
        var rowEl = tbody.querySelector('tr[data-row-id="' + rowId + '"]');
        if (!rowEl) return;
        var priceInput = rowEl.querySelector('.transfer-price-input');
        var qtyInput = rowEl.querySelector('.transfer-qty-input');
        var unitSel = rowEl.querySelector('.transfer-unit-select');
        var totalSpan = rowEl.querySelector('.transfer-row-total');
        var rowIndex = PM.transferState.productRows.findIndex(function (r) { return r.id === rowId; });
        var row = rowIndex >= 0 ? PM.transferState.productRows[rowIndex] : null;
        var stock = row && (row.stockItem || PM.findTransferStockBySkuKey(row.skuKey));
        var unit = unitSel ? unitSel.value : (row && row.unit) || '';
        var maxQ = 0;
        if (stock) {
            maxQ = PM.maxTransferQtyForUnit(stock, unit);
            if (priceInput && !priceInput.dataset.userEdited) {
                priceInput.value = PM.resolveTransferUnitPrice(stock, unit).toFixed(2);
            }
        } else if (row && row.maxQty != null) {
            maxQ = row.maxQty;
        } else if (qtyInput && qtyInput.getAttribute('max')) {
            maxQ = parseInt(qtyInput.getAttribute('max'), 10) || 0;
        }
        var price = parseFloat(priceInput && priceInput.value) || 0;
        var quantity = parseInt(qtyInput && qtyInput.value, 10) || 0;
        if (maxQ > 0 && quantity > maxQ) {
            quantity = maxQ;
            if (qtyInput) qtyInput.value = String(quantity);
        }
        if (quantity < 0) {
            quantity = 0;
            if (qtyInput) qtyInput.value = '0';
        }
        if (qtyInput) qtyInput.setAttribute('max', String(maxQ));
        var total = price * quantity;
        if (totalSpan) totalSpan.textContent = total.toFixed(2);
        if (rowIndex !== -1) {
            PM.transferState.productRows[rowIndex].unit = unit;
            PM.transferState.productRows[rowIndex].price = price;
            PM.transferState.productRows[rowIndex].quantity = quantity;
            PM.transferState.productRows[rowIndex].maxQty = maxQ;
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
    };

    PM.closeTransferModal = function () {
        var modal = document.getElementById('warehouse-transfer-modal');
        if (modal && typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else if (modal) {
            modal.classList.add('hidden');
        }
        PM.transferState = {
            sourceWarehouseId: null,
            sourceWarehouseName: '',
            targetWarehouseId: null,
            isVariablePrice: false,
            productRows: []
        };
        PM.sourceWarehouseProductStocks = [];
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
        var validRows = PM.transferState.productRows.filter(function (r) {
            return r.productId && r.quantity > 0;
        });
        if (!validRows.length) msgs.push('请至少选择一个规格并填写调拨数量');
        validRows.forEach(function (r) {
            var stock = r.stockItem || PM.findTransferStockBySkuKey(r.skuKey);
            var maxQ = stock ? PM.maxTransferQtyForUnit(stock, r.unit) : (r.maxQty || 0);
            if (maxQ > 0 && r.quantity > maxQ) {
                msgs.push((r.productName || '产品') + ' 调拨数量不能超过可调上限 ' + maxQ + (r.unit || ''));
            }
        });
        PM.showFormErrors('transfer-form-errors', msgs);
        if (msgs.length) return;

        var transferData = {
            sourceWarehouseId: PM.transferState.sourceWarehouseId,
            targetWarehouseId: parseInt(targetSelect.value, 10),
            isVariablePrice: false,
            items: validRows.map(function (r) {
                return {
                    productId: r.productId,
                    skuId: r.skuId != null ? r.skuId : null,
                    quantity: r.quantity,
                    unit: r.unit || '',
                    price: r.price
                };
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
            if (Array.isArray(val)) {
                if (val.length) base[key] = val;
            } else if (val != null && String(val).trim() !== '') {
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
        var orderLineUnit = '';
        if (window.auditState && window.auditState.aiStructured && window.auditState.aiStructured.order_data) {
            var items = window.auditState.aiStructured.order_data.items || [];
            var npName = String(np.name || np.product_name || '').trim();
            for (var li = 0; li < items.length; li++) {
                var it = items[li];
                var raw = String(it.product_name_raw || it.matched_product_name || '').trim();
                if (npName && raw === npName && it.unit) {
                    orderLineUnit = String(it.unit).trim();
                    break;
                }
            }
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
        set('detail-product-base-unit', orderLineUnit || np.base_unit || np.baseUnit || np.unit || '件');
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
        PM.bindStockSyncHandlers();
        if (stock != null && stock !== '' && parseInt(stock, 10) > 0) {
            PM.syncWarehousesFromTotal();
        }
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
        if (typeof PM.resetProductMediaDraft === 'function') {
            PM.resetProductMediaDraft();
        }
        if (typeof PM.ensureProductMediaBindings === 'function') {
            PM.ensureProductMediaBindings();
        }
        if (typeof PM.bindCapabilityFormEvents === 'function') {
            var formRoot = PM.getProductFormRoot && PM.getProductFormRoot();
            if (formRoot) delete formRoot.dataset.tmCapBound;
            PM.bindCapabilityFormEvents();
        }
        if (typeof PM.bindVariantModalTriggers === 'function') PM.bindVariantModalTriggers();
        if (typeof PM.bindExpiryModalTriggers === 'function') PM.bindExpiryModalTriggers();
        if (typeof PM.applyProductCapabilityVisibility === 'function') {
            PM.applyProductCapabilityVisibility();
        }
        if (typeof PM.applyIndustryProductDefaults === 'function') {
            PM.applyIndustryProductDefaults({ editMode: false });
        }
        if (typeof PM.syncVariantMatrixPanelVisibility === 'function') {
            PM.syncVariantMatrixPanelVisibility();
        }
        if (typeof PM.syncExpiryPanelVisibility === 'function') {
            PM.syncExpiryPanelVisibility();
        }
        if (typeof PM.syncCapabilitySummaries === 'function') {
            PM.syncCapabilitySummaries();
        }
        if (typeof PM.updateVariantEntrySummary === 'function') {
            PM.updateVariantEntrySummary();
        }
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
            var savedRaw = data.data || {};
            var saved = typeof PM.unwrapSavePayload === 'function'
                ? PM.unwrapSavePayload(savedRaw) : savedRaw;
            if (saved.productId != null) {
                PM.currentProduct = PM.currentProduct || {};
                PM.currentProduct.id = saved.productId;
                if (saved.spuId != null) PM.currentProduct.spuId = saved.spuId;
                var mapped = typeof PM.mapProductFromApi === 'function' ? PM.mapProductFromApi(saved) : null;
                if (mapped && mapped.unitConversions && mapped.unitConversions.length) {
                    PM.currentProduct.unitConversions = mapped.unitConversions;
                } else if (built.body && built.body.unitConversions && built.body.unitConversions.length) {
                    PM.currentProduct.unitConversions = built.body.unitConversions;
                }
            }
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('产品保存成功！', 'success');
            }
            if (typeof PM.auditSaveCallback === 'function') {
                var cb = PM.auditSaveCallback;
                PM.auditSaveCallback = null;
                await cb(saved, built.body.product);
            }
            await PM.loadProducts({ focusProductId: saved.productId, resetPage: true });
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

    async function refreshAuditProductWarehouses() {
        if (typeof PM.isAuditContextActive === 'function' && !PM.isAuditContextActive()) return;
        try {
            var warehouses = await PM.loadWarehouses();
            PM.warehouses = Array.isArray(warehouses) ? warehouses : (PM.warehouses || []);
            var pid = PM.currentProduct && (PM.currentProduct.id || PM.currentProduct.productId);
            await PM.loadProductWarehouseStocks(pid || null);
            var stockInput = PM.el('detail-product-stock', 'product-stock-input');
            if (stockInput && stockInput.value !== '' && parseInt(stockInput.value, 10) > 0) {
                PM.syncWarehousesFromTotal();
            }
        } catch (e) { /* ignore */ }
    }

    window.addEventListener('tm-warehouses-changed', function () {
        refreshAuditProductWarehouses();
    });
    window.addEventListener('message', function (ev) {
        if (ev && ev.data && ev.data.type === 'TM_WAREHOUSES_CHANGED') {
            refreshAuditProductWarehouses();
        }
    });

    var _origInit = PM.init;
    PM.init = async function () {
        await Promise.all([
            typeof _origInit === 'function' ? _origInit.apply(this, arguments) : Promise.resolve(),
            typeof PM.loadProductCapabilities === 'function' ? PM.loadProductCapabilities() : Promise.resolve()
        ]);
    };

    PM._pendingMediaFiles = [];
    PM._coverMedia = null;
    PM._galleryMedia = [];
    PM._mediaFormRoot = null;
    PM._mediaClickHandler = null;
    PM._mediaChangeHandler = null;

    PM.unbindProductMediaEvents = function () {
        if (PM._mediaFormRoot && PM._mediaClickHandler) {
            PM._mediaFormRoot.removeEventListener('click', PM._mediaClickHandler);
        }
        if (PM._mediaFormRoot && PM._mediaChangeHandler) {
            PM._mediaFormRoot.removeEventListener('change', PM._mediaChangeHandler);
        }
        PM._mediaFormRoot = null;
        PM._mediaClickHandler = null;
        PM._mediaChangeHandler = null;
    };

    PM.bindProductMediaEvents = function () {
        var root = PM.getProductFormRoot();
        if (!root) return;
        if (PM._mediaFormRoot === root && PM._mediaClickHandler) return;
        PM.unbindProductMediaEvents();
        PM._mediaFormRoot = root;
        PM._mediaClickHandler = function (e) {
            var addBtn = e.target.closest('.tm-media-add-btn');
            if (addBtn) {
                e.preventDefault();
                e.stopPropagation();
                var input = PM.el('detail-product-media-input');
                if (input) input.click();
                return;
            }
            var delBtn = e.target.closest('.tm-media-del');
            if (delBtn) {
                e.preventDefault();
                e.stopPropagation();
                PM.removeMediaItem(
                    delBtn.getAttribute('data-kind'),
                    delBtn.getAttribute('data-id'),
                    delBtn.getAttribute('data-pending-idx'),
                    delBtn.getAttribute('data-sku-media') === '1');
            }
        };
        PM._mediaChangeHandler = function (e) {
            var t = e.target;
            if (!t || !t.id || t.id.indexOf('detail-product-media-input') === -1) return;
            PM.handleMediaFilesSelected(t).finally(function () { t.value = ''; });
        };
        root.addEventListener('click', PM._mediaClickHandler);
        root.addEventListener('change', PM._mediaChangeHandler);
    };

    PM.compressMediaFile = async function (file) {
        if (!file) return file;
        var aiSvc = window.TM_AIService;
        try {
            if (aiSvc && typeof aiSvc.compressForOrderUpload === 'function') {
                return await aiSvc.compressForOrderUpload(file);
            }
            if (aiSvc && typeof aiSvc.compressImageIfNeeded === 'function') {
                return await aiSvc.compressImageIfNeeded(file, { maxBytes: 1800 * 1024 });
            }
        } catch (e) {
            console.warn('[ProductEnhance] 图片压缩失败，使用原图', e);
        }
        return file;
    };

    PM.handleMediaFilesSelected = async function (input) {
        if (!input.files || !input.files.length) return;
        PM._pendingMediaFiles = PM._pendingMediaFiles || [];
        var maxAdd = Math.max(0, 9 - PM.countMediaSlots());
        var added = 0;
        for (var i = 0; i < input.files.length && i < maxAdd; i++) {
            var compressed = await PM.compressMediaFile(input.files[i]);
            PM._pendingMediaFiles.push(compressed);
            added++;
        }
        if (input.files.length > maxAdd && window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification('最多 9 张图片（首张为主图）', 'warning');
        }
        PM.renderMediaGrid();
        if (added > 0 && window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification('已添加 ' + added + ' 张图片（保存后上传）', 'success');
        }
    };

    PM.removeMediaItem = function (kind, id, pendingIdx, skuMedia) {
        if (kind === 'pending') {
            var idx = parseInt(pendingIdx, 10);
            if (!isNaN(idx) && PM._pendingMediaFiles) {
                PM._pendingMediaFiles.splice(idx, 1);
                PM.renderMediaGrid();
            }
            return;
        }
        if (!id || !window.wrappedFetch) return;
        var mediaId = parseInt(id, 10);
        if (isNaN(mediaId)) return;
        var qs = skuMedia ? '?skuMedia=true' : '';
        window.wrappedFetch('/api/v1/rd/products/media/' + mediaId + qs, { method: 'DELETE' }).then(async function () {
            if (kind === 'cover') PM._coverMedia = null;
            else if (kind === 'sku') {
                PM._skuCoverCandidates = (PM._skuCoverCandidates || []).filter(function (x) {
                    return x.mediaId !== mediaId;
                });
            } else {
                PM._galleryMedia = (PM._galleryMedia || []).filter(function (x) {
                    return x.mediaId !== mediaId;
                });
            }
            PM.renderMediaGrid();
            var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
            if (spuId && window.TM_MasterDataCache) {
                window.TM_MasterDataCache.invalidateSpu(spuId);
            }
            if (typeof window.TM_notifyProductCatalogChanged === 'function') {
                window.TM_notifyProductCatalogChanged();
            }
            if (typeof PM.loadProducts === 'function') {
                await PM.loadProducts({ force: true });
            }
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('图片已删除', 'success');
            }
        }).catch(function (e) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(e.message || '删除图片失败', 'error');
            }
        });
    };

    PM.renderMediaGrid = function () {
        var hasVariantDraft = PM._variantComboDraft && PM._variantComboDraft.length;
        if (hasVariantDraft && typeof PM.syncSkuCoversFromVariantDraft === 'function') {
            PM.syncSkuCoversFromVariantDraft();
        }
        var box = PM.el('detail-product-media-grid');
        if (!box) return;
        var html = '';
        var pending = PM._pendingMediaFiles || [];
        var pendingIdx = 0;
        var skuCovers = PM._skuCoverCandidates || [];
        var curSpuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        if (hasVariantDraft && PM._variantDraftSpuId != null && curSpuId != null
                && String(PM._variantDraftSpuId) === String(curSpuId)) {
            var allowedSkuIds = {};
            (PM._variantComboDraft || []).forEach(function (row) {
                if (row && row.enabled !== false && row.skuId != null) {
                    allowedSkuIds[String(row.skuId)] = true;
                }
            });
            if (Object.keys(allowedSkuIds).length) {
                skuCovers = skuCovers.filter(function (item) {
                    return !item.skuId || allowedSkuIds[String(item.skuId)];
                });
            }
        } else if (PM._variantDraftSpuId != null && curSpuId != null
                && String(PM._variantDraftSpuId) !== String(curSpuId)) {
            skuCovers = [];
        }
        var shownKeys = {};
        var hasSpuMedia = !!(PM._coverMedia && PM._coverMedia.url) ||
            (PM._galleryMedia && PM._galleryMedia.length) ||
            pending.length;
        var showSkuThumbs = hasVariantDraft && !hasSpuMedia;

        function markShown(item) {
            PM.markMediaShown(item, shownKeys);
        }

        function isShown(item) {
            return PM.isMediaShown(item, shownKeys);
        }

        function thumbWrap(inner, badge, kind, id, pIdx, skuMedia) {
            var del = '<button type="button" class="tm-media-del absolute top-0 right-0 z-10 w-5 h-5 flex items-center justify-center bg-black/60 text-white text-xs leading-none rounded-bl" data-kind="'
                + PM.escHtmlAttr(kind) + '" data-id="' + PM.escHtmlAttr(String(id || '')) + '" data-pending-idx="'
                + PM.escHtmlAttr(String(pIdx != null ? pIdx : '')) + '" data-sku-media="'
                + (skuMedia ? '1' : '0') + '" aria-label="删除图片">×</button>';
            var tag = badge ? ('<span class="absolute bottom-0 inset-x-0 bg-brand-600/90 text-white text-[8px] text-center">' + badge + '</span>') : '';
            return '<div class="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-100 shrink-0">' + inner + tag + del + '</div>';
        }

        if (PM._coverMedia && PM._coverMedia.url) {
            html += thumbWrap('<img src="' + PM.escHtmlAttr(PM._coverMedia.url) + '" class="w-full h-full object-cover" alt="" />', '主图', 'cover', PM._coverMedia.mediaId, null);
            markShown(PM._coverMedia);
        } else if (pending.length) {
            html += thumbWrap('<img src="' + URL.createObjectURL(pending[0]) + '" class="w-full h-full object-cover opacity-90" alt="" />', '主图', 'pending', null, 0);
            pendingIdx = 1;
        } else if (showSkuThumbs && skuCovers.length) {
            var firstSku = skuCovers[0];
            html += thumbWrap('<img src="' + PM.escHtmlAttr(firstSku.url) + '" class="w-full h-full object-cover" alt="" />', 'SKU', 'sku', firstSku.mediaId, null, true);
            markShown(firstSku);
        }

        (PM._galleryMedia || []).forEach(function (item) {
            if (isShown(item)) return;
            html += thumbWrap('<img src="' + PM.escHtmlAttr(item.url) + '" class="w-full h-full object-cover" alt="" />', '', 'gallery', item.mediaId, null);
            markShown(item);
        });

        for (var i = pendingIdx; i < pending.length; i++) {
            html += thumbWrap('<img src="' + URL.createObjectURL(pending[i]) + '" class="w-full h-full object-cover opacity-90" alt="" />', '待传', 'pending', null, i);
        }

        skuCovers.forEach(function (item) {
            if (!showSkuThumbs || !item.url || isShown(item)) return;
            if (item.mediaId) {
                html += thumbWrap(
                    '<img src="' + PM.escHtmlAttr(item.url) + '" class="w-full h-full object-cover" alt="" />',
                    'SKU',
                    'sku',
                    item.mediaId,
                    null,
                    true
                );
            } else {
                html += '<button type="button" class="tm-sku-cover-pick relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 border-slate-100 hover:border-brand-300" data-sku-id="'
                    + PM.escHtmlAttr(String(item.skuId || '')) + '" title="' + PM.escHtmlAttr(item.label || '') + '">'
                    + '<img src="' + PM.escHtmlAttr(item.url) + '" class="w-full h-full object-cover" alt="" />'
                    + '<span class="absolute bottom-0 inset-x-0 bg-slate-700/85 text-white text-[7px] text-center">SKU</span>'
                    + '</button>';
            }
            markShown(item);
        });

        if (PM.countMediaSlots() < 9) {
            html += '<button type="button" class="tm-media-add-btn w-14 h-14 rounded-lg border border-dashed border-brand-200 text-brand-500 flex items-center justify-center hover:bg-brand-50 shrink-0" title="添加图片"><i class="ph ph-plus text-lg"></i></button>';
        }
        if (!html) {
            html = '<button type="button" class="tm-media-add-btn w-14 h-14 rounded-lg border border-dashed border-brand-200 text-brand-500 flex items-center justify-center hover:bg-brand-50 shrink-0" title="添加图片"><i class="ph ph-plus text-lg"></i></button>'
                + '<span class="text-[10px] text-slate-400 self-center">点击 + 添加图片</span>';
        }
        box.innerHTML = html;
        box.querySelectorAll('.tm-sku-cover-pick').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var skuId = parseInt(btn.getAttribute('data-sku-id'), 10);
                var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
                if (spuId && skuId && typeof PM.setSpuCoverFromSku === 'function') {
                    PM.setSpuCoverFromSku(spuId, skuId);
                }
            });
        });
    };

    PM.loadProductMediaPreview = async function (spuId, opts) {
        opts = opts || {};
        var session = opts.session != null ? opts.session : PM._productDetailSession;
        if (!spuId || !window.wrappedFetch) {
            if (PM.shouldApplyProductDetailLoad(session, spuId)) {
                PM._coverMedia = null;
                PM._galleryMedia = [];
                PM._pendingMediaFiles = [];
                PM._skuCoverCandidates = [];
                PM.renderMediaGrid();
            }
            return;
        }
        var spuMediaPromise = window.wrappedFetch('/api/v1/rd/products/media/spu/' + spuId, { method: 'GET' })
            .then(function (resp) { return window.handleApiResponse(resp); })
            .catch(function () { return null; });
        var skuMediaPromise = window.wrappedFetch('/api/v1/rd/products/media/spu/' + spuId + '/skus', { method: 'GET' })
            .then(function (resp) { return window.handleApiResponse(resp); })
            .catch(function () { return null; });

        var results = await Promise.all([spuMediaPromise, skuMediaPromise]);
        if (!PM.shouldApplyProductDetailLoad(session, spuId)) return;

        PM._coverMedia = null;
        PM._galleryMedia = [];
        PM._pendingMediaFiles = [];
        PM._skuCoverCandidates = [];
        try {
            var items = results[0] && results[0].data ? results[0].data : (Array.isArray(results[0]) ? results[0] : []);
            (Array.isArray(items) ? items : []).forEach(function (m) {
                var type = (m.mediaType || m.media_type || '').toUpperCase();
                var mid = m.media_id != null ? m.media_id : m.mediaId;
                var row = { url: m.url, mediaId: mid };
                if (type === 'COVER') PM._coverMedia = row;
                else if (type === 'GALLERY') PM._galleryMedia.push(row);
            });
            if (!PM._coverMedia && PM._galleryMedia.length) {
                PM._coverMedia = PM._galleryMedia.shift();
            }
        } catch (e) {
            console.warn('[ProductEnhance] 图片加载失败', e);
        }
        try {
            var skuMediaItems = results[1] && results[1].data ? results[1].data : [];
            var hasSpuLevel = PM._coverMedia || (PM._galleryMedia && PM._galleryMedia.length);
            if (!hasSpuLevel) {
                var seenKeys = {};
                function markSeen(item) {
                    PM.mediaDedupKeys(item).forEach(function (k) { seenKeys[k] = true; });
                }
                function isSeen(item) {
                    return PM.mediaDedupKeys(item).some(function (k) { return !!seenKeys[k]; });
                }
                (Array.isArray(skuMediaItems) ? skuMediaItems : []).forEach(function (m) {
                    var url = m.url;
                    var sid = m.sku_id || m.skuId;
                    var mid = m.media_id != null ? m.media_id : m.mediaId;
                    if (!url || !sid) return;
                    var row = {
                        skuId: sid,
                        mediaId: mid,
                        url: url,
                        label: (m.attributes_display || m.attributesDisplay || '') || ('SKU#' + sid)
                    };
                    if (isSeen(row)) return;
                    markSeen(row);
                    PM._skuCoverCandidates.push(row);
                });
            }
        } catch (e) {
            console.warn('[ProductEnhance] SKU 媒体列表加载失败', e);
        }
        try {
            var detail = opts.spuDetail;
            if (!detail && window.TM_MasterDataCache) {
                detail = await window.TM_MasterDataCache.getSpuDetail(spuId, null);
            }
            if (!PM.shouldApplyProductDetailLoad(session, spuId)) return;
            if (!PM._coverMedia && !(PM._galleryMedia && PM._galleryMedia.length)) {
                var skus = detail && detail.skus ? detail.skus : [];
                var seen = {};
                PM._skuCoverCandidates.forEach(function (item) {
                    PM.mediaDedupKeys(item).forEach(function (k) { seen[k] = true; });
                });
                skus.forEach(function (sku) {
                    var url = sku.coverUrl || sku.cover_url;
                    if (!url) return;
                    var draft = {
                        url: url,
                        skuId: sku.skuId || sku.sku_id,
                        mediaId: sku.coverMediaId || sku.cover_media_id || null
                    };
                    if (PM.mediaDedupKeys(draft).some(function (k) { return !!seen[k]; })) return;
                    PM.mediaDedupKeys(draft).forEach(function (k) { seen[k] = true; });
                    var label = sku.attributesDisplay || sku.attributes_display || '';
                    if (!label && sku.attributes && typeof sku.attributes === 'object') {
                        label = Object.keys(sku.attributes).map(function (k) { return sku.attributes[k]; }).join(' / ');
                    }
                    PM._skuCoverCandidates.push({
                        skuId: sku.skuId || sku.sku_id,
                        url: url,
                        mediaId: draft.mediaId,
                        label: label || ('SKU#' + (sku.skuId || sku.sku_id))
                    });
                });
            }
        } catch (e) {
            console.warn('[ProductEnhance] SKU 图片加载失败', e);
        }
        PM.renderMediaGrid();
    };

    PM.setSpuCoverFromSku = async function (spuId, skuId) {
        if (!spuId || !skuId || !window.wrappedFetch) return false;
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/media/spu/' + spuId + '/cover-from-sku/' + skuId, { method: 'POST' });
            var data = await window.handleApiResponse(resp);
            if (data && data.success !== false) {
                await PM.loadProductMediaPreview(spuId);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('已设为 SPU 主图', 'success');
                }
                return true;
            }
        } catch (e) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('设置主图失败', 'error');
            }
        }
        return false;
    };

    PM.uploadPendingMedia = async function (spuId) {
        var pending = (PM._pendingMediaFiles || []).slice();
        if (!spuId || !pending.length || !window.wrappedFetch) return true;
        var uploadErrors = [];

        async function doUpload(file, mediaType) {
            if (!file || !file.size) {
                uploadErrors.push('上传文件为空');
                return false;
            }
            var fd = new FormData();
            fd.append('file', file);
            fd.append('spuId', String(spuId));
            fd.append('mediaType', mediaType);
            try {
                var resp = await window.wrappedFetch('/api/v1/rd/products/media/upload', { method: 'POST', body: fd });
                var body = await resp.json().catch(function () { return {}; });
                if (resp.ok && body && body.success !== false) {
                    return true;
                }
                var errMsg = (body && body.message) || ('上传失败 (' + resp.status + ')');
                if (resp.status === 413) {
                    errMsg = '图片过大，单张请不超过 5MB';
                }
                uploadErrors.push(errMsg);
                return false;
            } catch (e) {
                uploadErrors.push(e && e.message ? e.message : '上传失败');
                return false;
            }
        }

        var allOk = true;
        if (!PM._coverMedia && pending.length) {
            allOk = await doUpload(pending.shift(), 'COVER') && allOk;
        }
        for (var i = 0; i < pending.length; i++) {
            allOk = await doUpload(pending[i], 'GALLERY') && allOk;
        }
        PM._lastMediaUploadErrors = uploadErrors;
        if (allOk) {
            PM._pendingMediaFiles = [];
        }
        await PM.loadProductMediaPreview(spuId);
        return allOk;
    };

    PM.loadProductCoverPreview = async function () {
        var spuId = PM.currentProduct && (PM.currentProduct.spuId || PM.currentProduct.spu_id);
        await PM.loadProductMediaPreview(spuId || null);
        if (typeof PM.syncVariantMatrixPanelVisibility === 'function') {
            PM.syncVariantMatrixPanelVisibility();
        }
        if (typeof PM.syncExpiryPanelVisibility === 'function') {
            PM.syncExpiryPanelVisibility();
        }
    };

    window.openProductExpiryModal = function () {
        if (PM.openExpiryConfigModal) PM.openExpiryConfigModal();
    };
    window.closeProductExpiryModal = function () {
        if (PM.closeExpiryConfigModal) PM.closeExpiryConfigModal();
    };
    window.confirmProductExpiryModal = function () {
        if (PM.confirmExpiryConfigModal) PM.confirmExpiryConfigModal();
    };

    if (typeof window.TM_bindProductCenterGlobalFns === 'function') {
        var _bindPcFns = window.TM_bindProductCenterGlobalFns;
        window.TM_bindProductCenterGlobalFns = function () {
            _bindPcFns();
            window.openProductExpiryModal = function () {
                if (PM.openExpiryConfigModal) PM.openExpiryConfigModal();
            };
            window.closeProductExpiryModal = function () {
                if (PM.closeExpiryConfigModal) PM.closeExpiryConfigModal();
            };
            window.confirmProductExpiryModal = function () {
                if (PM.confirmExpiryConfigModal) PM.confirmExpiryConfigModal();
            };
        };
    }
})();
