console.log('[ProductModule] 产品中心模块加载中...');

window.ProductModule = {
    // ==================== API数据映射函数 ====================
    mapProductFromApi: function(apiProduct) {
        return {
            id: apiProduct.productId || apiProduct.id,
            name: apiProduct.productName || apiProduct.name,
            sku: apiProduct.productSku || apiProduct.sku,
            categoryId: apiProduct.categoryId,
            supplierId: apiProduct.supplierId,
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

    // 筛选状态
    filterState: {
        category1: null,
        category2: null,
        supplier: null,
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
                    const caretIcon = filterEl.querySelector('.ph-caret-down, .ph-caret-up');
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
            const caretIcon = filterEl.querySelector('.ph-caret-down, .ph-caret-up');
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

    // ==================== 筛选功能 ====================
    selectCategory: function(category1, category2) {
        console.log('[ProductModule] selectCategory 被调用，参数:', category1, category2);
        this.filterState.category1 = category1;
        this.filterState.category2 = category2;
        
        const label = document.getElementById('category-label');
        const btn = document.getElementById('category-filter').querySelector('button');
        
        if (category1 && category2) {
            label.textContent = `${category1} > ${category2}`;
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else if (category1) {
            label.textContent = category1;
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else {
            label.textContent = '产品类别';
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        }
        
        document.getElementById('category-dropdown').classList.add('hidden');
        // 重置箭头图标
        const filterEl = document.getElementById('category-filter');
        if (filterEl) {
            const caretIcon = filterEl.querySelector('.ph-caret-down, .ph-caret-up');
            if (caretIcon) {
                caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                caretIcon.classList.add('ph-caret-down');
            }
        }
        this.updateResetButton();
        this.filterProducts();
    },

    selectSupplier: function(supplier) {
        console.log('[ProductModule] selectSupplier 被调用，参数:', supplier);
        this.filterState.supplier = supplier;
        
        const label = document.getElementById('supplier-label');
        const btn = document.getElementById('supplier-filter').querySelector('button');
        
        if (supplier && supplier !== '全部') {
            label.textContent = supplier;
            btn.classList.add('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        } else {
            label.textContent = '供应商';
            btn.classList.remove('bg-white', 'ring-2', 'ring-teal-500/20', 'shadow-md');
        }
        
        document.getElementById('supplier-dropdown').classList.add('hidden');
        // 重置箭头图标
        const supplierFilterEl = document.getElementById('supplier-filter');
        if (supplierFilterEl) {
            const caretIcon = supplierFilterEl.querySelector('.ph-caret-down, .ph-caret-up');
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
        const btn = document.getElementById('stock-filter').querySelector('button');
        
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
            const caretIcon = stockFilterEl.querySelector('.ph-caret-down, .ph-caret-up');
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
        
        const hasActiveFilter = this.filterState.category1 || this.filterState.supplier || this.filterState.stockStatus || this.filterState.searchText;
        
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
            category1: null,
            category2: null,
            supplier: null,
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
        
        document.querySelectorAll('#category-filter button, #supplier-filter button, #stock-filter button').forEach(btn => {
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
            const searchLower = this.filterState.searchText.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(searchLower) || 
                p.sku.toLowerCase().includes(searchLower)
            );
        }
        
        if (this.filterState.category1) {
            filtered = filtered.filter(p => p.category1 === this.filterState.category1);
            if (this.filterState.category2) {
                filtered = filtered.filter(p => p.category2 === this.filterState.category2);
            }
        }
        
        if (this.filterState.supplier && this.filterState.supplier !== '全部') {
            filtered = filtered.filter(p => p.supplier === this.filterState.supplier);
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
        
        container.innerHTML = `
            <button onclick="window.ProductModule.selectCategory(null, null)" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50">
                全部类别
            </button>
        ` + this.categories.map(cat => `
            <div class="border-b border-slate-50">
                <button onclick="window.ProductModule.selectCategory('${cat.name}', null)" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-800 hover:bg-teal-50 hover:text-teal-700 transition-all flex items-center justify-between">
                    <span>${cat.name}</span>
                    <i class="ph ph-caret-right text-slate-400"></i>
                </button>
                <div class="pl-4 bg-slate-50/30">
                    ${cat.subcategories.map(sub => `
                        <button onclick="window.ProductModule.selectCategory('${cat.name}', '${sub}')" class="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all">
                            <span class="ml-2">${sub}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    initSupplierOptions: function() {
        console.log('[ProductModule] initSupplierOptions 被调用 ===');
        const container = document.getElementById('supplier-options');
        if (!container) return;

        const supplierNames = ['全部'];
        (this.suppliers || []).forEach(supplier => {
            const name = supplier.supplierName || supplier.name;
            if (name && !supplierNames.includes(name)) {
                supplierNames.push(name);
            }
        });
        
        container.innerHTML = supplierNames.map(name => `
            <button onclick='window.ProductModule.selectSupplier(${JSON.stringify(name)})' class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50 last:border-b-0">
                ${name}
            </button>
        `).join('');
    },

    initStockOptions: function() {
        console.log('[ProductModule] initStockOptions 被调用 ===');
        const container = document.getElementById('stock-options');
        if (!container) return;
        
        container.innerHTML = this.stockStatuses.map(status => `
            <button onclick="window.ProductModule.selectStockStatus('${status}')" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50 last:border-b-0 flex items-center gap-3">
                ${status !== '全部' ? `<span class="inline-block w-2.5 h-2.5 ${window.ProductModule.getStockStatusColor(status)} rounded-full"></span>` : ''}
                ${status}
            </button>
        `).join('');
    },

    initFilterOptions: function() {
        console.log('[ProductModule] initFilterOptions 被调用 ===');
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
        const modal = document.getElementById('unit-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeUnitModal: function() {
        console.log('[ProductModule] closeUnitModal 被调用 ===');
        const modal = document.getElementById('unit-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
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

    openPurchaseSuggestionModal: function() {
        console.log('[ProductModule] openPurchaseSuggestionModal 被调用 ===');
        const modal = document.getElementById('purchase-suggestion-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closePurchaseSuggestionModal: function() {
        console.log('[ProductModule] closePurchaseSuggestionModal 被调用 ===');
        const modal = document.getElementById('purchase-suggestion-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    savePurchaseOrder: function() {
        console.log('[ProductModule] savePurchaseOrder 被调用 ===');
        alert('进货单已保存！');
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
window.selectCategory = function(category1, category2) { window.ProductModule.selectCategory(category1, category2); };
window.selectSupplier = function(supplier) { window.ProductModule.selectSupplier(supplier); };
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
window.toggleAdvanced = function() { window.ProductModule.toggleAdvanced(); };
window.openUnitModal = function() { window.ProductModule.openUnitModal(); };
window.closeUnitModal = function() { window.ProductModule.closeUnitModal(); };
window.openWarehouseDrawer = function() { window.ProductModule.openWarehouseDrawer(); };
window.closeWarehouseDrawer = function() { window.ProductModule.closeWarehouseDrawer(); };
window.saveWarehouse = function() { window.ProductModule.saveWarehouse(); };
window.openPurchaseSuggestionModal = function() { window.ProductModule.openPurchaseSuggestionModal(); };
window.closePurchaseSuggestionModal = function() { window.ProductModule.closePurchaseSuggestionModal(); };
window.savePurchaseOrder = function() { window.ProductModule.savePurchaseOrder(); };
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
                const caretIcon = filterEl.querySelector('.ph-caret-down, .ph-caret-up');
                if (caretIcon) {
                    caretIcon.classList.remove('ph-caret-up', 'rotate-180', 'text-teal-500');
                    caretIcon.classList.add('ph-caret-down');
                }
            }
        });
    }
});

console.log('[ProductModule] 产品中心模块加载完成');
