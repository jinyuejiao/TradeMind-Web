function formatPurchasePriceDisplay(value) {
    if (window.TM_METRICS && window.TM_METRICS.formatPurchasePrice) {
        var n = window.TM_METRICS.formatPurchasePrice(value);
        return n != null ? '$' + n.toFixed(2) : '—';
    }
    var x = Number(value);
    return isFinite(x) && x > 0 ? '$' + x.toFixed(2) : '—';
}

window.ProductModule = {
    // ==================== API数据映射函数 ====================
    mapProductFromApi: function(apiProduct) {
        var stockVal = apiProduct.stockQuantity != null ? apiProduct.stockQuantity : apiProduct.stock;
        var stockNum = stockVal != null ? Number(stockVal) : 0;
        var ucList = apiProduct.unitConversions || apiProduct.unit_conversions;
        var normalizedConversions = Array.isArray(ucList) ? ucList.map(function (c) {
            return {
                unitName: c.unitName || c.unit_name || c.unit || '',
                ratio: c.ratio != null ? c.ratio : (c.perBase != null ? c.perBase : c.per_base)
            };
        }).filter(function (c) {
            return (c.unitName && String(c.unitName).trim()) || (c.ratio != null && c.ratio !== '');
        }) : [];
        return {
            id: apiProduct.productId || apiProduct.id,
            spuId: apiProduct.spuId != null ? apiProduct.spuId : apiProduct.spu_id,
            skuId: apiProduct.skuId != null ? apiProduct.skuId : apiProduct.sku_id,
            coverUrl: apiProduct.coverUrl || apiProduct.cover_url || null,
            name: apiProduct.productName || apiProduct.name,
            sku: apiProduct.productSku || apiProduct.sku,
            categoryId: apiProduct.categoryId != null ? Number(apiProduct.categoryId) : null,
            supplierId: apiProduct.supplierId != null ? Number(apiProduct.supplierId) : null,
            category1: apiProduct.category1 || apiProduct.category,
            category2: apiProduct.category2,
            supplier: apiProduct.supplierName || apiProduct.supplier,
            region: apiProduct.marketRegion || apiProduct.region,
            price: apiProduct.salePrice != null ? apiProduct.salePrice : apiProduct.price,
            purchasePrice: (function () {
                var raw = apiProduct.costPrice != null ? apiProduct.costPrice : apiProduct.purchasePrice;
                if (window.TM_METRICS && window.TM_METRICS.formatPurchasePrice) {
                    return window.TM_METRICS.formatPurchasePrice(raw);
                }
                var n = Number(raw);
                return isFinite(n) && n > 0 ? n : null;
            })(),
            stock: stockNum,
            salesVolume: apiProduct.salesCount || apiProduct.salesVolume,
            icon: apiProduct.productIcon || apiProduct.icon || 'package',
            baseUnit: apiProduct.baseUnit || '',
            purchaseUnit: apiProduct.purchaseUnit || '',
            salesUnit: apiProduct.salesUnit || '',
            warningStock: apiProduct.warningStock != null ? apiProduct.warningStock : apiProduct.warning_stock,
            description: apiProduct.description || '',
            unitConversions: normalizedConversions,
            stockStatus: apiProduct.stockStatus || (
                stockNum >= 100 ? '充足' :
                stockNum >= 10 ? '预警' : '缺货'
            ),
            createTime: apiProduct.createTime || apiProduct.create_time || null,
            updateTime: apiProduct.updateTime || apiProduct.update_time || null
        };
    },

    _productSortKey: function(product) {
        if (!product) return 0;
        var t = product.updateTime || product.createTime;
        if (!t) return 0;
        var ms = new Date(t).getTime();
        return isNaN(ms) ? 0 : ms;
    },

    renderProductThumbHtml: function(product, size) {
        size = size || 40;
        if (window.TM_ProductThumb) {
            return window.TM_ProductThumb.html({
                coverUrl: product && (product.coverUrl || product.cover_url),
                size: size,
                alt: product && product.name ? product.name : ''
            });
        }
        return '<div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">' +
            '<i class="ph ph-package text-xl"></i></div>';
    },

    unwrapSavePayload: function(saved) {
        if (!saved || typeof saved !== 'object') return {};
        if (saved.product && typeof saved.product === 'object') {
            var p = saved.product;
            return Object.assign({}, p, {
                productId: saved.productId != null ? saved.productId : p.productId,
                spuId: saved.spuId != null ? saved.spuId : (saved.spu_id != null ? saved.spu_id : p.spuId),
                skuId: saved.skuId != null ? saved.skuId : (saved.sku_id != null ? saved.sku_id : p.skuId)
            });
        }
        return saved;
    },

    mapCategoryFromApi: function(apiCategory) {
        return {
            categoryId: apiCategory.categoryId || apiCategory.id,
            name: apiCategory.categoryName || apiCategory.name,
            subcategories: apiCategory.subCategories || apiCategory.subcategories || []
        };
    },

    mapWarehouseFromApi: function(apiWarehouse) {
        var rawId = apiWarehouse.warehouseId || apiWarehouse.id;
        var normalizedId = parseInt(rawId, 10);
        return {
            id: Number.isNaN(normalizedId) ? rawId : normalizedId,
            name: apiWarehouse.warehouseName || apiWarehouse.name,
            location: apiWarehouse.warehouseLocation || apiWarehouse.location || apiWarehouse.address,
            capacity: apiWarehouse.capacity,
            status: apiWarehouse.status
        };
    },

    // ==================== API调用函数 ====================
    loadProducts: async function(options) {
        var opts = options || {};
        var force = !!opts.force;
        if (!force && this._listCache && this._listCache.products
            && (Date.now() - this._listCache.at) < 45000) {
            this.products = this._listCache.products;
            await this.refreshProductListView(opts);
            return this.products;
        }
        try {
            if (window.checkAuth && !window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) {
                return;
            }

            const productList = data.data || data;
            if (Array.isArray(productList)) {
                this.products = productList.map(product => this.mapProductFromApi(product));
                this._listCache = { products: this.products, at: Date.now() };
                await this.refreshProductListView(opts);
            }
            
            return this.products;
        } catch (error) {
            console.error('[ProductModule] 加载产品数据异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载产品数据失败: ' + error.message, 'error');
            }
        }
    },

    invalidateProductListCache: function () {
        this._listCache = null;
    },

    loadCategories: async function() {
        try {
            if (window.TM_MasterDataCache) {
                var cached = await window.TM_MasterDataCache.getCategories(false);
                if (cached && cached.length) {
                    this.categories = cached.map(function (c) {
                        return this.mapCategoryFromApi(c);
                    }, this);
                    return;
                }
            }
            if (window.checkAuth && !window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/categories', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            const categoryList = data.data || data;
            
            if (Array.isArray(categoryList)) {
                this.categories = categoryList.map(category => this.mapCategoryFromApi(category));
            }
            
            return this.categories;
        } catch (error) {
            console.error('[ProductModule] 加载分类数据异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载分类数据失败: ' + error.message, 'error');
            }
        }
    },

    loadSuppliers: async function() {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch('/api/v1/supp/suppliers?all=true', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            const supplierRaw = data.data || data;
            const supplierList = Array.isArray(supplierRaw) ? supplierRaw : (supplierRaw.records || []);
            
            if (Array.isArray(supplierList)) {
                this.suppliers = supplierList;
                }
            
            return this.suppliers;
        } catch (error) {
            console.error('[ProductModule] 加载供应商数据异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载供应商数据失败: ' + error.message, 'error');
            }
        }
    },

    populateSupplierSelect: function(selectedSupplier) {
        const select = document.getElementById('product-supplier-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">请选择关联主供应商</option>';
        
        if (this.suppliers && Array.isArray(this.suppliers)) {
            this.suppliers.forEach(supplier => {
                const option = document.createElement('option');
                const name = supplier.supplierName || supplier.name;
                const supplierId = supplier.supplierId || supplier.id;
                option.value = supplierId != null ? String(supplierId) : '';
                option.textContent = name;
                if (String(selectedSupplier) === String(option.value) || selectedSupplier === name) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    },

    loadWarehouses: async function() {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                this.warehouses = [];
                return [];
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/warehouses', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) {
                this.warehouses = [];
                return [];
            }

            const warehouseList = data.data || data;
            const mappedWarehouses = Array.isArray(warehouseList) 
                ? warehouseList.map(warehouse => this.mapWarehouseFromApi(warehouse))
                : [];
            
            this.warehouses = mappedWarehouses;
            return mappedWarehouses;
        } catch (error) {
            console.error('[ProductModule] 加载仓库数据异常:', error);
            this.warehouses = [];
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载仓库数据失败: ' + error.message, 'error');
            }
            return [];
        }
    },

    PAGE_SIZE: 20,

    // 产品数据模型
    products: [],
    filteredProducts: [],
    productCurrentPage: 1,
    productTotal: 0,
    productTotalPages: 1,

    // 筛选状态（与 products.category_id / supplier_id 对齐）
    filterState: {
        categoryId: null,
        supplierId: null,
        stockStatus: null,
        warehouseId: null,
        searchText: ''
    },
    listViewMode: 'product',
    _spuMobileExpanded: {},
    _warehouseStockFilter: null,

    // 供应商列表
    suppliers: [],

    // 库存状态
    stockStatuses: ['全部', '充足', '预警', '缺货'],

    // 分类数据
    categories: [],

    // 当前选中的产品
    currentProduct: null,

    /** 单位换算编辑草稿（最多 2 行），与 unitConversion 表对应 */
    unitConversionDraft: [{ unitName: '', ratio: '' }],
    
    // 仓库相关状态
    editingWarehouseId: null,
    warehouseToDelete: null,

    /** 进货单据生成弹窗：后端返回的分组缓存 */
    purchaseGenGroups: [],
    purchaseGenPreviewRef: '',

    /** 租户 unit_conversion 表去重后的单位名（默认入库/销售单位下拉） */
    _tenantUnitNames: null,

    // ==================== 初始化函数 ====================
    init: async function() {
        await Promise.all([
            this.loadCategories(),
            this.loadSuppliers(),
            this.loadTenantUnitNames(),
            this.loadWarehouses()
        ]);
        this.initFilterOptions();
        await this.loadProducts();
        },

    loadTenantUnitNames: async function() {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                this._tenantUnitNames = [];
                return this._tenantUnitNames;
            }
            const response = await window.wrappedFetch('/api/v1/rd/products/unit-conversions/all', { method: 'GET' });
            const data = await window.handleApiResponse(response);
            if (!data) {
                this._tenantUnitNames = [];
                return this._tenantUnitNames;
            }
            const list = data.data || data;
            var names = [];
            var seen = {};
            if (Array.isArray(list)) {
                list.forEach(function (uc) {
                    var n = (uc.unitName || uc.unit_name || '').trim();
                    if (n && !seen[n]) {
                        seen[n] = true;
                        names.push(n);
                    }
                });
            }
            this._tenantUnitNames = names;
        } catch (e) {
            console.warn('[ProductModule] 加载租户单位换算失败', e);
            this._tenantUnitNames = [];
        }
        return this._tenantUnitNames;
    },

    buildPurchaseUnitSelectOptions: function() {
        var base = this.getBaseUnitLabel();
        var opts = [];
        var seen = {};
        function add(name, label) {
            var n = (name || '').trim();
            if (!n || seen[n]) return;
            seen[n] = true;
            opts.push({ value: n, label: label || n });
        }
        add(base, base + '（基本单位）');
        this.collectValidConversionsFromDraft().forEach(function (c) {
            add(c.unitName, c.unitName + '(1' + c.unitName + '=' + c.ratio + base + ')');
        });
        var cp = this.currentProduct || {};
        (cp.unitConversions || []).forEach(function (c) {
            var u = (c.unitName || c.unit_name || '').trim();
            var ratio = Number(c.ratio != null ? c.ratio : c.perBase);
            if (u && u !== base && ratio > 0 && !isNaN(ratio)) {
                add(u, u + '(1' + u + '=' + ratio + base + ')');
            }
        });
        if (cp.purchaseUnit) add(cp.purchaseUnit, cp.purchaseUnit);
        if (cp.salesUnit) add(cp.salesUnit, cp.salesUnit);
        return opts;
    },

    // ==================== 下拉菜单功能 ====================
    toggleDropdown: function(dropdownId, evt) {
        if (evt && evt.preventDefault) {
            evt.preventDefault();
        }
        if (evt && evt.stopPropagation) {
            evt.stopPropagation();
        }
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) {
            console.error('[ProductModule] 未找到下拉容器:', dropdownId);
            return;
        }
        
        // 关闭其他所有下拉框并重置箭头
        document.querySelectorAll('[id$="-dropdown"]').forEach(d => {
            if (d.id !== dropdownId) {
                d.classList.add('hidden');
                // 重置其他下拉框的箭头
                const filterId = d.id.replace('-dropdown', '-filter');
                const filterEl = document.getElementById(filterId);
                if (filterEl) {
                    const caretIcon = filterEl.querySelector('.filter-caret-icon');
                    if (caretIcon) {
                        caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                        caretIcon.classList.add('ph-caret-down');
                    }
                }
            }
        });
        
        const isHidden = dropdown.classList.contains('hidden');
        // 切换当前下拉框
        dropdown.classList.toggle('hidden');
        
        // 更新箭头图标
        const filterId = dropdownId.replace('-dropdown', '-filter');
        const filterEl = document.getElementById(filterId);
        if (filterEl) {
            const caretIcon = filterEl.querySelector('.filter-caret-icon');
            if (caretIcon) {
                if (isHidden) {
                    caretIcon.classList.remove('ph-caret-down');
                    caretIcon.classList.add('ph-caret-up', 'rotate-180', 'text-teal-500');
                } else {
                    caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                    caretIcon.classList.add('ph-caret-down');
                }
            }
        }

        // 打开后异步刷新数据，避免因 await 阻塞导致被全局 click 监听提前关闭
        if (isHidden) {
            if (dropdownId === 'category-dropdown') {
                this.loadCategories().then(() => this.initCategoryOptions());
            } else if (dropdownId === 'supplier-dropdown') {
                this.loadSuppliers().then(() => this.initSupplierOptions());
            } else if (dropdownId === 'warehouse-dropdown') {
                this.loadWarehouses().then(() => this.initWarehouseOptions());
            }
        }
    },

    /** 下拉选项用 data-* + 委托点击，避免内联 onclick 与 JSON 引号破坏属性导致无法选中（主壳重复注入 DOM 时按节点重新绑定） */
    bindFilterDropdownDelegates: function() {
        var catDd = document.getElementById('category-dropdown');
        var supDd = document.getElementById('supplier-dropdown');
        var stkDd = document.getElementById('stock-dropdown');
        var whDd = document.getElementById('warehouse-dropdown');
        if (!catDd || !supDd || !stkDd) return;
        if (catDd.dataset.tmFilterDelegated === '1' && supDd.dataset.tmFilterDelegated === '1' && stkDd.dataset.tmFilterDelegated === '1' && (!whDd || whDd.dataset.tmFilterDelegated === '1')) {
            return;
        }
        catDd.dataset.tmFilterDelegated = '1';
        supDd.dataset.tmFilterDelegated = '1';
        stkDd.dataset.tmFilterDelegated = '1';
        if (whDd) whDd.dataset.tmFilterDelegated = '1';
        var self = this;
        catDd.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-category-key]');
            if (!btn || !catDd.contains(btn)) return;
            e.stopPropagation();
            var key = btn.getAttribute('data-category-key');
            if (key === 'all') {
                self.selectCategoryFilter(null, null);
            } else {
                var id = Number(key);
                var label = (btn.textContent || '').trim();
                self.selectCategoryFilter(id, label);
            }
        });
        supDd.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-supplier-key]');
            if (!btn || !supDd.contains(btn)) return;
            e.stopPropagation();
            var key = btn.getAttribute('data-supplier-key');
            if (key === 'all') {
                self.selectSupplierFilter(null, '全部');
            } else {
                var sid = Number(key);
                var label = (btn.textContent || '').trim();
                self.selectSupplierFilter(sid, label);
            }
        });
        stkDd.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-stock-key]');
            if (!btn || !stkDd.contains(btn)) return;
            e.stopPropagation();
            var status = btn.getAttribute('data-stock-key') || '全部';
            self.selectStockStatus(status);
        });
        if (whDd) {
            whDd.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-warehouse-key]');
                if (!btn || !whDd.contains(btn)) return;
                e.stopPropagation();
                var key = btn.getAttribute('data-warehouse-key');
                if (key === 'all') {
                    self.selectWarehouseFilter(null, '全部');
                } else {
                    var wid = Number(key);
                    var label = (btn.textContent || '').trim();
                    self.selectWarehouseFilter(wid, label);
                }
            });
        }
    },

    selectWarehouseFilter: async function(warehouseId, displayName) {
        const wid = warehouseId == null || warehouseId === '' ? null : Number(warehouseId);
        this.filterState.warehouseId = wid != null && !Number.isNaN(wid) ? wid : null;
        const label = document.getElementById('warehouse-label');
        const btn = document.querySelector('#warehouse-filter > button');
        if (this.filterState.warehouseId != null) {
            if (label) label.textContent = displayName || '已选仓库';
            if (btn) btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
            await this.loadWarehouseStockFilter(this.filterState.warehouseId);
        } else {
            if (label) label.textContent = '仓库';
            if (btn) btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
            this._warehouseStockFilter = null;
        }
        const dropdown = document.getElementById('warehouse-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        this.updateResetButton();
        if (this.listViewMode === 'spu') {
            await this.loadSpuList();
        } else {
            this.filterProducts();
        }
    },

    loadWarehouseStockFilter: async function(warehouseId) {
        try {
            const response = await window.wrappedFetch('/api/v1/rd/products/stocks/by-warehouse/' + warehouseId, { method: 'GET' });
            const data = await window.handleApiResponse(response);
            const list = data && data.data ? data.data : [];
            const map = {};
            if (Array.isArray(list)) {
                list.forEach(function (row) {
                    var pid = row.productId != null ? row.productId : row.product_id;
                    var qty = row.quantity != null ? row.quantity : 0;
                    if (pid != null) map[Number(pid)] = Math.max(0, parseInt(qty, 10) || 0);
                });
            }
            this._warehouseStockFilter = map;
        } catch (e) {
            console.warn('[ProductModule] loadWarehouseStockFilter failed', e);
            this._warehouseStockFilter = null;
        }
    },

    toggleSpuMobileExpand: async function (spuId, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (!spuId) return;
        var self = this;
        var key = String(spuId);
        var next = !self._spuMobileExpanded[key];
        self._spuMobileExpanded[key] = next;
        var group = document.querySelector('[data-spu-mobile-group="' + key + '"]');
        if (!group) return;
        var child = group.querySelector('.spu-mobile-skus');
        var caret = group.querySelector('.spu-mobile-caret');
        if (!child) return;
        if (next) {
            child.classList.remove('hidden');
            if (caret) caret.classList.add('rotate-90');
            if (child.getAttribute('data-loaded') === '1') return;
            child.innerHTML = '<p class="text-[10px] text-slate-400 py-2 pl-12">加载 SKU…</p>';
            try {
                var response = await window.wrappedFetch('/api/v1/rd/products/spu/' + spuId, { method: 'GET' });
                var data = await window.handleApiResponse(response);
                if (!data) return;
                var detail = data.data || data;
                var skus = detail.skus || [];
                if (!skus.length) {
                    child.innerHTML = '<p class="text-[10px] text-slate-400 py-2 pl-12">暂无 SKU</p>';
                } else {
                    child.innerHTML = skus.map(function (sku) {
                        var legacyId = sku.legacyProductId || sku.legacy_product_id;
                        var spec = sku.attributesDisplay || sku.attributes_display || sku.specDisplay || sku.spec_display || '';
                        if (!spec && sku.attributes && typeof sku.attributes === 'object') {
                            spec = Object.keys(sku.attributes).map(function (k) { return sku.attributes[k]; }).join(' / ');
                        }
                        var stock = sku.stock != null ? sku.stock : (sku.stockQty != null ? sku.stockQty : 0);
                        var skuCode = sku.skuCode || sku.sku_code || ('SKU#' + (sku.skuId || sku.sku_id || ''));
                        var click = legacyId
                            ? (' onclick="window.ProductModule.openProductDetail(' + legacyId + ')"')
                            : '';
                        return '<div class="spu-mobile-sku-row flex items-center gap-2 py-2 pl-10 pr-3 border-t border-slate-100 bg-slate-50/80 cursor-pointer hover:bg-slate-50"' + click + '>'
                            + '<div class="flex-1 min-w-0"><p class="text-[11px] font-bold text-slate-700 truncate">' + (spec || skuCode) + '</p>'
                            + '<p class="text-[10px] text-slate-400 font-mono truncate">' + skuCode + '</p></div>'
                            + '<span class="text-[10px] font-mono text-slate-500 shrink-0">' + stock + '</span>'
                            + (legacyId ? '<i class="ph ph-pencil-simple text-slate-300 text-sm shrink-0"></i>' : '')
                            + '</div>';
                    }).join('');
                }
                child.setAttribute('data-loaded', '1');
            } catch (e) {
                child.innerHTML = '<p class="text-[10px] text-red-400 py-2 pl-12">加载失败</p>';
            }
        } else {
            child.classList.add('hidden');
            if (caret) caret.classList.remove('rotate-90');
        }
    },

    toggleSpuListView: async function() {
        this.listViewMode = this.listViewMode === 'spu' ? 'product' : 'spu';
        var btn = document.getElementById('product-view-spu-btn');
        if (btn) {
            btn.classList.toggle('bg-brand-50', this.listViewMode === 'spu');
            btn.classList.toggle('text-brand-700', this.listViewMode === 'spu');
            btn.classList.toggle('border-brand-200', this.listViewMode === 'spu');
        }
        if (this.listViewMode === 'spu') {
            await this.loadSpuList();
        } else {
            this.filterProducts();
        }
    },

    loadSpuList: async function() {
        try {
            if (window.checkAuth && !window.checkAuth()) return;
            var qs = '?pageNo=' + (this.productCurrentPage || 1) + '&pageSize=' + this.PAGE_SIZE;
            if (this.filterState.categoryId != null) qs += '&categoryId=' + this.filterState.categoryId;
            if (this.filterState.supplierId != null) qs += '&supplierId=' + this.filterState.supplierId;
            if (this.filterState.warehouseId != null) qs += '&warehouseId=' + this.filterState.warehouseId;
            const response = await window.wrappedFetch('/api/v1/rd/products/spu' + qs, { method: 'GET' });
            const data = await window.handleApiResponse(response);
            if (!data) return;
            const payload = data.data || data;
            const records = payload.records || payload || [];
            this.renderSpuDesktopTable(Array.isArray(records) ? records : []);
            this.renderSpuMobileCards(Array.isArray(records) ? records : []);
            this.productTotal = Number(payload.total || records.length || 0);
            this.productTotalPages = Math.max(1, Math.ceil(this.productTotal / this.PAGE_SIZE));
            this.renderPaginationBar({
                containerId: 'product-pagination',
                page: this.productCurrentPage,
                totalPages: this.productTotalPages,
                total: this.productTotal,
                pageSize: this.PAGE_SIZE,
                onPrev: 'window.ProductModule.setSpuPage(' + (this.productCurrentPage - 1) + ')',
                onNext: 'window.ProductModule.setSpuPage(' + (this.productCurrentPage + 1) + ')'
            });
        } catch (e) {
            console.error('[ProductModule] loadSpuList failed', e);
        }
    },

    setSpuPage: function(page) {
        page = Math.max(1, parseInt(page, 10) || 1);
        this.productCurrentPage = page;
        this.loadSpuList();
    },

    renderSpuDesktopTable: function(spuList) {
        const tbody = document.querySelector('#existingProdTable tbody');
        if (!tbody) return;
        if (!spuList.length) {
            tbody.innerHTML = '<tr class="hidden md:table-row"><td colspan="5" class="px-6 py-12 text-center text-slate-400">暂无 SPU</td></tr>';
            return;
        }
        tbody.innerHTML = spuList.map(function (spu) {
            var spuId = spu.spu_id || spu.spuId;
            var name = spu.name || '—';
            var skuCount = spu.sku_count != null ? spu.sku_count : (spu.skuCount || 0);
            var stock = spu.total_stock != null ? spu.total_stock : (spu.totalStock || 0);
            var flags = [];
            if (spu.track_variants || spu.trackVariants) flags.push('多规格');
            if (spu.track_expiry || spu.trackExpiry) flags.push('批次');
            if (spu.track_serial || spu.trackSerial) flags.push('序列号');
            return '<tr class="product-row hover:bg-slate-50 transition-all cursor-pointer group" onclick="window.ProductModule.openSpuDetail(' + spuId + ')">' +
                '<td class="px-6 py-4"><div class="flex items-center gap-3">' +
                '<div class="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-500"><i class="ph ph-tree-structure text-xl"></i></div>' +
                '<div><p class="font-bold text-slate-800">' + name + '</p>' +
                '<p class="text-[10px] text-slate-400 mt-1">' + skuCount + ' 个 SKU' + (flags.length ? ' · ' + flags.join(' · ') : '') + '</p></div></div></td>' +
                '<td class="px-6 py-4 text-right col-hide-mobile text-slate-400">—</td>' +
                '<td class="px-6 py-4 text-right col-hide-mobile text-slate-400">—</td>' +
                '<td class="px-6 py-4 text-right font-mono font-bold text-slate-700">' + stock + '</td>' +
                '<td class="px-6 py-4 text-right"><button type="button" class="action-icon-btn" onclick="event.stopPropagation(); window.ProductModule.openSpuDetail(' + spuId + ')" title="查看 SKU"><i class="ph ph-eye text-lg"></i></button></td></tr>';
        }).join('');
    },

    renderSpuMobileCards: function(spuList) {
        var container = document.getElementById('mobile-product-cards');
        if (!container) return;
        if (this.listViewMode !== 'spu') return;
        if (!spuList.length) {
            container.innerHTML = '<div class="py-10 px-4 text-center"><i class="ph ph-tree-structure text-3xl text-slate-300"></i>'
                + '<p class="text-slate-400 font-bold mt-2 text-xs">暂无 SPU</p></div>';
            return;
        }
        container.innerHTML = spuList.map(function (spu) {
            var spuId = spu.spu_id || spu.spuId;
            var name = spu.name || '—';
            var skuCount = spu.sku_count != null ? spu.sku_count : (spu.skuCount || 0);
            var stock = spu.total_stock != null ? spu.total_stock : (spu.totalStock || 0);
            var stockLabel = Number(stock) < 0 ? ('欠货 ' + Math.abs(Number(stock))) : (stock + ' 库存');
            var expanded = this._spuMobileExpanded && this._spuMobileExpanded[String(spuId)];
            return '<div class="spu-mobile-group border-b border-slate-100" data-spu-mobile-group="' + spuId + '">'
                + '<div class="mobile-product-row flex items-stretch gap-2 px-3 py-2 hover:bg-slate-50 active:bg-slate-50">'
                + '<div class="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-teal-500 shrink-0"><i class="ph ph-tree-structure text-lg"></i></div>'
                + '<div class="flex-1 min-w-0" role="button" tabindex="0" onclick="window.ProductModule.toggleSpuMobileExpand(' + spuId + ', event)">'
                + '<p class="font-bold text-slate-800 text-[12px] leading-tight line-clamp-2">' + name + '</p>'
                + '<p class="text-[10px] text-slate-400 mt-0.5">' + skuCount + ' SKU · ' + stockLabel + '</p>'
                + '</div>'
                + '<button type="button" class="spu-mobile-caret p-2 -mr-1 text-slate-400 shrink-0 self-center' + (expanded ? ' rotate-90' : '') + '" onclick="window.ProductModule.toggleSpuMobileExpand(' + spuId + ', event)" aria-label="展开 SKU 列表">'
                + '<i class="ph ph-caret-right text-lg"></i></button></div>'
                + '<div class="spu-mobile-skus' + (expanded ? '' : ' hidden') + '" data-loaded="0"></div>'
                + '</div>';
        }).join('');
        var self = this;
        spuList.forEach(function (spu) {
            var spuId = spu.spu_id || spu.spuId;
            if (self._spuMobileExpanded && self._spuMobileExpanded[String(spuId)]) {
                self.toggleSpuMobileExpand(spuId);
            }
        });
    },

    openSpuDetail: async function(spuId) {
        if (!spuId) return;
        try {
            const response = await window.wrappedFetch('/api/v1/rd/products/spu/' + spuId, { method: 'GET' });
            const data = await window.handleApiResponse(response);
            if (!data) return;
            const detail = data.data || data;
            const skus = detail.skus || [];
            if (skus.length && (skus[0].legacyProductId || skus[0].legacy_product_id)) {
                await this.openProductDetail(skus[0].legacyProductId || skus[0].legacy_product_id);
            } else if (skus.length && window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('SPU「' + (detail.name || '') + '」含 ' + skus.length + ' 个 SKU', 'info');
            }
        } catch (e) {
            console.warn('[ProductModule] openSpuDetail', e);
        }
    },

    // ==================== 筛选功能 ====================
    selectCategoryFilter: function(categoryId, displayName) {
        const cid = categoryId == null || categoryId === '' ? null : Number(categoryId);
        this.filterState.categoryId = cid != null && !Number.isNaN(cid) ? cid : null;

        const label = document.getElementById('category-label');
        const btn = document.querySelector('#category-filter > button');

        if (this.filterState.categoryId != null) {
            label.textContent = displayName || '已选分类';
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else {
            label.textContent = '产品类别';
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        }

        document.getElementById('category-dropdown').classList.add('hidden');
        const filterEl = document.getElementById('category-filter');
        if (filterEl) {
            const caretIcon = filterEl.querySelector('.filter-caret-icon');
            if (caretIcon) {
                caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                caretIcon.classList.add('ph-caret-down');
            }
        }
        this.updateResetButton();
        this.filterProducts();
    },

    selectSupplierFilter: function(supplierId, displayName) {
        const sid = supplierId == null || supplierId === '' ? null : Number(supplierId);
        this.filterState.supplierId = sid != null && !Number.isNaN(sid) ? sid : null;

        const label = document.getElementById('supplier-label');
        const btn = document.querySelector('#supplier-filter > button');

        if (this.filterState.supplierId != null) {
            label.textContent = displayName || '供应商';
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else {
            label.textContent = '供应商';
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        }

        document.getElementById('supplier-dropdown').classList.add('hidden');
        const supplierFilterEl = document.getElementById('supplier-filter');
        if (supplierFilterEl) {
            const caretIcon = supplierFilterEl.querySelector('.filter-caret-icon');
            if (caretIcon) {
                caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                caretIcon.classList.add('ph-caret-down');
            }
        }
        this.updateResetButton();
        this.filterProducts();
    },

    selectStockStatus: function(status) {
        this.filterState.stockStatus = status;
        
        const label = document.getElementById('stock-label');
        const btn = document.querySelector('#stock-filter > button');
        
        if (status && status !== '全部') {
            label.textContent = status;
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else {
            label.textContent = '库存';
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        }
        
        document.getElementById('stock-dropdown').classList.add('hidden');
        // 重置箭头图标
        const stockFilterEl = document.getElementById('stock-filter');
        if (stockFilterEl) {
            const caretIcon = stockFilterEl.querySelector('.filter-caret-icon');
            if (caretIcon) {
                caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                caretIcon.classList.add('ph-caret-down');
            }
        }
        this.updateResetButton();
        this.filterProducts();
    },

    updateResetButton: function() {
        const resetBtn = document.getElementById('reset-filter-btn');
        if (!resetBtn) return;
        
        const hasActiveFilter = this.filterState.categoryId != null || this.filterState.supplierId != null
            || this.filterState.warehouseId != null
            || (this.filterState.stockStatus && this.filterState.stockStatus !== '全部')
            || (this.filterState.searchText && String(this.filterState.searchText).trim() !== '');
        
        if (hasActiveFilter) {
            resetBtn.classList.remove('hidden');
            resetBtn.classList.add('flex', 'items-center');
        } else {
            resetBtn.classList.add('hidden');
            resetBtn.classList.remove('flex', 'items-center');
        }
    },

    resetFilters: function() {
        this.filterState = {
            categoryId: null,
            supplierId: null,
            stockStatus: null,
            warehouseId: null,
            searchText: ''
        };
        this._warehouseStockFilter = null;
        this.listViewMode = 'product';
        
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        document.getElementById('category-label').textContent = '产品类别';
        document.getElementById('supplier-label').textContent = '供应商';
        document.getElementById('stock-label').textContent = '库存';
        var whLabel = document.getElementById('warehouse-label');
        if (whLabel) whLabel.textContent = '仓库';
        
        document.querySelectorAll('#category-filter > button, #supplier-filter > button, #stock-filter > button, #warehouse-filter > button').forEach(function (btn) {
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        });
        
        this.updateResetButton();
        this.filterProducts();
    },

    filterInventoryTable: function() {
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            this.filterState.searchText = searchInput.value;
            this.filterProducts();
        }
    },

    filterProducts: function() {
        let filtered = [...this.products];
        
        if (this.filterState.searchText) {
            const searchLower = String(this.filterState.searchText).toLowerCase().trim();
            filtered = filtered.filter(p => {
                const nm = (p.name != null ? String(p.name) : '').toLowerCase();
                const sk = (p.sku != null ? String(p.sku) : '').toLowerCase();
                return nm.includes(searchLower) || sk.includes(searchLower);
            });
        }

        if (this.filterState.categoryId != null && !Number.isNaN(this.filterState.categoryId)) {
            const cid = Number(this.filterState.categoryId);
            filtered = filtered.filter(p => p.categoryId != null && Number(p.categoryId) === cid);
        }

        if (this.filterState.supplierId != null && !Number.isNaN(this.filterState.supplierId)) {
            const sid = Number(this.filterState.supplierId);
            filtered = filtered.filter(p => p.supplierId != null && Number(p.supplierId) === sid);
        }
        
        if (this.filterState.stockStatus && this.filterState.stockStatus !== '全部') {
            filtered = filtered.filter(p => p.stockStatus === this.filterState.stockStatus);
        }

        if (this.filterState.warehouseId != null && this._warehouseStockFilter) {
            filtered = filtered.filter(function (p) {
                return window.ProductModule._warehouseStockFilter[p.id] != null;
            }).map(function (p) {
                var copy = Object.assign({}, p);
                copy.stock = window.ProductModule._warehouseStockFilter[p.id];
                copy.stockStatus = copy.stock >= 100 ? '充足' : (copy.stock >= 10 ? '预警' : '缺货');
                return copy;
            });
        }
        
        this.renderProducts(filtered, { resetPage: true });
    },

    filterProductsOrSpu: function() {
        if (this.listViewMode === 'spu') {
            this.loadSpuList();
        } else {
            this.filterProducts();
        }
    },

    refreshProductListView: async function(options) {
        var opts = options || {};
        if (this.filterState.warehouseId != null) {
            await this.loadWarehouseStockFilter(this.filterState.warehouseId);
        }
        if (this.listViewMode === 'spu') {
            if (opts.resetPage !== false) {
                this.productCurrentPage = 1;
            }
            await this.loadSpuList();
        } else {
            this.filterProducts();
        }
        if (opts.focusProductId != null) {
            this.focusProductInList(opts.focusProductId);
        }
    },

    focusProductInList: function(productId) {
        var pid = Number(productId);
        if (!pid || this.listViewMode === 'spu') return false;
        var list = this.filteredProducts || [];
        var idx = list.findIndex(function (p) { return Number(p.id) === pid; });
        if (idx < 0) return false;
        var page = Math.floor(idx / this.PAGE_SIZE) + 1;
        this.productCurrentPage = page;
        var paged = this.paginateData(list, page, this.PAGE_SIZE);
        this.renderDesktopTable(paged.records);
        this.renderMobileCards(paged.records);
        this.renderPaginationBar({
            containerId: 'product-pagination',
            page: this.productCurrentPage,
            totalPages: this.productTotalPages,
            total: this.productTotal,
            pageSize: this.PAGE_SIZE,
            onPrev: 'window.ProductModule.setProductPage(' + (this.productCurrentPage - 1) + ')',
            onNext: 'window.ProductModule.setProductPage(' + (this.productCurrentPage + 1) + ')'
        });
        setTimeout(function () {
            var row = document.querySelector('#existingProdTable tbody tr[data-product-id="' + pid + '"]');
            if (!row) return;
            row.classList.add('ring-2', 'ring-brand-400', 'bg-brand-50/40');
            setTimeout(function () {
                row.classList.remove('ring-2', 'ring-brand-400', 'bg-brand-50/40');
            }, 2200);
            var scrollRoot = document.getElementById('product-library-scroll');
            if (scrollRoot) {
                try {
                    var rowRect = row.getBoundingClientRect();
                    var rootRect = scrollRoot.getBoundingClientRect();
                    var delta = rowRect.top - rootRect.top + scrollRoot.scrollTop - 72;
                    scrollRoot.scrollTop = Math.max(0, delta);
                } catch (eScroll) {
                    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            } else {
                row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 60);
        return true;
    },

    // ==================== 渲染功能 ====================
    renderProducts: function(productList, options) {
        const opts = options || {};
        if (!productList) {
            console.error('[ProductModule] productList为null或undefined');
            return;
        }
        
        const self = this;
        const sortedProducts = [...productList].sort(function (a, b) {
            var tb = self._productSortKey(b);
            var ta = self._productSortKey(a);
            if (tb !== ta) return tb - ta;
            return (Number(b.salesVolume) || 0) - (Number(a.salesVolume) || 0);
        });
        this.filteredProducts = sortedProducts;
        this.productTotal = sortedProducts.length;
        this.productTotalPages = Math.max(1, Math.ceil(this.productTotal / this.PAGE_SIZE));
        if (opts.resetPage !== false) {
            this.productCurrentPage = 1;
        } else {
            this.productCurrentPage = Math.min(Math.max(1, this.productCurrentPage), this.productTotalPages);
        }

        const paged = this.paginateData(sortedProducts, this.productCurrentPage, this.PAGE_SIZE);
        const pageProducts = paged.records;

        this.renderDesktopTable(pageProducts);
        this.renderMobileCards(pageProducts);
        this.renderPaginationBar({
            containerId: 'product-pagination',
            page: this.productCurrentPage,
            totalPages: this.productTotalPages,
            total: this.productTotal,
            pageSize: this.PAGE_SIZE,
            onPrev: 'window.ProductModule.setProductPage(' + (this.productCurrentPage - 1) + ')',
            onNext: 'window.ProductModule.setProductPage(' + (this.productCurrentPage + 1) + ')'
        });
        if (typeof window.applyRoleUI === 'function') {
            window.applyRoleUI({ skipTabSync: true });
        }
        },

    ensurePaginationContainer: function(containerId) {
        var container = document.getElementById(containerId);
        if (container) return container;

        var root = document.getElementById('view-supply') || document.getElementById('supply-inner-scroll') || document.body;
        if (containerId === 'product-pagination') {
            var table = root.querySelector('#existingProdTable');
            if (table && table.parentElement) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = 'bg-white hidden md:block';
                table.parentElement.insertAdjacentElement('afterend', container);
                return container;
            }
        }
        if (containerId === 'mobile-product-pagination') {
            var cards = root.querySelector('#mobile-product-cards');
            if (cards && cards.parentElement) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = 'border-t border-slate-100 bg-slate-50/70 px-3 py-2';
                cards.insertAdjacentElement('afterend', container);
                return container;
            }
        }
        return null;
    },

    paginateData: function(list, page, pageSize) {
        const safePageSize = Math.max(1, Number(pageSize) || 20);
        const total = Array.isArray(list) ? list.length : 0;
        const totalPages = Math.max(1, Math.ceil(total / safePageSize));
        const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
        const start = (current - 1) * safePageSize;
        const end = start + safePageSize;
        return {
            records: (list || []).slice(start, end),
            total: total,
            page: current,
            totalPages: totalPages
        };
    },

    renderPaginationBar: function(config) {
        const container = this.ensurePaginationContainer(config.containerId);
        if (!container) {
            console.warn('[ProductModule] 未找到分页容器:', config.containerId);
            return;
        }

        const page = Number(config.page) || 1;
        const totalPages = Math.max(1, Number(config.totalPages) || 1);
        const total = Number(config.total) || 0;
        const pageSize = Number(config.pageSize) || 20;
        const disablePrev = page <= 1;
        const disableNext = page >= totalPages;
        const btnCls = 'inline-flex items-center justify-center gap-1 min-h-[2rem] px-3 py-1.5 rounded-full border border-teal-200 bg-white text-[11px] font-bold text-teal-700 shadow-sm hover:bg-teal-50 disabled:opacity-40 disabled:pointer-events-none disabled:text-slate-400 disabled:border-slate-200 transition-colors';

        if (total === 0) {
            container.innerHTML = '';
            const mobilePagEmpty = this.ensurePaginationContainer('mobile-product-pagination');
            if (mobilePagEmpty) mobilePagEmpty.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="border-t border-slate-100 bg-slate-50/70 px-4 md:px-6 py-3 md:py-4">
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p class="text-[10px] md:text-xs text-slate-500 leading-snug text-center md:text-left">共 ${total} 条，第 ${page}/${totalPages} 页，每页 ${pageSize} 条</p>
                    <div class="flex gap-2 justify-center md:justify-end">
                        <button type="button" onclick="${config.onPrev}" ${disablePrev ? 'disabled' : ''} class="${btnCls}"><i class="ph ph-caret-left"></i>上一页</button>
                        <button type="button" onclick="${config.onNext}" ${disableNext ? 'disabled' : ''} class="${btnCls}">下一页<i class="ph ph-caret-right"></i></button>
                    </div>
                </div>
            </div>
        `;

        const mobilePag = this.ensurePaginationContainer('mobile-product-pagination');
        if (mobilePag) {
            mobilePag.innerHTML = `
            <div class="flex flex-col gap-1.5">
                <p class="mobile-product-pagination-summary text-[9px] text-slate-500 leading-snug text-center">共 ${total} 条，第 ${page}/${totalPages} 页，每页 ${pageSize} 条</p>
                <div class="flex gap-1.5 justify-center items-center">
                    <button type="button" class="mobile-page-btn" ${disablePrev ? 'disabled' : ''} onclick="${config.onPrev}" aria-label="上一页">
                        <i class="ph ph-caret-left mobile-page-btn__icon" aria-hidden="true"></i>
                        <span class="mobile-page-btn__text">上一页</span>
                    </button>
                    <button type="button" class="mobile-page-btn" ${disableNext ? 'disabled' : ''} onclick="${config.onNext}" aria-label="下一页">
                        <span class="mobile-page-btn__text">下一页</span>
                        <i class="ph ph-caret-right mobile-page-btn__icon" aria-hidden="true"></i>
                    </button>
                </div>
            </div>`;
        }
    },

    setProductPage: function(page) {
        const target = Number(page) || 1;
        if (target < 1 || target > this.productTotalPages) {
            return;
        }
        this.productCurrentPage = target;
        this.renderProducts(this.filteredProducts || this.products || [], { resetPage: false });
        const scrollRoot = document.getElementById('supply-inner-scroll') || document.getElementById('content-area');
        if (scrollRoot) {
            try { scrollRoot.scrollTop = 0; } catch (e) { /* ignore */ }
        }
        const tableTop = document.getElementById('product-library-header') || document.getElementById('existingProdTable');
        if (tableTop) {
            try { tableTop.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e2) { /* ignore */ }
        }
    },

    renderDesktopTable: function(productList) {
        const tbody = document.querySelector('#existingProdTable tbody');
        if (!tbody) {
            console.error('[ProductModule] 未找到existingProdTable tbody');
            return;
        }
        
        if (productList.length === 0) {
            tbody.innerHTML = `
                <tr class="hidden md:table-row">
                    <td colspan="5" class="px-6 py-12 text-center">
                        <div class="flex flex-col items-center gap-3">
                            <i class="ph ph-package text-4xl text-slate-300"></i>
                            <p class="text-slate-400 font-bold">暂无产品</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = productList.map(product => {
            return `
            <tr data-product-id="${product.id}" onclick="window.ProductModule.openProductDetail(${product.id})" class="product-row hover:bg-slate-50 transition-all cursor-pointer group">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        ${window.ProductModule.renderProductThumbHtml(product, 40)}
                        <div>
                            <p class="font-bold text-slate-800 product-name-cell">${product.name}</p>
                            <p class="text-[10px] text-slate-400 font-mono product-sku-cell uppercase mt-1">SKU: ${product.sku}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-500 col-hide-mobile">
                    <span data-field="sales_price">$${(product.price || 0).toFixed(2)}</span>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-brand-600 col-hide-mobile">
                    <span data-field="purchase_price">${formatPurchasePriceDisplay(product.purchasePrice)}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-mono font-bold ${window.ProductModule.getStockColor(product.stockStatus)} tracking-tighter text-sm">
                        ${window.ProductModule.formatCompoundStockDisplay(product)}
                    </p>
                    <div class="w-16 h-1 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden md:block hidden">
                        <div class="w-[${window.ProductModule.getStockPercentage(product.stock || 0)}%] ${window.ProductModule.getStockBgColor(product.stockStatus)} h-full ${product.stockStatus === '缺货' ? 'animate-pulse' : ''}"></div>
                    </div>
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="flex justify-end gap-1">
                        <button onclick="event.stopPropagation(); window.ProductModule.openProductDetail(${product.id})" title="编辑" class="action-icon-btn">
                            <i class="ph ph-pencil-simple-line text-lg"></i>
                        </button>
                        <button data-action="product.delete" onclick="event.stopPropagation(); window.ProductModule.confirmDeleteProduct(${product.id}, '${product.name}')" title="删除" class="action-icon-btn delete">
                            <i class="ph ph-trash text-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
        },

    renderMobileCards: function(productList) {
        const container = document.getElementById('mobile-product-cards');
        if (!container) {
            console.error('[ProductModule] 未找到mobile-product-cards容器');
            return;
        }
        
        if (productList.length === 0) {
            container.innerHTML = `
                <div class="py-10 px-4 text-center">
                    <i class="ph ph-package text-3xl text-slate-300"></i>
                    <p class="text-slate-400 font-bold mt-2 text-xs">暂无产品</p>
                </div>`;
            return;
        }

        container.innerHTML = productList.map(product => {
            const pct = window.ProductModule.getStockPercentage(product.stock || 0);
            const barClass = window.ProductModule.getStockBgColor(product.stockStatus);
            const pulse = product.stockStatus === '缺货' ? 'animate-pulse' : '';
            return `
        <div class="mobile-product-row flex items-stretch gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50/90 active:bg-slate-50" onclick="window.ProductModule.openProductDetail(${product.id})">
            ${window.ProductModule.renderProductThumbHtml(product, 36)}
            <div class="flex-1 min-w-0 py-0">
                <div class="flex justify-between gap-2 items-start">
                    <p class="font-bold text-slate-800 text-[12px] leading-tight line-clamp-2">${product.name}</p>
                    <span class="font-mono text-[9px] text-slate-500 shrink-0">${window.ProductModule.formatCompoundStockDisplay(product)}</span>
                </div>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0 mt-0.5 text-[10px]">
                    <span class="text-slate-600">销售 <span class="font-mono font-bold">$${(product.price || 0).toFixed(2)}</span></span>
                    <span class="text-brand-600">进货 <span class="font-mono font-bold">${formatPurchasePriceDisplay(product.purchasePrice)}</span></span>
                </div>
                <div class="w-full max-w-[11rem] h-0.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div class="${barClass} h-full ${pulse}" style="width:${pct}%"></div>
                </div>
            </div>
            <div class="flex flex-col gap-1 justify-center shrink-0" onclick="event.stopPropagation()">
                <button type="button" onclick="window.ProductModule.openProductDetail(${product.id})" class="mobile-mini-btn" title="编辑"><i class="ph ph-pencil-simple"></i></button>
                <button type="button" onclick="window.ProductModule.confirmDeleteProduct(${product.id}, '${String(product.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" class="mobile-mini-btn delete" title="删除"><i class="ph ph-trash"></i></button>
            </div>
        </div>`;
        }).join('');
    },

    // ==================== 辅助函数 ====================
    getStockColor: function(status) {
        switch(status) {
            case '充足': return 'text-slate-900';
            case '预警': return 'text-orange-500';
            case '缺货': return 'text-risk-high';
            default: return 'text-slate-900';
        }
    },

    getStockBgColor: function(status) {
        switch(status) {
            case '充足': return 'bg-brand-500';
            case '预警': return 'bg-orange-500';
            case '缺货': return 'bg-risk-high';
            default: return 'bg-brand-500';
        }
    },

    getStockPercentage: function(stock) {
        if (stock >= 1000) return 85;
        if (stock >= 500) return 60;
        if (stock >= 100) return 40;
        return 30;
    },

    getStockStatusColor: function(status) {
        switch(status) {
            case '充足': return 'bg-brand-500';
            case '预警': return 'bg-orange-500';
            case '缺货': return 'bg-risk-high';
            default: return '';
        }
    },

    // ==================== 初始化选项 ====================
    initCategoryOptions: function() {
        const container = document.getElementById('category-options');
        if (!container) return;

        const escHtml = function (s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        const rows = [
            '<button type="button" data-category-key="all" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50">全部类别</button>'
        ];
        (this.categories || []).forEach(function (cat) {
            const id = cat.categoryId;
            const nm = cat.name || '未命名';
            if (id == null || id === '') return;
            rows.push(
                '<button type="button" data-category-key="' + String(Number(id)) + '" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-800 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50">' + escHtml(nm) + '</button>'
            );
        });
        container.innerHTML = rows.join('');
    },

    initSupplierOptions: function() {
        const container = document.getElementById('supplier-options');
        if (!container) return;

        const escHtml = function (s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        const parts = [
            '<button type="button" data-supplier-key="all" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50">全部供应商</button>'
        ];
        (this.suppliers || []).forEach(function (supplier) {
            const name = supplier.supplierName || supplier.name;
            const sid = supplier.supplierId != null ? supplier.supplierId : supplier.id;
            if (sid == null || name == null) return;
            parts.push(
                '<button type="button" data-supplier-key="' + String(Number(sid)) + '" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50 last:border-b-0">' + escHtml(String(name)) + '</button>'
            );
        });
        container.innerHTML = parts.join('');
    },

    initStockOptions: function() {
        const container = document.getElementById('stock-options');
        if (!container) return;

        const escAttr = function (s) {
            return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        };
        const escHtml = function (s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        var self = this;
        container.innerHTML = this.stockStatuses.map(function (status) {
            var dot = status !== '全部'
                ? '<span class="inline-block w-2.5 h-2.5 ' + self.getStockStatusColor(status) + ' rounded-full"></span>'
                : '';
            return '<button type="button" data-stock-key="' + escAttr(status) + '" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50 last:border-b-0 flex items-center gap-3">' +
                dot + (dot ? '<span class="w-2"></span>' : '') + escHtml(status) + '</button>';
        }).join('');
    },

    initWarehouseOptions: function() {
        const container = document.getElementById('warehouse-options');
        if (!container) return;
        const escHtml = function (s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        const parts = [
            '<button type="button" data-warehouse-key="all" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50">全部仓库</button>'
        ];
        (this.warehouses || []).forEach(function (wh) {
            var wid = wh.id != null ? wh.id : wh.warehouseId;
            var name = wh.name || wh.warehouseName;
            if (wid == null || !name) return;
            parts.push(
                '<button type="button" data-warehouse-key="' + String(Number(wid)) + '" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50 last:border-b-0">' + escHtml(String(name)) + '</button>'
            );
        });
        container.innerHTML = parts.join('');
    },

    initFilterOptions: function() {
        this.bindFilterDropdownDelegates();
        this.initCategoryOptions();
        this.initSupplierOptions();
        this.initStockOptions();
        this.initWarehouseOptions();
        var spuBtn = document.getElementById('product-view-spu-btn');
        if (spuBtn) spuBtn.classList.remove('hidden');
    },

    initProductList: function() {
        this.renderProducts(this.products);
    },

    // ==================== 弹窗功能 ====================
    openProductDetail: async function(productId) {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch(`/api/v1/rd/products/${productId}`, {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            const apiProduct = data.data || data;
            const product = this.mapProductFromApi(apiProduct);
            
            this.currentProduct = product;
            this.syncDraftFromApiConversions(product.unitConversions);
            
            if (!this.categories || !this.categories.length) {
                await this.loadCategories();
            }
            if (!this.suppliers || !this.suppliers.length) {
                await this.loadSuppliers();
            }

            const modal = document.getElementById('product-detail-modal');
            if (modal) {
                const titleEl = document.getElementById('detail-title');
                const skuHintEl = document.getElementById('detail-sku-hint') || document.getElementById('detail-sku');
                if (titleEl) titleEl.textContent = '产品详情';
                if (skuHintEl) {
                    skuHintEl.textContent = product.sku ? ('SKU: ' + product.sku) : '填写必填项即可保存';
                }
                if (typeof window.TM_openUnifiedModal === 'function') {
                    window.TM_openUnifiedModal(modal);
                } else {
                    modal.classList.remove('hidden');
                    modal.setAttribute('aria-hidden', 'false');
                }
            }
        } catch (error) {
            console.error('[ProductModule] 加载产品详情异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载产品详情失败: ' + error.message, 'error');
            }
        }
    },

    openCreateProductModal: async function() {
        try {
            await Promise.all([
                this.loadCategories(),
                this.loadSuppliers()
            ]);

            this.currentProduct = {};
            this.unitConversionDraft = [{ unitName: '', ratio: '' }];

            const modal = document.getElementById('product-detail-modal');
            if (modal) {
                const titleEl = document.getElementById('detail-title');
                const skuHintEl = document.getElementById('detail-sku-hint') || document.getElementById('detail-sku');
                if (titleEl) titleEl.textContent = '新增产品';
                if (skuHintEl) skuHintEl.textContent = '请填写名称、售价、基本单位与库存';
                if (typeof window.TM_openUnifiedModal === 'function') {
                    window.TM_openUnifiedModal(modal);
                } else {
                    modal.classList.remove('hidden');
                    modal.setAttribute('aria-hidden', 'false');
                }
            }

            this.populateCategorySelect(null);
            this.populateSupplierSelect(null);
            this.populateProductForm({
                name: '',
                sku: '',
                price: 0,
                stock: 0,
                baseUnit: '',
                warningStock: '',
                description: '',
                purchaseUnit: null,
                salesUnit: null
            });
            this.rebuildPurchaseSalesUnitSelects(null, null);
        } catch (error) {
            console.error('[ProductModule] 打开新增产品弹窗失败:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('打开新增产品弹窗失败: ' + error.message, 'error');
            }
        }
    },
    
    populateCategorySelect: function(selectedCategoryId) {
        const select = document.getElementById('detail-product-category') || document.getElementById('product-category-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">未分类（可选）</option>';
        
        this.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.categoryId;
            option.textContent = cat.name;
            if (selectedCategoryId === cat.categoryId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    },

    populateProductForm: function(product) {
        const nameInput = document.getElementById('product-name-input');
        const skuInput = document.getElementById('product-sku-input');
        const priceInput = document.getElementById('product-price-input');
        const stockInput = document.getElementById('product-stock-input');
        const baseUnitInput = document.getElementById('product-base-unit-input');
        const warningStockInput = document.getElementById('product-warning-stock-input');
        const descTextarea = document.getElementById('product-desc-textarea');

        if (nameInput) nameInput.value = product.name || '';
        if (skuInput) skuInput.value = product.sku || '';
        if (priceInput) priceInput.value = product.price != null ? product.price : 0;
        if (stockInput) stockInput.value = product.stock != null ? product.stock : 0;
        if (baseUnitInput) baseUnitInput.value = product.baseUnit || '';
        if (warningStockInput) warningStockInput.value = product.warningStock != null ? product.warningStock : '';
        if (descTextarea) descTextarea.value = product.description || '';

        this.rebuildPurchaseSalesUnitSelects(product.purchaseUnit, product.salesUnit);
    },

    closeProductDetail: function() {
        const modal = document.getElementById('product-detail-modal');
        if (modal) {
            if (typeof window.TM_closeUnifiedModal === 'function') {
                window.TM_closeUnifiedModal(modal);
            } else {
                modal.classList.add('hidden');
            }
        }
        this.currentProduct = null;
    },

    confirmDeleteProduct: function(productId, productName) {
        var self = this;
        var msg = '确定要删除产品「' + (productName || '') + '」吗？此操作无法撤销。';
        var runDelete = async function () {
            try {
                if (window.checkAuth && !window.checkAuth()) {
                    console.error('[ProductModule] checkAuth failed');
                    return;
                }

                const response = await window.wrappedFetch(`/api/v1/rd/products/${productId}`, {
                    method: 'DELETE'
                });

                const data = await window.handleApiResponse(response);
                if (!data) return;

                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('产品删除成功！', 'success');
                }

                await self.loadProducts();
            } catch (error) {
                console.error('[ProductModule] 删除产品异常:', error);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('删除产品失败: ' + error.message, 'error');
                }
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

    /**
     * 组装 POST /products/save 请求体（产品主表 + unitConversion 列表）
     * @param {Array<{unitName:string,ratio:number}>} validUnitConv 已通过校验的换算行
     * @returns {{ error: string|null, body: object|null }}
     */
    buildProductSaveBodyWithUnits: function(validUnitConv) {
        if (!validUnitConv || validUnitConv.length < 1) {
            return { error: '请至少配置一条单位换算', body: null };
        }
        const nameInput = document.getElementById('product-name-input');
        const skuInput = document.getElementById('product-sku-input');
        const priceInput = document.getElementById('product-price-input');
        const categorySelect = document.getElementById('product-category-select');
        const supplierSelect = document.getElementById('product-supplier-select');
        const purchaseUnitSelect = document.getElementById('product-purchase-unit-select');
        const salesUnitSelect = document.getElementById('product-sales-unit-select');
        const baseUnitInput = document.getElementById('product-base-unit-input');
        const stockInput = document.getElementById('product-stock-input');
        const warningStockInput = document.getElementById('product-warning-stock-input');
        const descTextarea = document.getElementById('product-desc-textarea');

        const nm = nameInput ? nameInput.value.trim() : '';
        const sk = skuInput ? skuInput.value.trim() : '';
        if (!nm || !sk) {
            return { error: '请填写产品名称与 SKU', body: null };
        }

        const unitPayload = validUnitConv.map(function (c) {
            return { unitName: c.unitName, ratio: c.ratio, isDefault: false };
        });

        const baseUnitStr = baseUnitInput ? baseUnitInput.value.trim() : '';
        var catRaw = categorySelect && categorySelect.value ? parseInt(categorySelect.value, 10) : null;
        var supRaw = supplierSelect && supplierSelect.value ? parseInt(supplierSelect.value, 10) : null;
        var cp = this.currentProduct || {};
        const productPayload = {
            productId: cp.id || null,
            name: nm,
            sku: sk,
            categoryId: catRaw != null && !isNaN(catRaw) ? catRaw : null,
            supplierId: supRaw != null && !isNaN(supRaw) ? supRaw : null,
            price: priceInput ? parseFloat(priceInput.value) : 0,
            stock: stockInput ? parseInt(stockInput.value, 10) : 0,
            warningStock: warningStockInput && warningStockInput.value !== '' ? parseInt(warningStockInput.value, 10) : null,
            description: descTextarea ? descTextarea.value : '',
            baseUnit: baseUnitStr || null,
            purchaseUnit: purchaseUnitSelect && purchaseUnitSelect.value ? purchaseUnitSelect.value : null,
            salesUnit: salesUnitSelect && salesUnitSelect.value ? salesUnitSelect.value : null,
            region: cp.region != null ? cp.region : null,
            salesVolume: cp.salesVolume != null ? cp.salesVolume : null,
            tenantId: window.currentTenantId
        };

        return { error: null, body: { product: productPayload, unitConversions: unitPayload } };
    },

    /** 保存由 ui-product-center-enhance.js 接管；基座保留占位避免未加载增强时 onclick 报错 */
    saveProduct: async function () {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification('产品保存模块未就绪，请刷新页面后重试', 'error');
        }
    },

    toggleAdvanced: function() {
        var root = document.getElementById('product-detail-modal');
        var drawer = root ? root.querySelector('#product-advanced-drawer') : document.getElementById('product-advanced-drawer');
        var icon = root ? root.querySelector('#product-detail-advanced-icon') : document.getElementById('product-detail-advanced-icon');
        var btn = root ? root.querySelector('.tm-product-advanced-toggle') : null;
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
    },

    formatCompoundStockDisplay: function(product) {
        var raw = Number(product && product.stock != null ? product.stock : 0) || 0;
        if (raw < 0) return '欠货' + Math.abs(Math.floor(raw));
        var baseQty = Math.max(0, Math.floor(raw));
        var baseUnit = (product && product.baseUnit ? String(product.baseUnit).trim() : '') || '件';
        var convs = (product && product.unitConversions) || [];
        if (!convs.length) return baseQty.toLocaleString() + baseUnit;
        var units = convs.map(function(c) {
            var ratio = Number(c.ratio != null ? c.ratio : c.perBase);
            var name = (c.unitName || c.unit || '').trim();
            if (!name || !ratio || ratio <= 0 || isNaN(ratio)) return null;
            return { unitName: name, ratio: ratio };
        }).filter(Boolean);
        if (!units.length) return baseQty.toLocaleString() + baseUnit;
        units.sort(function(a, b) { return b.ratio - a.ratio; });
        var remain = baseQty;
        var parts = [];
        units.forEach(function(u) {
            var count = Math.floor(remain / u.ratio);
            if (count > 0) {
                parts.push(count + u.unitName);
                remain -= count * u.ratio;
            }
        });
        if (remain > 0) parts.push(remain + baseUnit);
        if (!parts.length) parts.push('0' + baseUnit);
        return parts.join('');
    },

    // ---------- 单位换算（unitConversion 表） ----------
    escHtmlAttr: function(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    escHtmlText: function(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    getBaseUnitLabel: function() {
        var ids = ['detail-product-base-unit', 'product-base-unit-input', 'product-base-unit'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el && el.value) {
                var v = String(el.value).trim();
                if (v) return v;
            }
        }
        return '件';
    },

    normalizeUnitDraft: function(rows) {
        var src = Array.isArray(rows) ? rows.slice(0, 2) : [];
        var out = [];
        for (var i = 0; i < src.length; i++) {
            out.push({
                unitName: src[i].unitName != null ? String(src[i].unitName) : '',
                ratio: src[i].ratio != null ? src[i].ratio : ''
            });
        }
        while (out.length < 1) {
            out.push({ unitName: '', ratio: '' });
        }
        return out.slice(0, 2);
    },

    MAX_UNIT_CONVERSION_ROWS: 2,

    queryUnitModalRoots: function() {
        var modern = document.getElementById('product-unit-modal');
        if (modern) return [modern];
        return Array.prototype.slice.call(document.querySelectorAll('#unit-modal'));
    },

    getActiveUnitRowsContainer: function() {
        var modern = document.getElementById('product-unit-modal');
        if (modern && !modern.classList.contains('hidden')) {
            var rows = modern.querySelector('#unit-conversion-rows');
            if (rows) return rows;
        }
        var openModal = document.querySelector('#unit-modal:not(.hidden)');
        if (openModal) {
            var inOpen = openModal.querySelector('.tm-unit-conversion-rows');
            if (inOpen) return inOpen;
        }
        var roots = this.queryUnitModalRoots();
        for (var i = 0; i < roots.length; i++) {
            if (!roots[i].classList.contains('hidden')) {
                var c = roots[i].querySelector('#unit-conversion-rows') || roots[i].querySelector('.tm-unit-conversion-rows');
                if (c) return c;
            }
        }
        var first = roots[0];
        return first ? (first.querySelector('#unit-conversion-rows') || first.querySelector('.tm-unit-conversion-rows')) : null;
    },

    setUnitModalRowsHtml: function(html) {
        var c = this.getActiveUnitRowsContainer();
        if (c) {
            c.innerHTML = html;
            return;
        }
        var roots = this.queryUnitModalRoots();
        for (var i = 0; i < roots.length; i++) {
            var box = roots[i].querySelector('#unit-conversion-rows') || roots[i].querySelector('.tm-unit-conversion-rows');
            if (box) box.innerHTML = html;
        }
    },

    syncDraftFromApiConversions: function(list) {
        var mapped = (list || []).map(function (u) {
            var r = u.ratio != null ? u.ratio : '';
            return {
                unitName: u.unitName || u.unit_name || '',
                ratio: r
            };
        }).filter(function (row) {
            var hasName = row.unitName && String(row.unitName).trim();
            var hasRatio = row.ratio !== '' && row.ratio != null;
            return hasName || hasRatio;
        });
        this.unitConversionDraft = this.normalizeUnitDraft(mapped.length ? mapped : [{ unitName: '', ratio: '' }]);
    },

    collectValidConversionsFromDraft: function() {
        var draft = this.normalizeUnitDraft(this.unitConversionDraft);
        var valid = [];
        for (var i = 0; i < draft.length; i++) {
            var u = (draft[i].unitName || '').trim();
            var ratioNum = parseFloat(draft[i].ratio);
            if (!u && (draft[i].ratio === '' || draft[i].ratio == null)) {
                continue;
            }
            if (!u || !ratioNum || ratioNum <= 0 || isNaN(ratioNum)) {
                continue;
            }
            valid.push({ unitName: u, ratio: ratioNum });
        }
        return valid.slice(0, 2);
    },

    readUnitModalInputsIntoDraft: function() {
        var container = this.getActiveUnitRowsContainer();
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
            this.unitConversionDraft = this.normalizeUnitDraft(next);
        }
    },

    updateUnitModalAddRemoveButtons: function() {
        var n = this.normalizeUnitDraft(this.unitConversionDraft).length;
        var maxR = this.MAX_UNIT_CONVERSION_ROWS;
        var roots = this.queryUnitModalRoots();
        for (var r = 0; r < roots.length; r++) {
            var addBtn = roots[r].querySelector('.unit-modal-add-btn');
            var rmBtn = roots[r].querySelector('.unit-modal-remove-btn');
            if (addBtn) {
                addBtn.disabled = n >= maxR;
                addBtn.classList.toggle('opacity-40', n >= maxR);
                addBtn.classList.toggle('cursor-not-allowed', n >= maxR);
            }
            if (rmBtn) {
                rmBtn.disabled = n <= 1;
                rmBtn.classList.toggle('opacity-40', n <= 1);
                rmBtn.classList.toggle('cursor-not-allowed', n <= 1);
            }
        }
    },

    renderUnitModalRows: function() {
        if (!this.queryUnitModalRoots().length) return;
        var base = this.getBaseUnitLabel();
        this.unitConversionDraft = this.normalizeUnitDraft(this.unitConversionDraft);
        var draft = this.unitConversionDraft;
        var self = this;
        var html = '';
        for (var i = 0; i < draft.length; i++) {
            var row = draft[i];
            var un = self.escHtmlAttr(row.unitName != null ? row.unitName : '');
            var rv = row.ratio !== '' && row.ratio != null ? self.escHtmlAttr(row.ratio) : '';
            html += '<div class="unit-conversion-row flex flex-wrap items-end gap-2 sm:gap-3" data-row-index="' + i + '">';
            html += '<div class="flex-1 min-w-[5rem]">' + (i === 0 ? '<label class="text-[9px] font-black text-slate-400 uppercase block mb-1">包装单位</label>' : '<span class="block mb-1 h-[14px]" aria-hidden="true"></span>');
            html += '<input type="text" class="uc-unit-name form-input text-center font-bold w-full" placeholder="如：箱" value="' + un + '" autocomplete="off"></div>';
            html += '<div class="pb-2 text-slate-300 hidden sm:block select-none">=</div>';
            html += '<div class="flex-1 min-w-[5rem]">' + (i === 0 ? '<label class="text-[9px] font-black text-slate-400 uppercase block mb-1">折合基本数量</label>' : '<span class="block mb-1 h-[14px]" aria-hidden="true"></span>');
            html += '<input type="number" min="0.0001" step="any" class="uc-ratio form-input text-center text-brand-600 font-black w-full" placeholder="数量" value="' + rv + '" autocomplete="off"></div>';
            html += '<div class="pb-2 text-xs font-bold text-slate-400 shrink-0 uc-base-suffix">' + self.escHtmlText(base) + '</div>';
            html += '</div>';
        }
        this.setUnitModalRowsHtml(html);
        document.querySelectorAll('#product-unit-modal .uc-base-suffix, #unit-modal .uc-base-suffix').forEach(function (el) {
            el.textContent = base;
        });
        this.updateUnitModalAddRemoveButtons();
    },

    onBaseUnitChanged: function() {
        var modal = document.getElementById('product-detail-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        var pu = document.getElementById('detail-product-purchase-unit') || document.getElementById('product-purchase-unit-select');
        var su = document.getElementById('detail-product-sales-unit') || document.getElementById('product-sales-unit-select');
        var pv = pu ? pu.value : null;
        var sv = su ? su.value : null;
        this.rebuildPurchaseSalesUnitSelects(pv, sv);
    },

    rebuildPurchaseSalesUnitSelects: function(selectedPurchase, selectedSales) {
        var pu = document.getElementById('detail-product-purchase-unit')
            || document.getElementById('product-purchase-unit-select');
        var su = document.getElementById('detail-product-sales-unit')
            || document.getElementById('product-sales-unit-select');
        if (!pu || !su) return;

        var opts = this.buildPurchaseUnitSelectOptions();

        function fillSelect(sel, selVal) {
            var self = window.ProductModule;
            sel.innerHTML = opts.map(function (o) {
                return '<option value="' + self.escHtmlAttr(o.value) + '">' + self.escHtmlText(o.label) + '</option>';
            }).join('');
            if (selVal) {
                var has = Array.prototype.some.call(sel.options, function (op) {
                    return op.value === selVal;
                });
                if (has) sel.value = selVal;
            }
        }

        fillSelect(pu, selectedPurchase);
        fillSelect(su, selectedSales);

        if (!pu.value && opts.length) pu.selectedIndex = 0;
        if (!su.value && opts.length) su.selectedIndex = Math.min(1, opts.length - 1);
    },

    addUnitConversionRow: function() {
        this.readUnitModalInputsIntoDraft();
        if (this.unitConversionDraft.length >= this.MAX_UNIT_CONVERSION_ROWS) return;
        this.unitConversionDraft.push({ unitName: '', ratio: '' });
        this.renderUnitModalRows();
    },

    removeUnitConversionRow: function() {
        this.readUnitModalInputsIntoDraft();
        if (this.unitConversionDraft.length <= 1) return;
        this.unitConversionDraft.pop();
        this.renderUnitModalRows();
    },

    saveUnitConversionModal: async function() {
        var notify = function (msg, type) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification(msg, type);
            } else {
                alert(msg);
            }
        };

        this.readUnitModalInputsIntoDraft();
        var draft = this.normalizeUnitDraft(this.unitConversionDraft);
        var valid = [];
        for (var i = 0; i < draft.length; i++) {
            var u = (draft[i].unitName || '').trim();
            var ratioNum = parseFloat(draft[i].ratio);
            var emptyPair = !u && (draft[i].ratio === '' || draft[i].ratio == null);
            if (emptyPair) continue;
            if (!u || !ratioNum || ratioNum <= 0 || isNaN(ratioNum)) {
                notify('请填写完整的包装单位与折合基本数量（大于 0）', 'error');
                return;
            }
            valid.push({ unitName: u, ratio: ratioNum });
        }
        if (!valid.length) {
            notify('请至少配置一条单位换算（包装单位与折合基本数量）', 'error');
            return;
        }

        if (!this.currentProduct) {
            notify('请先打开产品编辑后再保存单位换算', 'error');
            return;
        }

        var built = this.buildProductSaveBodyWithUnits(valid);
        if (built.error) {
            notify(built.error, 'error');
            return;
        }

        try {
            if (window.checkAuth && !window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(built.body)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            const saved = data.data || {};
            if (saved.productId != null && this.currentProduct && !this.currentProduct.id) {
                this.currentProduct.id = saved.productId;
            }
            this.currentProduct.unitConversions = valid.map(function (v) {
                return { unitName: v.unitName, ratio: v.ratio };
            });

            this.unitConversionDraft = this.normalizeUnitDraft(valid);
            this.rebuildPurchaseSalesUnitSelects(
                document.getElementById('product-purchase-unit-select') ? document.getElementById('product-purchase-unit-select').value : null,
                document.getElementById('product-sales-unit-select') ? document.getElementById('product-sales-unit-select').value : null
            );
            this.closeUnitModal();
            notify('单位换算已保存到数据库', 'success');
            await this.loadProducts();
        } catch (error) {
            console.error('[ProductModule] 保存单位换算异常:', error);
            notify('保存单位换算失败: ' + (error.message || String(error)), 'error');
        }
    },

    openUnitModal: async function() {
        var pid = this.currentProduct && (this.currentProduct.id || this.currentProduct.productId);
        if (pid) {
            await this.refreshUnitConversionDraftFromApi(pid);
        }
        this.unitConversionDraft = this.normalizeUnitDraft(this.unitConversionDraft);
        this.renderUnitModalRows();
        document.querySelectorAll('#unit-modal').forEach(function (modal) {
            modal.classList.remove('hidden');
        });
        var modern = document.getElementById('product-unit-modal');
        if (modern) modern.classList.remove('hidden');
    },

    refreshUnitConversionDraftFromApi: async function(productId) {
        if (!productId) return;
        try {
            var response = await window.wrappedFetch('/api/v1/rd/products/' + productId, { method: 'GET' });
            var data = await window.handleApiResponse(response);
            if (!data) return;
            var apiProduct = data.data || data;
            var mapped = this.mapProductFromApi(apiProduct);
            if (this.currentProduct && String(this.currentProduct.id) === String(mapped.id)) {
                this.currentProduct.unitConversions = mapped.unitConversions;
            }
            this.syncDraftFromApiConversions(mapped.unitConversions);
        } catch (err) {
            console.warn('[ProductModule] 加载单位换算失败', err);
        }
    },

    closeUnitModal: function() {
        document.querySelectorAll('#unit-modal').forEach(function (modal) {
            modal.classList.add('hidden');
        });
    },

    openWarehouseDrawer: async function() {
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            if (typeof window.TM_openUnifiedModal === 'function') {
                window.TM_openUnifiedModal(drawer);
            } else {
                drawer.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
            await this.loadWarehousesAndRender();
        }
    },

    loadWarehousesAndRender: async function() {
        const warehouses = await this.loadWarehouses();
        if (warehouses) {
            this.warehouses = warehouses;
            this.renderWarehouseList();
        }
    },

    renderWarehouseList: function() {
        const container = document.getElementById('warehouse-list-container');
        if (!container) {
            console.error('[ProductModule] 未找到warehouse-list-container');
            return;
        }

        if (!this.warehouses || this.warehouses.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6">
                    <i class="ph ph-buildings text-4xl text-slate-300 mb-3"></i>
                    <p class="text-sm text-slate-400">暂无仓库</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.warehouses.map(warehouse => `
            <div class="bg-slate-50 rounded-xl p-4">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-slate-800">${warehouse.name}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">${warehouse.location || ''}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.ProductModule.openTransferModal(${warehouse.id})" class="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-500 hover:bg-amber-100 rounded-lg transition-all warehouse-transfer-btn" title="仓库调拨">
                            <i class="ph-bold ph-swap"></i>
                        </button>
                        <button onclick="window.ProductModule.editWarehouse(${warehouse.id})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors" title="编辑仓库">
                            <i class="ph ph-pencil text-slate-400"></i>
                        </button>
                        <button onclick="window.ProductModule.openDeleteWarehouseConfirm(${warehouse.id})" class="p-1.5 hover:bg-red-50 text-red-500 hover:bg-red-100 rounded-full transition-colors" title="删除仓库">
                            <i class="ph-bold ph-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    closeWarehouseDrawer: function() {
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            if (typeof window.TM_closeUnifiedModal === 'function') {
                window.TM_closeUnifiedModal(drawer);
            } else {
                drawer.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    },

    saveWarehouse: async function() {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const nameInput = document.getElementById('new-warehouse-name');
            const locationInput = document.getElementById('new-warehouse-location');
            
            if (!nameInput || !locationInput) {
                console.error('[ProductModule] 未找到仓库输入框');
                return;
            }

            // 仓库名称非空校验
            const name = nameInput.value.trim();
            if (!name) {
                console.error('[ProductModule] 仓库名称不能为空');
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('仓库名称不能为空！', 'error');
                }
                if (nameInput) nameInput.focus();
                return;
            }

            const warehouseData = {
                name: nameInput.value,
                address: locationInput.value
            };
            
            // 如果正在编辑，添加 warehouseId
            if (this.editingWarehouseId) {
                warehouseData.warehouseId = this.editingWarehouseId;
            }
            
            const response = await window.wrappedFetch('/api/v1/rd/products/warehouses/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(warehouseData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            if (window.TM_UI && window.TM_UI.showNotification) {
                const actionText = this.editingWarehouseId ? '更新' : '保存';
                window.TM_UI.showNotification('仓库 "' + nameInput.value + '" 已' + actionText + '！', 'success');
            }

            nameInput.value = '';
            locationInput.value = '';
            this.editingWarehouseId = null;
            await this.loadWarehousesAndRender();
            if (window.TM_TenantOps) {
                await window.TM_TenantOps.maybePromptWarehouseMigration(data);
                window.TM_TenantOps.invalidateProfile();
            }
            if (typeof window.TM_emitWarehousesChanged === 'function') {
                var savedWh = data && (data.data || data);
                var whId = savedWh && (savedWh.warehouseId || savedWh.warehouse_id || savedWh.id);
                window.TM_emitWarehousesChanged({ warehouseId: whId });
            }
        } catch (error) {
            console.error('[ProductModule] 保存仓库异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存仓库失败: ' + error.message, 'error');
            }
        }
    },
    
    editWarehouse: function(warehouseId) {
        const warehouse = this.warehouses.find(w => String(w.id) === String(warehouseId));
        if (!warehouse) {
            console.error('[ProductModule] 未找到仓库:', warehouseId);
            return;
        }
        
        const nameInput = document.getElementById('new-warehouse-name');
        const locationInput = document.getElementById('new-warehouse-location');
        
        if (nameInput) nameInput.value = warehouse.name || '';
        if (locationInput) locationInput.value = warehouse.location || '';
        
        this.editingWarehouseId = warehouse.id;
        },
    
    openDeleteWarehouseConfirm: function(warehouseId) {
        this.warehouseToDelete = warehouseId;
        
        // 复用删除确认弹窗，修改提示文字
        const confirmModal = document.getElementById('category-delete-confirm');
        const titleEl = confirmModal.querySelector('h3');
        const messageEl = confirmModal.querySelector('p');
        
        if (titleEl) titleEl.textContent = '确认删除仓库';
        if (messageEl) messageEl.textContent = '确定要删除此仓库吗？此操作无法撤销。';
        
        if (confirmModal) {
            confirmModal.classList.remove('hidden');
        }
    },
    
    deleteWarehouse: async function() {
        if (!this.warehouseToDelete) {
            console.error('[ProductModule] 没有要删除的仓库');
            return;
        }
        
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/warehouses/' + this.warehouseToDelete, {
                method: 'DELETE'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('仓库已删除！', 'success');
            }
            
            this.warehouseToDelete = null;
            this.hideDeleteConfirm();
            await this.loadWarehousesAndRender();
        } catch (error) {
            console.error('[ProductModule] 删除仓库异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('删除仓库失败: ' + error.message, 'error');
            }
        }
    },

    openPurchaseSuggestionModal: async function() {
        var modal = document.getElementById('purchase-suggestion-modal');
        var content = document.getElementById('purchase-suggestion-content');
        if (!modal || !content) return;
        if (typeof window.TM_openUnifiedModal === 'function') {
            window.TM_openUnifiedModal(modal);
        } else {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        this.purchaseGenGroups = [];
        this.purchaseGenPreviewRef = '';
        content.innerHTML = this._renderPurchaseGenLoading();
        try {
            var response = await window.wrappedFetch('/api/v1/supp/purchases/suggestions/generation', { method: 'GET' });
            var resp = await window.handleApiResponse(response);
            if (!resp) {
                content.innerHTML = '<div class="text-center py-16 text-slate-500 text-sm">无法加载进货建议</div>';
                return;
            }
            var payload = resp.data || {};
            this.purchaseGenPreviewRef = payload.previewRef || '';
            this.purchaseGenGroups = Array.isArray(payload.groups) ? payload.groups : [];
            this._renderPurchaseGenGroups(content);
        } catch (err) {
            console.error('[ProductModule] 进货建议加载失败', err);
            content.innerHTML = '<div class="text-center py-16 text-red-500 text-sm px-4">' + this._escHtml(String(err.message || '加载失败')) + '</div>';
        }
    },

    closePurchaseSuggestionModal: function() {
        var modal = document.getElementById('purchase-suggestion-modal');
        if (modal) {
            if (typeof window.TM_closeUnifiedModal === 'function') {
                window.TM_closeUnifiedModal(modal);
            } else {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    },

    removePurchaseGenSupplierGroup: function(supplierId) {
        var sid = String(supplierId);
        this.purchaseGenGroups = (this.purchaseGenGroups || []).filter(function (g) {
            return String(g.supplierId) !== sid;
        });
        var content = document.getElementById('purchase-suggestion-content');
        if (content) {
            this._renderPurchaseGenGroups(content);
        }
    },

    confirmPurchaseGenGroup: async function(supplierId) {
        var self = this;
        var sid = String(supplierId);
        var group = (this.purchaseGenGroups || []).find(function (g) {
            return String(g.supplierId) === sid;
        });
        if (!group || !group.items || !group.items.length) return;
        var wrap = document.querySelector('[data-purchase-gen-group="' + sid.replace(/"/g, '') + '"]');
        if (!wrap) return;
        var items = [];
        var total = 0;
        var purchaseDate = self._todayLocalISODate();
        group.items.forEach(function (line) {
            var pid = line.productId;
            var inp = wrap.querySelector('[data-suggest-qty-product="' + pid + '"]');
            var qty = inp ? (parseInt(inp.value, 10) || 0) : (Number(line.suggestQty) || 0);
            var price = Number(line.unitPrice) || 0;
            var unitName = line.purchaseUnit || line.baseUnit || '';
            if (qty <= 0) return;
            items.push({
                productId: Number(pid),
                quantity: qty,
                unitPrice: price,
                unitName: unitName,
                batchNo: '',
                purchaseStatus: 'PENDING_REVIEW',
                purchaseDate: purchaseDate
            });
            total += qty * price;
        });
        if (!items.length) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('请至少保留一条数量大于 0 的明细', 'warning');
            }
            return;
        }
        var parsedSid = sid === 'null' || sid === '' || sid === '0' ? null : parseInt(sid, 10);
        var purchaseData = {
            supplierId: parsedSid,
            purchaseStatus: 'PENDING_REVIEW',
            purchaseDate: purchaseDate,
            totalAmount: total,
            paidAmount: 0,
            items: items
        };
        var requestData = { purchase: purchaseData, items: items };
        try {
            var response = await window.wrappedFetch('/api/v1/supp/purchases/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            var result = await window.handleApiResponse(response);
            if (!result) return;
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('进货单已生成（待审核），可在供货管理中查看', 'success');
            }
            self.removePurchaseGenSupplierGroup(supplierId);
            window.dispatchEvent(new CustomEvent('tm-purchases-changed'));
            try {
                var refreshResp = await window.wrappedFetch('/api/v1/supp/purchases/suggestions/generation', { method: 'GET' });
                var refreshWrap = await window.handleApiResponse(refreshResp);
                if (refreshWrap && refreshWrap.data) {
                    self.purchaseGenGroups = Array.isArray(refreshWrap.data.groups) ? refreshWrap.data.groups : [];
                    var content = document.getElementById('purchase-suggestion-content');
                    if (content) self._renderPurchaseGenGroups(content);
                }
            } catch (refreshErr) {
                console.warn('[ProductModule] 刷新进货建议失败', refreshErr);
            }
        } catch (err) {
            console.error('[ProductModule] 生成进货单失败', err);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('生成失败: ' + (err.message || ''), 'error');
            }
        }
    },

    _todayLocalISODate: function() {
        var d = new Date();
        var z = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    },

    _escHtml: function (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    _renderPurchaseGenLoading: function() {
        var ref = 'PG-' + Date.now().toString(36).toUpperCase().slice(-8);
        return (
            '<div class="max-w-lg mx-auto py-10 px-4 space-y-8">' +
            '<div class="text-center space-y-2">' +
            '<p class="text-[10px] font-mono text-slate-400 tracking-widest">预览编号 · ' + this._escHtml(ref) + '</p>' +
            '<h3 class="text-lg font-black text-slate-800 tracking-tight">正在生成进货单据</h3>' +
            '<p class="text-xs text-slate-500">正在按规则筛选库存并汇总供应商进货周期内销量…</p>' +
            '</div>' +
            '<div class="h-2 bg-slate-100 rounded-full overflow-hidden">' +
            '<div class="h-full bg-gradient-to-r from-brand-500 to-teal-400 rounded-full w-2/3 animate-pulse"></div>' +
            '</div></div>'
        );
    },

    _renderPurchaseGenGroups: function (container) {
        var self = this;
        var groups = this.purchaseGenGroups || [];
        if (!groups.length) {
            container.innerHTML =
                '<div class="text-center py-16 px-6">' +
                '<div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-500">' +
                '<i class="ph ph-check-circle text-3xl"></i></div>' +
                '<p class="text-sm font-bold text-slate-700">当前无可展示的进货建议</p>' +
                '<p class="text-xs text-slate-400 mt-2">无「近14天有销量且库存≤预警」且可计算建议量的产品，或已全部生成/移除。</p>' +
                '</div>';
            return;
        }
        var previewRef = this.purchaseGenPreviewRef || '';
        var html = '';
        html +=
            '<div class="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">' +
            '<div><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">智能预览</p>' +
            '<p class="text-sm font-black text-slate-800">按供应商汇总的补货建议</p>' +
            '<p class="text-[10px] font-mono text-slate-400 mt-1">参考号 ' +
            self._escHtml(previewRef) +
            ' · 共 ' +
            groups.length +
            ' 家供应商</p></div>' +
            '<div class="flex items-center gap-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl w-fit">' +
            '<i class="ph ph-info"></i> 建议量 = (日均×进货周期+预警−库存)÷采购单位比（向上取整）</div></div>';

        groups.forEach(function (g) {
            var sid = g.supplierId == null ? '0' : String(g.supplierId);
            var sname = self._escHtml(g.supplierName || '');
            var items = g.items || [];
            html +=
                '<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-purchase-gen-group="' +
                sid +
                '">' +
                '<div class="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex flex-wrap items-center justify-between gap-3">' +
                '<div class="min-w-0"><h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">' +
                '<i class="ph ph-storefront text-brand-500"></i> <span>' +
                sname +
                '</span></h3>' +
                '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">' +
                items.length +
                ' 个 SKU · 统计窗 ' +
                self._escHtml(String(g.windowStart || '').slice(0, 10)) +
                ' ~ ' +
                self._escHtml(String(g.windowEnd || '').slice(0, 10)) +
                ' · 周期 ' +
                (g.cycleDays != null ? g.cycleDays : '-') +
                ' 天</span></div>' +
                '<div class="flex flex-wrap gap-2 shrink-0">' +
                '<button type="button" onclick="window.confirmPurchaseGenGroup(' +
                sid +
                ')" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black shadow-md hover:bg-slate-800 transition active:scale-95 flex items-center gap-1.5">' +
                '<i class="ph ph-file-plus"></i> 生成进货单</button>' +
                '<button type="button" onclick="window.removePurchaseGenSupplierGroup(' +
                sid +
                ')" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-bold hover:bg-red-50 hover:text-risk-high hover:border-red-100 transition">删除本组</button>' +
                '</div></div>';

            html += '<div class="hidden md:block overflow-x-auto"><table class="w-full text-left border-collapse">' +
                '<thead class="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-tighter border-b border-slate-100">' +
                '<tr><th class="px-6 py-4">产品名 (SKU)</th><th class="px-6 py-4 text-right">库存 / 预警</th>' +
                '<th class="px-6 py-4 text-right">周期销量(件)</th><th class="px-6 py-4 text-right">建议采购</th><th class="px-6 py-4 text-right">预估小计</th></tr></thead><tbody class="text-xs divide-y divide-slate-50">';

            items.forEach(function (p) {
                var st = p.stockStatus || '';
                var stClass = st === '缺货' ? 'text-risk-high' : 'text-orange-600';
                var lineBadge =
                    st === '缺货'
                        ? '<span class="ml-2 inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-50 text-risk-high">缺货</span>'
                        : '<span class="ml-2 inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">预警</span>';
                html +=
                    '<tr><td class="px-6 py-4"><p class="font-bold text-slate-800">' +
                    self._escHtml(p.name) +
                    '</p><p class="text-[10px] text-slate-400 font-mono">SKU: ' +
                    self._escHtml(p.sku) +
                    '</p><p class="text-[10px] text-slate-400 mt-1">采购单位: ' +
                    self._escHtml(p.purchaseUnit || p.baseUnit || '-') +
                    '</p></td>' +
                    '<td class="px-6 py-4 text-right"><span class="font-mono font-bold ' +
                    stClass +
                    '">' +
                    p.stock +
                    '</span><span class="text-slate-300"> / </span><span class="font-mono text-slate-500">' +
                    (p.warningStock != null ? p.warningStock : '-') +
                    '</span>' +
                    lineBadge +
                    '</td>' +
                    '<td class="px-6 py-4 text-right font-mono text-slate-700">' +
                    (p.soldBaseInWindow != null ? p.soldBaseInWindow : 0) +
                    '</td>' +
                    '<td class="px-6 py-4 text-right"><input type="number" min="0" data-suggest-qty-product="' +
                    p.productId +
                    '" value="' +
                    (p.suggestQty != null ? p.suggestQty : 0) +
                    '" class="w-20 px-2 py-1 border border-slate-200 rounded text-xs text-right"></td>' +
                    '<td class="px-6 py-4 text-right font-mono font-bold text-slate-900">¥' +
                    ((Number(p.unitPrice) || 0) * (Number(p.suggestQty) || 0)).toFixed(2) +
                    '</td></tr>';
            });

            html += '</tbody></table></div>';

            html += '<div class="md:hidden space-y-4 p-4">';
            items.forEach(function (p) {
                html +=
                    '<div class="border border-slate-100 rounded-xl p-4"><p class="font-bold text-slate-800">' +
                    self._escHtml(p.name) +
                    '</p><p class="text-[10px] text-slate-400 font-mono">SKU: ' +
                    self._escHtml(p.sku) +
                    '</p>' +
                    '<p class="text-[10px] text-teal-700 font-bold mt-1">采购单位: ' +
                    self._escHtml(p.purchaseUnit || p.baseUnit || '—') +
                    (p.suggestBaseUnits != null
                        ? (' · 约 ' + p.suggestBaseUnits + (p.baseUnit || '件') + '（已向上取整）')
                        : '') +
                    '</p>' +
                    '<div class="mt-3 space-y-2 text-xs"><div class="flex justify-between"><span class="text-slate-500">周期销量(' +
                    self._escHtml(p.baseUnit || '件') +
                    ')</span><span class="font-mono font-bold">' +
                    (p.soldBaseInWindow != null ? p.soldBaseInWindow : 0) +
                    '</span></div>' +
                    '<div class="flex justify-between items-center gap-2 min-w-0"><span class="text-slate-500 shrink-0">建议采购</span>' +
                    '<div class="flex items-center gap-1 min-w-0 flex-1 justify-end">' +
                    '<input type="number" min="0" data-suggest-qty-product="' +
                    p.productId +
                    '" value="' +
                    (p.suggestQty != null ? p.suggestQty : 0) +
                    '" class="w-16 max-w-[40%] px-2 py-1 border border-slate-200 rounded text-xs text-right font-mono shrink-0">' +
                    '<span class="text-[10px] text-slate-500 truncate max-w-[5rem]">' +
                    self._escHtml(p.purchaseUnit || p.baseUnit || '') +
                    '</span></div></div></div></div>';
            });
            html += '</div>';

            html +=
                '<div class="px-6 py-4 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">' +
                '<span class="text-sm font-bold text-slate-800">本供应商小计（按建议量）</span>' +
                '<span class="font-mono font-bold text-slate-900">¥' +
                (typeof g.groupSubtotal === 'number' ? g.groupSubtotal.toFixed(2) : '0.00') +
                '</span></div></div>';
        });

        container.innerHTML = html;
    },

    savePurchaseOrder: function() {
        this.closePurchaseSuggestionModal();
    },

    closeCostAnalysis: function() {
        const modal = document.getElementById('cost-analysis-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    closeWorkshopModal: function() {
        const modal = document.getElementById('workshop-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    closeClearanceModal: function() {
        const modal = document.getElementById('clearance-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    openCategoryManager: async function() {
        const modal = document.getElementById('category-modal-root');
        if (modal) {
            if (typeof window.TM_openUnifiedModal === 'function') {
                window.TM_openUnifiedModal(modal);
            } else {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
            await this.loadCategories();
            this.renderCategoryList();
        }
    },

    closeCategoryManager: function() {
        const modal = document.getElementById('category-modal-root');
        if (modal) {
            if (typeof window.TM_closeUnifiedModal === 'function') {
                window.TM_closeUnifiedModal(modal);
            } else {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    },

    editingCategory: null,

    renderCategoryList: function() {
        const container = document.getElementById('category-edit-list');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6">
                    <i class="ph ph-tree-structure text-4xl text-slate-300 mb-3"></i>
                    <p class="text-sm text-slate-400">暂无分类</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.categories.map((cat, idx) => {
            const isEditing = this.editingCategory === idx;
            if (isEditing) {
                return `
                    <div class="flex items-center justify-between px-4 py-3 bg-teal-50 rounded-2xl border border-teal-200 transition-colors">
                        <div class="flex items-center gap-3 flex-1">
                            <div class="w-8 h-8 bg-teal-500 rounded-xl flex items-center justify-center">
                                <i class="ph ph-folder text-white"></i>
                            </div>
                            <input type="text" id="edit-category-${idx}" value="${cat.name}" class="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.ProductModule.saveCategoryEdit(${idx})" class="p-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition-colors" title="保存">
                                <i class="ph ph-check"></i>
                            </button>
                            <button onclick="window.ProductModule.cancelCategoryEdit()" class="p-2 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition-colors" title="取消">
                                <i class="ph ph-x"></i>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-teal-200 transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center">
                                <i class="ph ph-folder text-teal-600"></i>
                            </div>
                            <div>
                                <p class="font-bold text-slate-800 text-sm">${cat.name}</p>
                                <p class="text-[10px] text-slate-400">${cat.subcategories.length} 个子类别</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.ProductModule.startCategoryEdit(${idx})" class="p-2 hover:bg-teal-100 rounded-full transition-colors" title="编辑">
                                <i class="ph ph-pencil text-teal-600"></i>
                            </button>
                            <button onclick="window.ProductModule.showDeleteConfirm(${idx})" class="p-2 hover:bg-rose-100 rounded-full transition-colors" title="删除">
                                <i class="ph ph-trash text-rose-500"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    },

    startCategoryEdit: function(idx) {
        this.editingCategory = idx;
        this.renderCategoryList();
        setTimeout(() => {
            const input = document.getElementById(`edit-category-${idx}`);
            if (input) input.focus();
        }, 50);
    },

    cancelCategoryEdit: function() {
        this.editingCategory = null;
        this.renderCategoryList();
    },

    saveCategoryEdit: async function(idx) {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const input = document.getElementById(`edit-category-${idx}`);
            if (!input) {
                console.error('[ProductModule] 未找到编辑输入框');
                return;
            }

            const newName = input.value.trim();
            if (!newName) {
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('类别名称不能为空', 'warning');
                }
                return;
            }

            const categoryData = {
                categoryId: this.categories[idx].categoryId,
                name: newName,
                subCategories: this.categories[idx].subcategories || []
            };

            const response = await window.wrappedFetch('/api/v1/rd/products/categories/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('类别已更新为 "' + newName + '"！', 'success');
            }

            this.editingCategory = null;
            await this.loadCategories();
            this.renderCategoryList();
        } catch (error) {
            console.error('[ProductModule] 更新类别异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('更新类别失败: ' + error.message, 'error');
            }
        }
    },

    addCategory: async function() {
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const input = document.getElementById('new-category-input');
            if (!input) {
                console.error('[ProductModule] 未找到新增类别输入框');
                return;
            }

            const categoryName = input.value.trim();
            if (!categoryName) {
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('请输入类别名称', 'warning');
                }
                return;
            }

            const categoryData = {
                name: categoryName,
                subCategories: []
            };
            const response = await window.wrappedFetch('/api/v1/rd/products/categories/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('类别 "' + categoryName + '" 已保存！', 'success');
            }

            input.value = '';
            await this.loadCategories();
            this.renderCategoryList();
        } catch (error) {
            console.error('[ProductModule] 保存类别异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存类别失败: ' + error.message, 'error');
            }
        }
    },

    currentDeleteCategory: null,

    showDeleteConfirm: function(categoryIndex) {
        var category = this.categories[categoryIndex];
        if (!category) {
            console.error('[ProductModule] 未找到要删除的类别，index:', categoryIndex);
            return;
        }

        this.currentDeleteCategory = {
            index: categoryIndex,
            categoryId: category.categoryId,
            name: category.name
        };
        const modal = document.getElementById('category-delete-confirm');
        const titleEl = modal ? modal.querySelector('h3') : null;
        const messageEl = modal ? modal.querySelector('p') : null;
        if (titleEl) titleEl.textContent = '确认删除类别';
        if (messageEl) messageEl.textContent = '确定要删除类别 "' + category.name + '" 吗？此操作无法撤销。';
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    hideDeleteConfirm: function() {
        this.currentDeleteCategory = null;
        const modal = document.getElementById('category-delete-confirm');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    confirmDelete: async function() {
        if (this.warehouseToDelete) {
            await this.deleteWarehouse();
        } else if (this.currentDeleteCategory) {
            try {
                if (window.checkAuth && !window.checkAuth()) {
                    console.error('[ProductModule] checkAuth failed');
                    return;
                }

                const categoryId = this.currentDeleteCategory.categoryId;
                if (!categoryId) {
                    throw new Error('类别ID缺失，无法删除');
                }

                const response = await window.wrappedFetch('/api/v1/rd/products/categories/' + categoryId, {
                    method: 'DELETE'
                });

                const data = await window.handleApiResponse(response);
                if (!data) return;

                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('类别 "' + this.currentDeleteCategory.name + '" 已删除！', 'success');
                }

                await this.loadCategories();
                this.renderCategoryList();
                this.hideDeleteConfirm();
            } catch (error) {
                console.error('[ProductModule] 删除类别异常:', error);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('删除类别失败: ' + error.message, 'error');
                }
            }
        }
    },

    // ==================== 仓库调拨功能 ====================
    transferState: {
        sourceWarehouseId: null,
        sourceWarehouseName: '',
        targetWarehouseId: null,
        isVariablePrice: false,
        productRows: []
    },

    warehouses: [],

    openTransferModal: async function(warehouseId) {
        try {
            this.transferState.sourceWarehouseId = warehouseId;
            
            const warehouses = await this.loadWarehouses();
            if (warehouses) {
                this.warehouses = warehouses;
                const sourceWarehouse = warehouses.find(w => w.id === warehouseId);
                if (sourceWarehouse) {
                    this.transferState.sourceWarehouseName = sourceWarehouse.name;
                }
            }

            this.transferState.isVariablePrice = false;
            this.transferState.productRows = [];
            this.transferState.targetWarehouseId = null;

            const modal = document.getElementById('warehouse-transfer-modal');
            if (modal) {
                const sourceNameEl = document.getElementById('source-warehouse-name');
                if (sourceNameEl) {
                    sourceNameEl.textContent = this.transferState.sourceWarehouseName;
                }

                const targetSelect = document.getElementById('target-warehouse-select');
                if (targetSelect) {
                    targetSelect.innerHTML = '<option value="">请选择目标仓库</option>';
                    this.warehouses.forEach(w => {
                        if (w.id !== warehouseId) {
                            targetSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`;
                        }
                    });
                }

                const checkbox = modal.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                }

                this.addProductRow();
                modal.classList.remove('hidden');
            }
        } catch (error) {
            console.error('[ProductModule] 打开调拨弹窗异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('打开调拨弹窗失败: ' + error.message, 'error');
            }
        }
    },

    /** 仅平价调拨；变价分支已移除，由 enhance 接管 confirmTransfer */
    switchTransferType: function () { },

    addProductRow: function() {
        const rowId = Date.now();
        this.transferState.productRows.push({
            id: rowId,
            productId: null,
            productName: '',
            sku: '',
            price: 0,
            quantity: 0,
            total: 0
        });
        
        this.renderTransferProductList();
    },

    renderTransferProductList: function() {
        const tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;

        tbody.innerHTML = this.transferState.productRows.map(row => `
            <tr class="hover:bg-slate-50 transition-colors" data-row-id="${row.id}">
                <td class="px-4 py-3">
                    <select onchange="window.ProductModule.handleProductSelect(${row.id}, this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                        <option value="">请选择产品</option>
                        ${this.products.filter(p => p.stock > 0).map(p => `
                            <option value="${p.id}" ${row.productId === p.id ? 'selected' : ''}>${p.name} (${p.sku})</option>
                        `).join('')}
                    </select>
                </td>
                <td class="px-4 py-3 text-right">
                    <input type="number" 
                           class="transfer-price-input w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-mono focus:outline-none focus:border-teal-500 ${!this.transferState.isVariablePrice ? 'bg-slate-100' : ''}" 
                           value="${row.price.toFixed(2)}" 
                           onchange="window.ProductModule.calculateRowTotal(${row.id})"
                           oninput="window.ProductModule.calculateRowTotal(${row.id})"
                           ${!this.transferState.isVariablePrice ? 'readonly' : ''}>
                </td>
                <td class="px-4 py-3 text-right">
                    <input type="number" 
                           class="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-mono focus:outline-none focus:border-teal-500" 
                           value="${row.quantity}" 
                           onchange="window.ProductModule.calculateRowTotal(${row.id})"
                           oninput="window.ProductModule.calculateRowTotal(${row.id})">
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="transfer-total-input font-mono font-bold text-slate-800">$${row.total.toFixed(2)}</span>
                </td>
            </tr>
        `).join('');

        this.calculateGrandTotal();
    },

    handleProductSelect: function(rowId, productId) {
        const rowIndex = this.transferState.productRows.findIndex(r => r.id === rowId);
        if (rowIndex === -1) return;

        if (!productId) {
            this.transferState.productRows[rowIndex] = {
                id: rowId,
                productId: null,
                productName: '',
                sku: '',
                price: 0,
                quantity: 0,
                total: 0
            };
        } else {
            const product = this.products.find(p => p.id === parseInt(productId));
            if (product) {
                this.transferState.productRows[rowIndex] = {
                    id: rowId,
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku,
                    price: product.purchasePrice,
                    quantity: product.stock,
                    total: product.purchasePrice * product.stock
                };
            }
        }

        this.renderTransferProductList();
    },

    calculateRowTotal: function(rowId) {
        const tbody = document.getElementById('transfer-product-list');
        if (!tbody) return;

        const row = tbody.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!row) return;

        const priceInput = row.querySelector('.transfer-price-input');
        const qtyInput = row.querySelector('input[type="number"]:not(.transfer-price-input)');
        const totalSpan = row.querySelector('.transfer-total-input');

        const price = parseFloat(priceInput.value) || 0;
        const quantity = parseInt(qtyInput.value) || 0;
        const total = price * quantity;

        totalSpan.textContent = '$' + total.toFixed(2);

        const rowIndex = this.transferState.productRows.findIndex(r => r.id === rowId);
        if (rowIndex !== -1) {
            this.transferState.productRows[rowIndex].price = price;
            this.transferState.productRows[rowIndex].quantity = quantity;
            this.transferState.productRows[rowIndex].total = total;
        }

        this.calculateGrandTotal();
    },

    calculateGrandTotal: function() {
        const totalValueEl = document.getElementById('transfer-total-value');
        if (!totalValueEl) return;

        const grandTotal = this.transferState.productRows.reduce((sum, row) => sum + row.total, 0);
        totalValueEl.textContent = '$' + grandTotal.toFixed(2);
    },

    confirmTransfer: async function() {
        try {
            const targetSelect = document.getElementById('target-warehouse-select');
            if (!targetSelect || !targetSelect.value) {
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('请选择目标仓库', 'warning');
                }
                return;
            }

            const validRows = this.transferState.productRows.filter(r => r.productId && r.quantity > 0);
            if (validRows.length === 0) {
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('请至少选择一个产品并设置数量', 'warning');
                }
                return;
            }

            const transferData = {
                sourceWarehouseId: this.transferState.sourceWarehouseId,
                targetWarehouseId: parseInt(targetSelect.value),
                isVariablePrice: this.transferState.isVariablePrice,
                items: validRows.map(r => ({
                    productId: r.productId,
                    quantity: r.quantity,
                    price: r.price
                }))
            };

            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transferData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('调拨成功！', 'success');
            }

            await this.loadProducts();
            this.closeTransferModal();
        } catch (error) {
            console.error('[ProductModule] 调拨异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('调拨失败: ' + error.message, 'error');
            }
        }
    },

    closeTransferModal: function() {
        const modal = document.getElementById('warehouse-transfer-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.transferState = {
            sourceWarehouseId: null,
            sourceWarehouseName: '',
            targetWarehouseId: null,
            isVariablePrice: false,
            productRows: []
        };
    }
};

// ==================== 全局兼容函数 ====================
// 为了兼容旧代码，暴露全局函数别名
window.toggleDropdown = function(dropdownId, evt) { window.ProductModule.toggleDropdown(dropdownId, evt); };
window.selectCategory = function(categoryId, displayName) { window.ProductModule.selectCategoryFilter(categoryId, displayName); };
window.selectSupplier = function(supplierId, displayName) { window.ProductModule.selectSupplierFilter(supplierId, displayName); };
window.selectStockStatus = function(status) { window.ProductModule.selectStockStatus(status); };
window.updateResetButton = function() { window.ProductModule.updateResetButton(); };
window.resetFilters = function() { window.ProductModule.resetFilters(); };
window.filterInventoryTable = function() { window.ProductModule.filterInventoryTable(); };
window.filterProducts = function() { window.ProductModule.filterProducts(); };
window.renderProducts = function(productList) { window.ProductModule.renderProducts(productList); };
window.renderDesktopTable = function(productList) { window.ProductModule.renderDesktopTable(productList); };
window.renderMobileCards = function(productList) { window.ProductModule.renderMobileCards(productList); };
window.getStockColor = function(status) { return window.ProductModule.getStockColor(status); };
window.getStockBgColor = function(status) { return window.ProductModule.getStockBgColor(status); };
window.getStockPercentage = function(stock) { return window.ProductModule.getStockPercentage(stock); };
window.getStockStatusColor = function(status) { return window.ProductModule.getStockStatusColor(status); };
window.initCategoryOptions = function() { window.ProductModule.initCategoryOptions(); };
window.initSupplierOptions = function() { window.ProductModule.initSupplierOptions(); };
window.initStockOptions = function() { window.ProductModule.initStockOptions(); };
window.initFilterOptions = function() { window.ProductModule.initFilterOptions(); };
window.initProductList = function() { window.ProductModule.initProductList(); };
window.initProductCenter = function() { window.ProductModule.init(); };
window.openProductDetail = function(productId) { window.ProductModule.openProductDetail(productId); };
window.openCreateProductModal = function() { window.ProductModule.openCreateProductModal(); };
window.closeProductDetail = function() { window.ProductModule.closeProductDetail(); };
window.confirmDeleteProduct = function(productName) { window.ProductModule.confirmDeleteProduct(productName); };
window.saveProduct = function() { window.ProductModule.saveProduct(); };
/** 产品编辑弹窗：展开/收起高级配置（独立命名，避免被 dashboard 内联脚本覆盖 toggleAdvanced） */
window.toggleProductDetailAdvanced = function() {
    if (window.ProductModule && typeof window.ProductModule.toggleAdvanced === 'function') {
        window.ProductModule.toggleAdvanced();
    }
};

/** 兼容旧调用；'prod'/'cust' 为审核弹窗内 drawer；无参等同 toggleProductDetailAdvanced */
window.toggleAdvanced = function(type) {
    if (type === 'prod' || type === 'cust') {
        var drawer = document.getElementById('drawer-' + type);
        var icon = document.getElementById('icon-' + type) || document.getElementById('advanced-icon-' + type);
        if (!drawer) return;
        var open = drawer.classList.toggle('open');
        if (open) drawer.classList.remove('hidden');
        else drawer.classList.add('hidden');
        if (icon) {
            icon.classList.toggle('ph-caret-down', !open);
            icon.classList.toggle('ph-caret-up', open);
        }
        return;
    }
    window.toggleProductDetailAdvanced();
};

/** 工作台 dashboard 脚本注入后会覆盖 window.toggleAdvanced，需在注入后重新绑定 */
window.TM_bindProductCenterGlobalFns = function() {
    window.toggleProductDetailAdvanced = function() {
        if (window.ProductModule && typeof window.ProductModule.toggleAdvanced === 'function') {
            window.ProductModule.toggleAdvanced();
        }
    };
    window.toggleAdvanced = function(type) {
        if (type === 'prod' || type === 'cust') {
            var drawer = document.getElementById('drawer-' + type);
            var icon = document.getElementById('icon-' + type) || document.getElementById('advanced-icon-' + type);
            if (!drawer) return;
            var open = drawer.classList.toggle('open');
            if (open) drawer.classList.remove('hidden');
            else drawer.classList.add('hidden');
            if (icon) {
                icon.classList.toggle('ph-caret-down', !open);
                icon.classList.toggle('ph-caret-up', open);
            }
            return;
        }
        window.toggleProductDetailAdvanced();
    };
};
window.TM_bindProductCenterGlobalFns();
window.openUnitModal = function() { window.ProductModule.openUnitModal(); };
window.closeUnitModal = function() { window.ProductModule.closeUnitModal(); };
window.openWarehouseDrawer = function() { window.ProductModule.openWarehouseDrawer(); };
window.closeWarehouseDrawer = function() { window.ProductModule.closeWarehouseDrawer(); };
window.saveWarehouse = function() { window.ProductModule.saveWarehouse(); };
window.openPurchaseSuggestionModal = function() { window.ProductModule.openPurchaseSuggestionModal(); };
window.closePurchaseSuggestionModal = function() { window.ProductModule.closePurchaseSuggestionModal(); };
window.savePurchaseOrder = function() { window.ProductModule.savePurchaseOrder(); };
window.removePurchaseGenSupplierGroup = function(supplierId) { window.ProductModule.removePurchaseGenSupplierGroup(supplierId); };
window.confirmPurchaseGenGroup = function(supplierId) { window.ProductModule.confirmPurchaseGenGroup(supplierId); };
window.closeCostAnalysis = function() { window.ProductModule.closeCostAnalysis(); };
window.closeWorkshopModal = function() { window.ProductModule.closeWorkshopModal(); };
window.closeClearanceModal = function() { window.ProductModule.closeClearanceModal(); };
window.openCategoryModal = function() { window.ProductModule.openCategoryManager(); };
window.closeCategoryModal = function() { window.ProductModule.closeCategoryManager(); };
window.openCategoryManager = function() { window.ProductModule.openCategoryManager(); };
window.addCategory = function() { window.ProductModule.addCategory(); };
window.hideDeleteConfirm = function() { window.ProductModule.hideDeleteConfirm(); };
window.confirmDelete = function() { window.ProductModule.confirmDelete(); };
window.openTransferModal = function(warehouseId) { window.ProductModule.openTransferModal(warehouseId); };
window.switchTransferType = function(isVariablePrice) { window.ProductModule.switchTransferType(isVariablePrice); };
window.addProductRow = function() { window.ProductModule.addProductRow(); };
window.handleProductSelect = function(rowId, productId) { window.ProductModule.handleProductSelect(rowId, productId); };
window.calculateRowTotal = function(rowId) { window.ProductModule.calculateRowTotal(rowId); };
window.calculateGrandTotal = function() { window.ProductModule.calculateGrandTotal(); };
window.confirmTransfer = function() { window.ProductModule.confirmTransfer(); };
window.closeTransferModal = function() { window.ProductModule.closeTransferModal(); };
window.editWarehouse = function(warehouseId) { window.ProductModule.editWarehouse(warehouseId); };
window.openDeleteWarehouseConfirm = function(warehouseId) { window.ProductModule.openDeleteWarehouseConfirm(warehouseId); };
window.startCategoryEdit = function(idx) { window.ProductModule.startCategoryEdit(idx); };
window.cancelCategoryEdit = function() { window.ProductModule.cancelCategoryEdit(); };
window.saveCategoryEdit = function(idx) { window.ProductModule.saveCategoryEdit(idx); };

// 点击外部关闭下拉菜单（筛选块内含下拉层，点击选项由委托 stopPropagation 处理）
document.addEventListener('click', function(e) {
    if (e.target.closest('#category-filter') ||
        e.target.closest('#supplier-filter') ||
        e.target.closest('#stock-filter')) {
        return;
    }
    document.querySelectorAll('[id$="-dropdown"]').forEach(function (d) {
        d.classList.add('hidden');
        var filterId = d.id.replace('-dropdown', '-filter');
        var filterEl = document.getElementById(filterId);
        if (filterEl) {
            var caretIcon = filterEl.querySelector('.filter-caret-icon');
            if (caretIcon) {
                caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                caretIcon.classList.add('ph-caret-down');
            }
        }
    });
});

