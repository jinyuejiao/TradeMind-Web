console.log('[ProductModule] 产品中心模块加载中...');

window.ProductModule = {
    // ==================== API数据映射函数 ====================
    mapProductFromApi: function(apiProduct) {
        return {
            id: apiProduct.productId || apiProduct.id,
            name: apiProduct.productName || apiProduct.name,
            sku: apiProduct.productSku || apiProduct.sku,
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
            name: apiCategory.categoryName || apiCategory.name,
            subcategories: apiCategory.subCategories || apiCategory.subcategories || []
        };
    },

    mapWarehouseFromApi: function(apiWarehouse) {
        return {
            id: apiWarehouse.warehouseId || apiWarehouse.id,
            name: apiWarehouse.warehouseName || apiWarehouse.name,
            location: apiWarehouse.warehouseLocation || apiWarehouse.location,
            capacity: apiWarehouse.capacity,
            status: apiWarehouse.status
        };
    },

    // ==================== API调用函数 ====================
    loadProducts: async function() {
        console.log('[ProductModule] loadProducts 被调用 ===');
        try {
            if (window.checkAuth && !window.checkAuth()) {
                console.error('[ProductModule] checkAuth failed');
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[ProductModule] 产品数据:', data);
            const productList = data.data || data;
            
            if (Array.isArray(productList)) {
                this.products = productList.map(product => this.mapProductFromApi(product));
                console.log('[ProductModule] 产品数据映射完成，数量:', this.products.length);
                this.renderProducts(this.products);
            }
            
            return this.products;
        } catch (error) {
            console.error('[ProductModule] 加载产品数据异常:', error);
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

    // 产品数据模型
    products: [],

    // 筛选状态
    filterState: {
        category1: null,
        category2: null,
        supplier: null,
        stockStatus: null,
        searchText: ''
    },

    // 供应商列表
    suppliers: ['全部'],

    // 库存状态
    stockStatuses: ['全部', '充足', '预警', '缺货'],

    // 分类数据
    categories: [],

    // 当前选中的产品
    currentProduct: null,

    // ==================== 初始化函数 ====================
    init: function() {
        console.log('[ProductModule] 初始化... 时间:', new Date().toISOString());
        this.initFilterOptions();
        this.loadProducts();
        console.log('[ProductModule] 初始化完成');
    },

    // ==================== 下拉菜单功能 ====================
    toggleDropdown: function(dropdownId) {
        console.log('[ProductModule] toggleDropdown 被调用，参数:', dropdownId);
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
        
        // 切换当前下拉框
        const isHidden = dropdown.classList.contains('hidden');
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
        
        // 阻止事件冒泡，防止触发 document 的关闭点击
        if (event) {
            event.stopPropagation();
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
        this.renderProducts(filtered);
    },

    // ==================== 渲染功能 ====================
    renderProducts: function(productList) {
        console.log('[ProductModule] renderProducts 被调用，产品数量:', productList.length, '时间:', new Date().toISOString());
        const sortedProducts = [...productList].sort((a, b) => b.salesVolume - a.salesVolume);
        
        this.renderDesktopTable(sortedProducts);
        this.renderMobileCards(sortedProducts);
    },

    renderDesktopTable: function(productList) {
        console.log('[ProductModule] renderDesktopTable 被调用 ===');
        const tbody = document.querySelector('#existingProdTable tbody');
        console.log('[ProductModule] Desktop table tbody:', tbody);
        if (!tbody) return;
        
        if (productList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center">
                        <div class="flex flex-col items-center gap-3">
                            <i class="ph ph-package text-4xl text-slate-300"></i>
                            <p class="text-slate-400 font-bold">暂无产品</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = productList.map(product => `
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
                <td class="px-6 py-4 col-hide-mobile">
                    <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold">${product.region}</span>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-500 col-hide-mobile">
                    $${product.price.toFixed(2)}
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-brand-600 col-hide-mobile">
                    $${product.purchasePrice.toFixed(2)}
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-mono font-bold ${window.ProductModule.getStockColor(product.stockStatus)} tracking-tighter">
                        ${product.stock.toLocaleString()} <span class="text-[9px] text-slate-400 uppercase">Pcs</span>
                    </p>
                    <div class="w-16 h-1 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden md:block hidden">
                        <div class="w-[${window.ProductModule.getStockPercentage(product.stock)}%] ${window.ProductModule.getStockBgColor(product.stockStatus)} h-full ${product.stockStatus === '缺货' ? 'animate-pulse' : ''}"></div>
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
        `).join('');
    },

    renderMobileCards: function(productList) {
        console.log('[ProductModule] renderMobileCards 被调用 ===');
        const container = document.getElementById('mobile-product-cards');
        console.log('[ProductModule] Mobile cards container:', container);
        if (!container) return;
        
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
                                <p class="font-mono font-bold text-slate-600">$${product.price.toFixed(2)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400">进货价</p>
                                <p class="font-mono font-bold text-brand-600">$${product.purchasePrice.toFixed(2)}</p>
                            </div>
                        </div>
                        <div class="mt-2 flex justify-between items-center">
                            <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">${product.region}</span>
                            <p class="font-mono font-bold ${window.ProductModule.getStockColor(product.stockStatus)}">
                                ${product.stock.toLocaleString()} Pcs
                            </p>
                        </div>
                        <div class="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div class="w-[${window.ProductModule.getStockPercentage(product.stock)}%] ${window.ProductModule.getStockBgColor(product.stockStatus)} h-full ${product.stockStatus === '缺货' ? 'animate-pulse' : ''}"></div>
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
        
        container.innerHTML = this.suppliers.map(supplier => `
            <button onclick="window.ProductModule.selectSupplier('${supplier}')" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-all border-b border-slate-50 last:border-b-0">
                ${supplier}
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
            const modal = document.getElementById('product-detail-modal');
            if (modal) {
                const titleEl = document.getElementById('detail-title');
                const skuEl = document.getElementById('detail-sku');
                if (titleEl) titleEl.textContent = product.name;
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

            const response = await window.wrappedFetch('/api/v1/rd/products/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.currentProduct)
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
            drawer.classList.toggle('open');
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

    openWarehouseDrawer: function() {
        console.log('[ProductModule] openWarehouseDrawer 被调用 ===');
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            drawer.classList.remove('hidden');
        }
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

            const warehouseData = {
                warehouseName: nameInput.value,
                warehouseLocation: locationInput.value
            };

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
                window.TM_UI.showNotification('仓库 "' + nameInput.value + '" 已保存！', 'success');
            }

            nameInput.value = '';
            locationInput.value = '';
            this.closeWarehouseDrawer();
        } catch (error) {
            console.error('[ProductModule] 保存仓库异常:', error);
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('保存仓库失败: ' + error.message, 'error');
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

        container.innerHTML = this.categories.map(cat => `
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
                    <button class="p-2 hover:bg-slate-200 rounded-full transition-colors" title="编辑">
                        <i class="ph ph-pencil text-slate-400"></i>
                    </button>
                    <button onclick="window.ProductModule.showDeleteConfirm('${cat.name}')" class="p-2 hover:bg-rose-100 rounded-full transition-colors" title="删除">
                        <i class="ph ph-trash text-rose-500"></i>
                    </button>
                </div>
            </div>
        `).join('');
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
                categoryName: categoryName,
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

    showDeleteConfirm: function(categoryName) {
        console.log('[ProductModule] showDeleteConfirm 被调用，类别:', categoryName);
        this.currentDeleteCategory = categoryName;
        const modal = document.getElementById('category-delete-confirm');
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
        console.log('[ProductModule] confirmDelete 被调用，删除类别:', this.currentDeleteCategory);
        if (!this.currentDeleteCategory) return;

        try {
            console.log('[ProductModule] 删除类别功能待实现');
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('删除功能开发中', 'info');
            }
            this.hideDeleteConfirm();
        } catch (error) {
            console.error('[ProductModule] 删除类别异常:', error);
        }
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
