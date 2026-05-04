console.log('[ProductModule] 产品中心模块加载中...');

window.ProductModule = {
    // ==================== API数据映射函数 ====================
    mapProductFromApi: function(apiProduct) {
        return {
            id: apiProduct.productId || apiProduct.id,
            name: apiProduct.productName || apiProduct.name,
            sku: apiProduct.productSku || apiProduct.sku,
            categoryId: apiProduct.categoryId != null ? Number(apiProduct.categoryId) : null,
            supplierId: apiProduct.supplierId != null ? Number(apiProduct.supplierId) : null,
            category1: apiProduct.category1 || apiProduct.category,
            category2: apiProduct.category2,
            supplier: apiProduct.supplierName || apiProduct.supplier,
            region: apiProduct.marketRegion || apiProduct.region,
            price: apiProduct.salePrice || apiProduct.price,
            purchasePrice: apiProduct.costPrice || apiProduct.purchasePrice,
            stock: apiProduct.stockQuantity || apiProduct.stock,
            salesVolume: apiProduct.salesCount || apiProduct.salesVolume,
            icon: apiProduct.productIcon || apiProduct.icon || 'package',
            stockStatus: apiProduct.stockStatus || (
                (apiProduct.stockQuantity || apiProduct.stock) >= 100 ? '充足' :
                (apiProduct.stockQuantity || apiProduct.stock) >= 10 ? '预警' : '缺货'
            )
        };
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
    loadProducts: async function() {
        console.log('[ProductModule] loadProducts 被调用 ===');
        console.log('[ProductModule] 时间:', new Date().toISOString());
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            console.log('[ProductModule] 准备调用API: /api/v1/rd/products');
            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });
            console.log('[ProductModule] API响应状态:', response.status);

            const data = await window.handleApiResponse(response);
            console.log('[ProductModule] 解析后的数据:', data);
            if (!data) {
                console.error('[ProductModule] handleApiResponse返回null');
                return;
            }

            console.log('[ProductModule] 产品数据原始内容:', data);
            const productList = data.data || data;
            console.log('[ProductModule] 产品列表:', productList);
            console.log('[ProductModule] 产品列表是否为数组:', Array.isArray(productList));
            
            if (Array.isArray(productList)) {
                console.log('[ProductModule] 开始映射产品数据');
                this.products = productList.map(product => {
                    const mapped = this.mapProductFromApi(product);
                    console.log('[ProductModule] 原始产品:', product, '→ 映射后:', mapped);
                    return mapped;
                });
                console.log('[ProductModule] 产品数据映射完成，数量:', this.products.length);
                console.log('[ProductModule] 准备调用renderProducts');
                this.renderProducts(this.products);
            } else {
                console.error('[ProductModule] productList不是数组:', typeof productList);
            }
            
            return this.products;
        } catch (error) {
            console.error('[ProductModule] 加载产品数据异常:', error);
            console.error('[ProductModule] 错误堆栈:', error.stack);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载产品数据失败: ' + error.message, 'error');
            }
        }
    },

    loadCategories: async function() {
        console.log('[ProductModule] loadCategories 被调用 ===');
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/categories', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 分类数据:', data);
            const categoryList = data.data || data;
            
            if (Array.isArray(categoryList)) {
                this.categories = categoryList.map(category => this.mapCategoryFromApi(category));
                console.log('[ProductModule] 分类数据映射完成，数量:', this.categories.length);
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
        console.log('[ProductModule] loadSuppliers 被调用 ===');
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

            console.log('[ProductModule] 供应商数据:', data);
            const supplierRaw = data.data || data;
            const supplierList = Array.isArray(supplierRaw) ? supplierRaw : (supplierRaw.records || []);
            
            if (Array.isArray(supplierList)) {
                this.suppliers = supplierList;
                console.log('[ProductModule] 供应商数据加载完成，数量:', this.suppliers.length);
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
        console.log('[ProductModule] loadWarehouses 被调用 ===');
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products/warehouses', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 仓库数据:', data);
            const warehouseList = data.data || data;
            const mappedWarehouses = Array.isArray(warehouseList) 
                ? warehouseList.map(warehouse => this.mapWarehouseFromApi(warehouse))
                : [];
            
            console.log('[ProductModule] 仓库数据映射完成，数量:', mappedWarehouses.length);
            return mappedWarehouses;
        } catch (error) {
            console.error('[ProductModule] 加载仓库数据异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载仓库数据失败: ' + error.message, 'error');
            }
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
        searchText: ''
    },

    // 供应商列表
    suppliers: [],

    // 库存状态
    stockStatuses: ['全部', '充足', '预警', '缺货'],

    // 分类数据
    categories: [],

    // 当前选中的产品
    currentProduct: null,
    
    // 仓库相关状态
    editingWarehouseId: null,
    warehouseToDelete: null,

    /** 进货单据生成弹窗：后端返回的分组缓存 */
    purchaseGenGroups: [],
    purchaseGenPreviewRef: '',

    // ==================== 初始化函数 ====================
    init: async function() {
        console.log('[ProductModule] 初始化... 时间:', new Date().toISOString());
        await Promise.all([
            this.loadCategories(),
            this.loadSuppliers()
        ]);
        this.initFilterOptions();
        await this.loadProducts();
        console.log('[ProductModule] 初始化完成');
    },

    // ==================== 下拉菜单功能 ====================
    toggleDropdown: function(dropdownId, evt) {
        console.log('[ProductModule] toggleDropdown 被调用，参数:', dropdownId);
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
                    console.log('[ProductModule] 打开下拉框，更新箭头');
                    caretIcon.classList.remove('ph-caret-down');
                    caretIcon.classList.add('ph-caret-up', 'rotate-180', 'text-teal-500');
                } else {
                    console.log('[ProductModule] 关闭下拉框，重置箭头');
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
            }
        }
    },

    /** 下拉选项用 data-* + 委托点击，避免内联 onclick 与 JSON 引号破坏属性导致无法选中（主壳重复注入 DOM 时按节点重新绑定） */
    bindFilterDropdownDelegates: function() {
        var catDd = document.getElementById('category-dropdown');
        var supDd = document.getElementById('supplier-dropdown');
        var stkDd = document.getElementById('stock-dropdown');
        if (!catDd || !supDd || !stkDd) return;
        if (catDd.dataset.tmFilterDelegated === '1' && supDd.dataset.tmFilterDelegated === '1' && stkDd.dataset.tmFilterDelegated === '1') {
            return;
        }
        catDd.dataset.tmFilterDelegated = '1';
        supDd.dataset.tmFilterDelegated = '1';
        stkDd.dataset.tmFilterDelegated = '1';
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
        console.log('[ProductModule] selectStockStatus 被调用，参数:', status);
        this.filterState.stockStatus = status;
        
        const label = document.getElementById('stock-label');
        const btn = document.querySelector('#stock-filter > button');
        
        if (status && status !== '全部') {
            label.textContent = status;
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else {
            label.textContent = '库存情况';
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
        console.log('[ProductModule] updateResetButton 被调用 ===');
        const resetBtn = document.getElementById('reset-filter-btn');
        if (!resetBtn) return;
        
        const hasActiveFilter = this.filterState.categoryId != null || this.filterState.supplierId != null
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
        console.log('[ProductModule] resetFilters 被调用 ===');
        this.filterState = {
            categoryId: null,
            supplierId: null,
            stockStatus: null,
            searchText: ''
        };
        
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        document.getElementById('category-label').textContent = '产品类别';
        document.getElementById('supplier-label').textContent = '供应商';
        document.getElementById('stock-label').textContent = '库存情况';
        
        document.querySelectorAll('#category-filter > button, #supplier-filter > button, #stock-filter > button').forEach(function (btn) {
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        });
        
        this.updateResetButton();
        this.filterProducts();
    },

    filterInventoryTable: function() {
        console.log('[ProductModule] filterInventoryTable 被调用 ===');
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            this.filterState.searchText = searchInput.value;
            this.filterProducts();
        }
    },

    filterProducts: function() {
        console.log('[ProductModule] filterProducts 被调用 ===');
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
        
        console.log('[ProductModule] 筛选后产品数量:', filtered.length, '时间:', new Date().toISOString());
        this.renderProducts(filtered, { resetPage: true });
    },

    // ==================== 渲染功能 ====================
    renderProducts: function(productList, options) {
        const opts = options || {};
        console.log('[ProductModule] renderProducts 被调用，产品数量:', productList ? productList.length : 'null/undefined', '时间:', new Date().toISOString());
        if (!productList) {
            console.error('[ProductModule] productList为null或undefined');
            return;
        }
        
        console.log('[ProductModule] 产品列表内容:', productList);
        const sortedProducts = [...productList].sort((a, b) => b.salesVolume - a.salesVolume);
        console.log('[ProductModule] 排序后的产品列表:', sortedProducts);
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

        console.log('[ProductModule] 准备调用renderDesktopTable');
        this.renderDesktopTable(pageProducts);
        console.log('[ProductModule] 准备调用renderMobileCards');
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
        console.log('[ProductModule] renderProducts完成');
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
        const container = document.getElementById(config.containerId);
        if (!container) return;

        const page = Number(config.page) || 1;
        const totalPages = Math.max(1, Number(config.totalPages) || 1);
        const total = Number(config.total) || 0;
        const pageSize = Number(config.pageSize) || 20;
        const disablePrev = page <= 1;
        const disableNext = page >= totalPages;

        if (total === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
                <div class="text-xs text-slate-400">共 ${total} 条，当前第 ${page}/${totalPages} 页，每页最多 ${pageSize} 条</div>
                <div class="flex items-center gap-2">
                    <button onclick="${config.onPrev}" ${disablePrev ? 'disabled' : ''} class="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 ${disablePrev ? 'opacity-40 cursor-not-allowed' : ''}">上一页</button>
                    <button onclick="${config.onNext}" ${disableNext ? 'disabled' : ''} class="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 ${disableNext ? 'opacity-40 cursor-not-allowed' : ''}">下一页</button>
                </div>
            </div>
        `;
    },

    setProductPage: function(page) {
        const target = Number(page) || 1;
        if (target < 1 || target > this.productTotalPages) {
            return;
        }
        this.productCurrentPage = target;
        this.renderProducts(this.filteredProducts || this.products || [], { resetPage: false });
    },

    renderDesktopTable: function(productList) {
        console.log('[ProductModule] renderDesktopTable 被调用 ===');
        const tbody = document.querySelector('#existingProdTable tbody');
        console.log('[ProductModule] Desktop table tbody:', tbody);
        if (!tbody) {
            console.error('[ProductModule] 未找到existingProdTable tbody');
            return;
        }
        
        console.log('[ProductModule] 准备渲染产品数量:', productList.length);
        if (productList.length === 0) {
            console.log('[ProductModule] 产品列表为空，显示空状态');
            tbody.innerHTML = `
                <tr>
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
        
        console.log('[ProductModule] 开始渲染产品行');
        tbody.innerHTML = productList.map(product => {
            console.log('[ProductModule] 渲染产品:', product);
            return `
            <tr onclick="window.ProductModule.openProductDetail(${product.id})" class="product-row hover:bg-slate-50 transition-all cursor-pointer group">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors">
                            <i class="ph ph-${product.icon} text-xl"></i>
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 product-name-cell">${product.name}</p>
                            <p class="text-[10px] text-slate-400 font-mono product-sku-cell uppercase mt-1">SKU: ${product.sku}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-500 col-hide-mobile">
                    $${(product.price || 0).toFixed(2)}
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-brand-600 col-hide-mobile">
                    $${(product.purchasePrice || 0).toFixed(2)}
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-mono font-bold ${window.ProductModule.getStockColor(product.stockStatus)} tracking-tighter">
                        ${(product.stock || 0).toLocaleString()} <span class="text-[9px] text-slate-400 uppercase">Pcs</span>
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
                        <button onclick="event.stopPropagation(); window.ProductModule.confirmDeleteProduct(${product.id}, '${product.name}')" title="删除" class="action-icon-btn delete">
                            <i class="ph ph-trash text-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
        console.log('[ProductModule] renderDesktopTable完成');
    },

    renderMobileCards: function(productList) {
        console.log('[ProductModule] renderMobileCards 被调用 ===');
        const container = document.getElementById('mobile-product-cards');
        console.log('[ProductModule] Mobile cards container:', container);
        if (!container) {
            console.error('[ProductModule] 未找到mobile-product-cards容器');
            return;
        }
        
        if (productList.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                    <i class="ph ph-package text-4xl text-slate-300"></i>
                    <p class="text-slate-400 font-bold mt-3">暂无产品</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = productList.map(product => `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 product-card cursor-pointer hover:shadow-md transition-shadow" onclick="window.ProductModule.openProductDetail(${product.id})">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <i class="ph ph-${product.icon} text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <p class="font-bold text-slate-800">${product.name}</p>
                        <p class="text-[10px] text-slate-400 font-mono uppercase mt-1">SKU: ${product.sku}</p>
                        <div class="mt-2 grid grid-cols-2 gap-2">
                            <div>
                                <p class="text-[10px] text-slate-400">销售价</p>
                                <p class="font-mono font-bold text-slate-600">$${(product.price || 0).toFixed(2)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400">进货价</p>
                                <p class="font-mono font-bold text-brand-600">$${(product.purchasePrice || 0).toFixed(2)}</p>
                            </div>
                        </div>
                        <div class="mt-2 flex justify-between items-center">
                            <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">${product.region}</span>
                            <p class="font-mono font-bold ${window.ProductModule.getStockColor(product.stockStatus)}">
                                ${(product.stock || 0).toLocaleString()} Pcs
                            </p>
                        </div>
                        <div class="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div class="w-[${window.ProductModule.getStockPercentage(product.stock || 0)}%] ${window.ProductModule.getStockBgColor(product.stockStatus)} h-full ${product.stockStatus === '缺货' ? 'animate-pulse' : ''}"></div>
                        </div>
                    </div>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="event.stopPropagation(); window.ProductModule.openProductDetail(${product.id})" class="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-brand-600">
                        <i class="ph ph-pencil-simple-line text-lg"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.ProductModule.confirmDeleteProduct(${product.id}, '${product.name}')" class="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-risk-high">
                        <i class="ph ph-trash text-lg"></i>
                    </button>
                </div>
            </div>
        `).join('');
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
        console.log('[ProductModule] initCategoryOptions 被调用 ===');
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
        console.log('[ProductModule] initSupplierOptions 被调用 ===');
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
        console.log('[ProductModule] initStockOptions 被调用 ===');
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

    initFilterOptions: function() {
        console.log('[ProductModule] initFilterOptions 被调用 ===');
        this.bindFilterDropdownDelegates();
        this.initCategoryOptions();
        this.initSupplierOptions();
        this.initStockOptions();
    },

    initProductList: function() {
        console.log('[ProductModule] initProductList 被调用，产品数量:', this.products.length);
        this.renderProducts(this.products);
    },

    // ==================== 弹窗功能 ====================
    openProductDetail: async function(productId) {
        console.log('[ProductModule] openProductDetail 被调用，产品ID:', productId);
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch(`/api/v1/rd/products/${productId}`, {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            const apiProduct = data.data || data;
            const product = this.mapProductFromApi(apiProduct);
            console.log('[ProductModule] 产品详情:', product);
            
            this.currentProduct = product;
            
            // 加载类别和供应商列表并填充到下拉框
            await this.loadCategories();
            await this.loadSuppliers();
            this.populateCategorySelect(product.categoryId);
            this.populateSupplierSelect(product.supplierId || product.supplier);
            
            // 填充表单的初始值
            this.populateProductForm(product);
            
            // 显示弹窗
            const modal = document.getElementById('product-detail-modal');
            if (modal) {
                const titleEl = document.getElementById('detail-title');
                const skuEl = document.getElementById('detail-sku');
                if (titleEl) titleEl.textContent = '产品详情';
                if (skuEl) skuEl.textContent = 'SKU: ' + product.sku;
                modal.classList.remove('hidden');
            }
        } catch (error) {
            console.error('[ProductModule] 加载产品详情异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('加载产品详情失败: ' + error.message, 'error');
            }
        }
    },

    openCreateProductModal: async function() {
        console.log('[ProductModule] openCreateProductModal 被调用 ===');
        try {
            await Promise.all([
                this.loadCategories(),
                this.loadSuppliers()
            ]);

            this.currentProduct = {};
            this.populateCategorySelect(null);
            this.populateSupplierSelect(null);

            const nameInput = document.getElementById('product-name-input');
            const skuInput = document.getElementById('product-sku-input');
            const priceInput = document.getElementById('product-price-input');
            const stockInput = document.getElementById('product-stock-input');
            const warningStockInput = document.getElementById('product-warning-stock-input');
            const baseUnitInput = document.getElementById('product-base-unit-input');
            const descTextarea = document.getElementById('product-desc-textarea');
            const purchaseUnitSelect = document.getElementById('product-purchase-unit-select');
            const salesUnitSelect = document.getElementById('product-sales-unit-select');

            if (nameInput) nameInput.value = '';
            if (skuInput) skuInput.value = '';
            if (priceInput) priceInput.value = 0;
            if (stockInput) stockInput.value = 0;
            if (warningStockInput) warningStockInput.value = 0;
            if (baseUnitInput) baseUnitInput.value = '';
            if (descTextarea) descTextarea.value = '';
            if (purchaseUnitSelect) purchaseUnitSelect.selectedIndex = 0;
            if (salesUnitSelect) salesUnitSelect.selectedIndex = 0;

            const titleEl = document.getElementById('detail-title');
            const skuEl = document.getElementById('detail-sku');
            if (titleEl) titleEl.textContent = '新增产品';
            if (skuEl) skuEl.textContent = 'SKU: NEW';

            const modal = document.getElementById('product-detail-modal');
            if (modal) modal.classList.remove('hidden');
        } catch (error) {
            console.error('[ProductModule] 打开新增产品弹窗失败:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('打开新增产品弹窗失败: ' + error.message, 'error');
            }
        }
    },
    
    populateCategorySelect: function(selectedCategoryId) {
        const select = document.getElementById('product-category-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">请选择商品类别</option>';
        
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
        
        if (nameInput) nameInput.value = product.name || '';
        if (skuInput) skuInput.value = product.sku || '';
        if (priceInput) priceInput.value = product.price || 0;
        if (stockInput) stockInput.value = product.stock || 0;
    },

    closeProductDetail: function() {
        console.log('[ProductModule] closeProductDetail 被调用 ===');
        const modal = document.getElementById('product-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.currentProduct = null;
    },

    confirmDeleteProduct: async function(productId, productName) {
        console.log('[ProductModule] confirmDeleteProduct 被调用，产品ID:', productId, '产品名:', productName);
        if (confirm('确定要删除产品 "' + productName + '" 吗？')) {
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

                console.log('[ProductModule] 产品删除成功');
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('产品删除成功！', 'success');
                }
                
                await this.loadProducts();
            } catch (error) {
                console.error('[ProductModule] 删除产品异常:', error);
                if (window.TM_UI && window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('删除产品失败: ' + error.message, 'error');
                }
            }
        }
    },

    saveProduct: async function() {
        console.log('[ProductModule] saveProduct 被调用 ===');
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            if (!this.currentProduct) {
                console.error('[ProductModule] 没有选中的产品');
                return;
            }

            // 从表单获取当前值
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

            // 构建产品数据
            const productData = {
                productId: this.currentProduct.id,
                name: nameInput ? nameInput.value : this.currentProduct.name,
                sku: skuInput ? skuInput.value : this.currentProduct.sku,
                categoryId: categorySelect && categorySelect.value ? parseInt(categorySelect.value, 10) : this.currentProduct.categoryId,
                supplierId: supplierSelect && supplierSelect.value ? parseInt(supplierSelect.value, 10) : this.currentProduct.supplierId,
                price: priceInput ? parseFloat(priceInput.value) : this.currentProduct.price,
                stock: stockInput ? parseInt(stockInput.value) : this.currentProduct.stock,
                tenantId: window.currentTenantId
            };

            console.log('[ProductModule] 保存产品数据:', productData);

            // 根据是否有 productId 决定是更新还是创建
            let url, method;
            if (productData.productId) {
                url = `/api/v1/rd/products/${productData.productId}`;
                method = 'PUT';
            } else {
                url = '/api/v1/rd/products';
                method = 'POST';
            }

            const response = await window.wrappedFetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 产品保存成功');
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('产品保存成功！', 'success');
            }
            
            this.closeProductDetail();
            await this.loadProducts();
        } catch (error) {
            console.error('[ProductModule] 保存产品异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存产品失败: ' + error.message, 'error');
            }
        }
    },

    toggleAdvanced: function() {
        console.log('[ProductModule] toggleAdvanced 被调用 ===');
        const drawer = document.getElementById('advanced-drawer');
        const icon = document.getElementById('advanced-icon');
        if (drawer && icon) {
            drawer.classList.toggle('hidden');
            icon.classList.toggle('ph-caret-down');
            icon.classList.toggle('ph-caret-up');
        }
    },

    openUnitModal: function() {
        console.log('[ProductModule] openUnitModal 被调用 ===');
        document.querySelectorAll('#unit-modal, #unit-modal-product').forEach(function (modal) {
            modal.classList.remove('hidden');
        });
    },

    closeUnitModal: function() {
        console.log('[ProductModule] closeUnitModal 被调用 ===');
        document.querySelectorAll('#unit-modal, #unit-modal-product').forEach(function (modal) {
            modal.classList.add('hidden');
        });
    },

    openWarehouseDrawer: async function() {
        console.log('[ProductModule] openWarehouseDrawer 被调用 ===');
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            drawer.classList.remove('hidden');
            await this.loadWarehousesAndRender();
        }
    },

    loadWarehousesAndRender: async function() {
        console.log('[ProductModule] loadWarehousesAndRender 被调用 ===');
        const warehouses = await this.loadWarehouses();
        if (warehouses) {
            this.warehouses = warehouses;
            this.renderWarehouseList();
        }
    },

    renderWarehouseList: function() {
        console.log('[ProductModule] renderWarehouseList 被调用 ===');
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
        console.log('[ProductModule] closeWarehouseDrawer 被调用 ===');
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            drawer.classList.add('hidden');
        }
    },

    saveWarehouse: async function() {
        console.log('[ProductModule] saveWarehouse 被调用 ===');
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
            
            console.log('[ProductModule] 发送仓库数据:', warehouseData);

            const response = await window.wrappedFetch('/api/v1/rd/products/warehouses/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(warehouseData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 仓库保存成功:', data);
            if (window.TM_UI && window.TM_UI.showNotification) {
                const actionText = this.editingWarehouseId ? '更新' : '保存';
                window.TM_UI.showNotification('仓库 "' + nameInput.value + '" 已' + actionText + '！', 'success');
            }

            nameInput.value = '';
            locationInput.value = '';
            this.editingWarehouseId = null;
            await this.loadWarehousesAndRender();
        } catch (error) {
            console.error('[ProductModule] 保存仓库异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存仓库失败: ' + error.message, 'error');
            }
        }
    },
    
    editWarehouse: function(warehouseId) {
        console.log('[ProductModule] editWarehouse 被调用, warehouseId:', warehouseId);
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
        console.log('[ProductModule] 仓库信息已填充到表单');
    },
    
    openDeleteWarehouseConfirm: function(warehouseId) {
        console.log('[ProductModule] openDeleteWarehouseConfirm 被调用, warehouseId:', warehouseId);
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
        console.log('[ProductModule] deleteWarehouse 被调用, warehouseId:', this.warehouseToDelete);
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

            console.log('[ProductModule] 仓库删除成功');
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
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
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
            modal.classList.add('hidden');
        }
        document.body.style.overflow = '';
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
        var purchaseData = {
            supplierId: parseInt(sid, 10),
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
                window.TM_UI.showNotification('进货单已生成（待审核），可在供应商管理中查看', 'success');
            }
            self.removePurchaseGenSupplierGroup(supplierId);
            window.dispatchEvent(new CustomEvent('tm-purchases-changed'));
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
                '<p class="text-xs text-slate-400 mt-2">无「库存&gt;0 且缺货或预警」且可计算建议量的产品，或已全部生成/移除。</p>' +
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
            '<i class="ph ph-info"></i> 建议量 = 进货周期内销售件数 ÷ 采购单位换算比（向上取整）</div></div>';

        groups.forEach(function (g) {
            var sid = String(g.supplierId);
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
                    '<div class="mt-3 space-y-2 text-xs"><div class="flex justify-between"><span class="text-slate-500">周期销量</span><span class="font-mono font-bold">' +
                    (p.soldBaseInWindow != null ? p.soldBaseInWindow : 0) +
                    '</span></div>' +
                    '<div class="flex justify-between items-center"><span class="text-slate-500">建议采购</span>' +
                    '<input type="number" min="0" data-suggest-qty-product="' +
                    p.productId +
                    '" value="' +
                    (p.suggestQty != null ? p.suggestQty : 0) +
                    '" class="w-20 px-2 py-1 border border-slate-200 rounded text-xs text-right"></div></div></div>';
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
        console.log('[ProductModule] closeCostAnalysis 被调用 ===');
        const modal = document.getElementById('cost-analysis-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    closeWorkshopModal: function() {
        console.log('[ProductModule] closeWorkshopModal 被调用 ===');
        const modal = document.getElementById('workshop-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    closeClearanceModal: function() {
        console.log('[ProductModule] closeClearanceModal 被调用 ===');
        const modal = document.getElementById('clearance-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    openCategoryManager: async function() {
        console.log('[ProductModule] openCategoryManager 被调用 ===');
        const modal = document.getElementById('category-modal-root');
        if (modal) {
            modal.classList.remove('hidden');
            await this.loadCategories();
            this.renderCategoryList();
        }
    },

    closeCategoryManager: function() {
        console.log('[ProductModule] closeCategoryManager 被调用 ===');
        const modal = document.getElementById('category-modal-root');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    editingCategory: null,

    renderCategoryList: function() {
        console.log('[ProductModule] renderCategoryList 被调用 ===');
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
        console.log('[ProductModule] startCategoryEdit 被调用, idx:', idx);
        this.editingCategory = idx;
        this.renderCategoryList();
        setTimeout(() => {
            const input = document.getElementById(`edit-category-${idx}`);
            if (input) input.focus();
        }, 50);
    },

    cancelCategoryEdit: function() {
        console.log('[ProductModule] cancelCategoryEdit 被调用');
        this.editingCategory = null;
        this.renderCategoryList();
    },

    saveCategoryEdit: async function(idx) {
        console.log('[ProductModule] saveCategoryEdit 被调用, idx:', idx);
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

            console.log('[ProductModule] 发送分类编辑数据:', categoryData);

            const response = await window.wrappedFetch('/api/v1/rd/products/categories/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 类别更新成功:', data);
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
        console.log('[ProductModule] addCategory 被调用 ===');
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
            console.log('[ProductModule] 发送分类数据:', categoryData);

            const response = await window.wrappedFetch('/api/v1/rd/products/categories/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 类别保存成功:', data);
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

        console.log('[ProductModule] showDeleteConfirm 被调用，类别:', category.name);
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
        console.log('[ProductModule] hideDeleteConfirm 被调用 ===');
        this.currentDeleteCategory = null;
        const modal = document.getElementById('category-delete-confirm');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    confirmDelete: async function() {
        console.log('[ProductModule] confirmDelete 被调用');
        if (this.warehouseToDelete) {
            await this.deleteWarehouse();
        } else if (this.currentDeleteCategory) {
            console.log('[ProductModule] confirmDelete 删除类别:', this.currentDeleteCategory);
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
        console.log('[ProductModule] openTransferModal 被调用，仓库ID:', warehouseId);
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

    switchTransferType: function(isVariablePrice) {
        console.log('[ProductModule] switchTransferType 被调用，变价调拨:', isVariablePrice);
        this.transferState.isVariablePrice = isVariablePrice;
        
        const tbody = document.getElementById('transfer-product-list');
        if (tbody) {
            const priceInputs = tbody.querySelectorAll('.transfer-price-input');
            const totalInputs = tbody.querySelectorAll('.transfer-total-input');
            
            priceInputs.forEach(input => {
                input.readOnly = !isVariablePrice;
                if (!isVariablePrice) {
                    input.classList.add('bg-slate-100');
                } else {
                    input.classList.remove('bg-slate-100');
                }
            });
            
            totalInputs.forEach(input => {
                input.readOnly = !isVariablePrice;
                if (!isVariablePrice) {
                    input.classList.add('bg-slate-100');
                } else {
                    input.classList.remove('bg-slate-100');
                }
            });
        }
    },

    addProductRow: function() {
        console.log('[ProductModule] addProductRow 被调用');
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
        console.log('[ProductModule] renderTransferProductList 被调用');
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
        console.log('[ProductModule] handleProductSelect 被调用，行ID:', rowId, '产品ID:', productId);
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
        console.log('[ProductModule] calculateRowTotal 被调用，行ID:', rowId);
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
        console.log('[ProductModule] calculateGrandTotal 被调用');
        const totalValueEl = document.getElementById('transfer-total-value');
        if (!totalValueEl) return;

        const grandTotal = this.transferState.productRows.reduce((sum, row) => sum + row.total, 0);
        totalValueEl.textContent = '$' + grandTotal.toFixed(2);
    },

    confirmTransfer: async function() {
        console.log('[ProductModule] confirmTransfer 被调用');
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

            console.log('[ProductModule] 调拨数据:', transferData);

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

            console.log('[ProductModule] 调拨成功:', data);
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
        console.log('[ProductModule] closeTransferModal 被调用 ===');
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
window.toggleDropdown = function(dropdownId) { window.ProductModule.toggleDropdown(dropdownId); };
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
/** 无参：产品详情弹窗 advanced-drawer；'prod'/'cust'：主壳审核弹窗内 drawer-prod / drawer-cust */
window.toggleAdvanced = function(type) {
    if (type === 'prod' || type === 'cust') {
        var drawer = document.getElementById('drawer-' + type);
        var icon = document.getElementById('icon-' + type);
        if (drawer && icon) {
            drawer.classList.toggle('open');
            icon.classList.toggle('ph-caret-down');
            icon.classList.toggle('ph-caret-up');
        }
        return;
    }
    window.ProductModule.toggleAdvanced();
};
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

// 点击外部关闭下拉菜单
document.addEventListener('click', function(e) {
    if (!e.target.closest('#category-filter') && 
        !e.target.closest('#supplier-filter') && 
        !e.target.closest('#stock-filter')) {
        document.querySelectorAll('[id$="-dropdown"]').forEach(d => {
            d.classList.add('hidden');
            const filterId = d.id.replace('-dropdown', '-filter');
            const filterEl = document.getElementById(filterId);
            if (filterEl) {
                const caretIcon = filterEl.querySelector('.filter-caret-icon');
                if (caretIcon) {
                    caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                    caretIcon.classList.add('ph-caret-down');
                }
            }
        });
    }
});

console.log('[ProductModule] 产品中心模块加载完成');
