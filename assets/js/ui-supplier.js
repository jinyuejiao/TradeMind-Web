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
}
window.switchSupplierView = switchSupplierMainView;

window.SupplierModule = {
    PAGE_SIZE: 20,
    states: [],
    suppliers: [],
    allSuppliers: [],
    purchases: [],
    products: [],
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
            this.loadProducts()
        ]);
        this.renderSuppliers();
        this.renderPurchases();
        this.initDateInput();
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

    loadProducts: async function() {
        try {
            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.products = result.data;
                }
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    },

    getStatusBadge: function(statusCode) {
        const state = this.states.find(s => s.dictCode === statusCode);
        const statusName = state ? state.dictName : statusCode || '未知';
        
        let color = 'bg-gray-100 text-gray-600 border-gray-200';
        
        switch(statusCode) {
            case 'DRAFT':
                color = 'bg-gray-100 text-gray-600 border-gray-200';
                break;
            case 'SUBMITTED':
                color = 'bg-orange-100 text-orange-600 border-orange-200';
                break;
            case 'APPROVED':
                color = 'bg-blue-100 text-blue-600 border-blue-200';
                break;
            case 'STOCKED':
                color = 'bg-teal-100 text-teal-600 border-teal-200';
                break;
            case 'CANCELLED':
                color = 'bg-red-100 text-red-600 border-red-200';
                break;
        }
        
        return `<span class="text-xs px-3 py-1 rounded-full font-bold border ${color}">${statusName}</span>`;
    },

    getRatingBadge: function(rating) {
        var value = parseFloat(rating);
        if (Number.isNaN(value)) {
            return '<span class="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full font-bold text-[10px]">-</span>';
        }
        if (value >= 4.5) {
            return '<span class="px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-bold text-[10px]">A+</span>';
        }
        if (value >= 3.8) {
            return '<span class="px-2 py-0.5 bg-teal-50 text-teal-600 rounded-full font-bold text-[10px]">A</span>';
        }
        if (value >= 3.0) {
            return '<span class="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-bold text-[10px]">B</span>';
        }
        return '<span class="px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-bold text-[10px]">C</span>';
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
        var disablePrevClass = page <= 1 ? 'opacity-40 cursor-not-allowed' : '';
        var disableNextClass = page >= totalPages ? 'opacity-40 cursor-not-allowed' : '';
        var disablePrevAttr = page <= 1 ? 'disabled' : '';
        var disableNextAttr = page >= totalPages ? 'disabled' : '';
        var prevAction = type === 'supplier'
            ? 'onclick="SupplierModule.setSupplierPage(' + (page - 1) + ')"'
            : 'onclick="SupplierModule.setPurchasePage(' + (page - 1) + ')"';
        var nextAction = type === 'supplier'
            ? 'onclick="SupplierModule.setSupplierPage(' + (page + 1) + ')"'
            : 'onclick="SupplierModule.setPurchasePage(' + (page + 1) + ')"';

        return `
            <div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
                <div class="text-xs text-slate-400">共 ${total} 条，当前第 ${page}/${totalPages} 页，每页最多 ${this.PAGE_SIZE} 条</div>
                <div class="flex items-center gap-2">
                    <button ${prevAction} ${disablePrevAttr} class="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 ${disablePrevClass}">上一页</button>
                    <button ${nextAction} ${disableNextAttr} class="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 ${disableNextClass}">下一页</button>
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
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4">供应商名称</th>
                                <th class="px-6 py-4">联系人</th>
                                <th class="px-6 py-4">电话</th>
                                <th class="px-6 py-4">评分</th>
                                <th class="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 text-slate-700">
                            ${rows.map((supplier) => `
                                <tr class="hover:bg-slate-50/80 transition-all">
                                    <td class="px-6 py-4 font-bold text-slate-800">${supplier.name || supplier.supplierName || '未命名'}</td>
                                    <td class="px-6 py-4">${supplier.contact || '-'}</td>
                                    <td class="px-6 py-4 font-mono">${supplier.phone || '-'}</td>
                                    <td class="px-6 py-4">${this.getRatingBadge(supplier.rating)}</td>
                                    <td class="px-6 py-4 text-right">
                                        <div class="flex justify-end gap-2">
                                            <button onclick="editSupplier(${supplier.supplierId})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><i class="ph ph-pencil text-slate-400"></i></button>
                                            <button onclick="deleteSupplier(${supplier.supplierId})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><i class="ph ph-trash text-slate-400 hover:text-red-500"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
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
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4">进货日期</th>
                                <th class="px-6 py-4">单据编号 / 来源</th>
                                <th class="px-6 py-4">供应商名称</th>
                                <th class="px-6 py-4 text-right col-hide-mobile">进货总额</th>
                                <th class="px-6 py-4 text-center">状态</th>
                                <th class="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 text-slate-700">
                            ${rows.map((purchase) => {
                                var supplier = this.suppliers.find((s) => String(s.supplierId) === String(purchase.supplierId));
                                if (!supplier) {
                                    supplier = this.allSuppliers.find((s) => String(s.supplierId) === String(purchase.supplierId));
                                }
                                var supplierName = purchase.supplierName || (supplier ? (supplier.name || supplier.supplierName) : '未知供应商');
                                return `
                                    <tr class="hover:bg-slate-50/80 transition-all cursor-pointer group" onclick="editPurchase(${purchase.purchaseId})">
                                        <td class="px-6 py-4 font-mono text-slate-400">${this.formatDate(purchase.purchaseDate)}</td>
                                        <td class="px-6 py-4">
                                            <p class="font-bold text-slate-800">${purchase.purchaseCode || ('PUR-' + purchase.purchaseId)}</p>
                                            <p class="text-[9px] text-slate-300 font-medium">提取源：系统录入</p>
                                        </td>
                                        <td class="px-6 py-4"><span class="font-bold text-brand-600">${supplierName || '-'}</span></td>
                                        <td class="px-6 py-4 text-right font-mono font-bold col-hide-mobile">¥${(purchase.totalAmount || 0).toFixed(2)}</td>
                                        <td class="px-6 py-4 text-center">${this.getStatusBadge(purchase.purchaseStatus)}</td>
                                        <td class="px-6 py-4 text-right">
                                            <div class="flex justify-end gap-2">
                                                <button onclick="event.stopPropagation(); editPurchase(${purchase.purchaseId})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><i class="ph ph-pencil text-slate-400"></i></button>
                                                <button onclick="event.stopPropagation(); deletePurchase(${purchase.purchaseId})" class="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><i class="ph ph-trash text-slate-400 hover:text-red-500"></i></button>
                                            </div>
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
        document.getElementById('supplier-name').value = '';
        document.getElementById('supplier-contact').value = '';
        document.getElementById('supplier-phone').value = '';
        document.getElementById('supplier-address').value = '';
        document.getElementById('supplier-rating').value = '4.5';
        document.getElementById('supplier-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    closeSupplierModal: function() {
        document.getElementById('supplier-modal').classList.add('hidden');
        document.body.style.overflow = '';
        this.currentSupplier = null;
    },

    editSupplier: async function(supplierId) {
        const supplier = this.suppliers.find(s => s.supplierId === supplierId);
        if (!supplier) return;

        this.currentSupplier = supplier;
        document.getElementById('supplier-modal-title').textContent = '编辑供应商';
        document.getElementById('supplier-name').value = supplier.name || '';
        document.getElementById('supplier-contact').value = supplier.contact || '';
        document.getElementById('supplier-phone').value = supplier.phone || '';
        document.getElementById('supplier-address').value = supplier.address || '';
        document.getElementById('supplier-rating').value = String(supplier.rating || '4.5');
        document.getElementById('supplier-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    saveSupplier: async function() {
        const name = document.getElementById('supplier-name').value.trim();
        const contact = document.getElementById('supplier-contact').value.trim();
        const phone = document.getElementById('supplier-phone').value.trim();
        const address = document.getElementById('supplier-address').value.trim();
        const ratingInput = document.getElementById('supplier-rating').value.trim();
        const rating = ratingInput ? parseFloat(ratingInput) : 0;

        if (!name) {
            alert('请输入供应商名称');
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
                    alert('保存失败: ' + (result.message || '未知错误'));
                }
            } else {
                alert('保存失败');
            }
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('保存失败: ' + error.message);
        }
    },

    deleteSupplier: async function(supplierId) {
        if (!confirm('确定要删除这个供应商吗？')) return;

        try {
            const response = await window.wrappedFetch('/api/v1/supp/suppliers/' + supplierId, {
                method: 'DELETE'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    await this.loadAllSuppliers();
                    await this.loadSuppliers(this.supplierCurrentPage);
                    if (this.suppliers.length === 0 && this.supplierCurrentPage > 1) {
                        await this.loadSuppliers(this.supplierCurrentPage - 1);
                    }
                    this.renderSuppliers();
                    alert('删除成功');
                } else {
                    alert('删除失败: ' + (result.message || '未知错误'));
                }
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('删除失败: ' + error.message);
        }
    },

    initDateInput: function() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('purchase-date');
        if (dateInput) {dateInput.value = today;}
    },

    openPurchaseModal: function() {
        this.currentPurchase = null;
        document.getElementById('purchase-modal-title').textContent = '新增进货单';
        
        this.populateSuppliersSelect();
        this.populateStatusesSelect();
        this.populateProductsSelects();
        
        this.resetPurchaseForm();
        document.getElementById('purchase-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    closePurchaseModal: function() {
        document.getElementById('purchase-modal').classList.add('hidden');
        document.body.style.overflow = '';
        this.currentPurchase = null;
    },

    resetPurchaseForm: function() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('purchase-supplier').value = '';
        document.getElementById('purchase-status').value = '';
        document.getElementById('purchase-date').value = today;
        
        const tbody = document.getElementById('purchase-items-tbody');
        tbody.innerHTML = `
            <tr class="purchase-item-row">
                <td class="px-4 py-3">
                    <select class="form-input product-select" onchange="SupplierModule.onProductSelect(this)">
                        <option value="">--- 选择产品 ---</option>
                    </select>
                </td>
                <td class="px-4 py-3"><input type="number" class="form-input text-center qty-input" value="1" min="1" oninput="SupplierModule.calculatePurchaseTotal()"></td>
                <td class="px-4 py-3"><input type="number" class="form-input text-center price-input" value="0" step="0.01" min="0" oninput="SupplierModule.calculatePurchaseTotal()"></td>
                <td class="px-4 py-3"><select class="form-input text-center unit-select"><option value="">--- 单位 ---</option></select></td>
                <td class="px-4 py-3"><input type="text" class="form-input text-center batch-input" placeholder="批次号"></td>
                <td class="px-4 py-3 text-right font-mono font-bold text-slate-400 row-total">¥0.00</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="SupplierModule.removePurchaseItem(this)" class="text-red-400 hover:text-red-600">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        
        this.populateProductsSelects();
        this.calculatePurchaseTotal();
    },

    populateSuppliersSelect: function() {
        const select = document.getElementById('purchase-supplier');
        select.innerHTML = '<option value="">--- 请选择供应商 ---</option>';
        const source = (this.allSuppliers && this.allSuppliers.length > 0) ? this.allSuppliers : this.suppliers;
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
        const selects = document.querySelectorAll('#purchase-items-table .product-select');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">--- 选择产品 ---</option>';
            this.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.productId;
                option.textContent = product.name || '未命名产品';
                option.dataset.unit = product.purchaseUnit || product.baseUnit || '';
                option.dataset.price = product.price || 0;
                select.appendChild(option);
            });
            if (currentValue) {select.value = currentValue;}
        });
    },

    onProductSelect: function(selectEl) {
        const row = selectEl.closest('tr');
        const productId = selectEl.value;
        const unitSelect = row.querySelector('.unit-select');
        const priceInput = row.querySelector('.price-input');
        
        if (!productId) {
            unitSelect.innerHTML = '<option value="">--- 单位 ---</option>';
            priceInput.value = 0;
            this.calculatePurchaseTotal();
            return;
        }
        
        const product = this.products.find(p => p.productId == productId);
        if (product) {
            unitSelect.innerHTML = '';
            if (product.baseUnit) {
                const option = document.createElement('option');
                option.value = product.baseUnit;
                option.textContent = product.baseUnit;
                unitSelect.appendChild(option);
            }
            if (product.purchaseUnit && product.purchaseUnit !== product.baseUnit) {
                const option = document.createElement('option');
                option.value = product.purchaseUnit;
                option.textContent = product.purchaseUnit;
                unitSelect.appendChild(option);
            }
            if (product.price) {priceInput.value = product.price;}
        }
        this.calculatePurchaseTotal();
    },

    addPurchaseItem: function() {
        const tbody = document.getElementById('purchase-items-tbody');
        const newRow = document.createElement('tr');
        newRow.className = 'purchase-item-row';
        newRow.innerHTML = `
            <td class="px-4 py-3">
                <select class="form-input product-select" onchange="SupplierModule.onProductSelect(this)">
                    <option value="">--- 选择产品 ---</option>
                </select>
            </td>
            <td class="px-4 py-3"><input type="number" class="form-input text-center qty-input" value="1" min="1" oninput="SupplierModule.calculatePurchaseTotal()"></td>
            <td class="px-4 py-3"><input type="number" class="form-input text-center price-input" value="0" step="0.01" min="0" oninput="SupplierModule.calculatePurchaseTotal()"></td>
            <td class="px-4 py-3"><select class="form-input text-center unit-select"><option value="">--- 单位 ---</option></select></td>
            <td class="px-4 py-3"><input type="text" class="form-input text-center batch-input" placeholder="批次号"></td>
            <td class="px-4 py-3 text-right font-mono font-bold text-slate-400 row-total">¥0.00</td>
            <td class="px-4 py-3 text-center">
                <button onclick="SupplierModule.removePurchaseItem(this)" class="text-red-400 hover:text-red-600">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(newRow);
        this.populateProductsSelects();
    },

    removePurchaseItem: function(btn) {
        const rows = document.querySelectorAll('.purchase-item-row');
        if (rows.length <= 1) {alert('至少需要一项商品');return;}
        btn.closest('tr').remove();
        this.calculatePurchaseTotal();
    },

    calculatePurchaseTotal: function() {
        const rows = document.querySelectorAll('.purchase-item-row');
        let total = 0;
        
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
            const price = parseFloat(row.querySelector('.price-input').value) || 0;
            const rowTotal = qty * price;
            total += rowTotal;
            
            row.querySelector('.row-total').textContent = '¥' + rowTotal.toFixed(2);
        });
        
        document.getElementById('purchase-grand-total').textContent = '¥' + total.toFixed(2);
    },

    editPurchase: async function(purchaseId) {
        const purchase = this.purchases.find(p => p.purchaseId === purchaseId);
        if (!purchase) return;

        this.currentPurchase = purchase;
        document.getElementById('purchase-modal-title').textContent = '编辑进货单';
        
        this.populateSuppliersSelect();
        this.populateStatusesSelect();
        
        document.getElementById('purchase-supplier').value = purchase.supplierId || '';
        document.getElementById('purchase-status').value = purchase.purchaseStatus || '';
        document.getElementById('purchase-date').value = purchase.purchaseDate || '';
        
        const tbody = document.getElementById('purchase-items-tbody');
        tbody.innerHTML = '';
        
        if (purchase.items && purchase.items.length > 0) {
            purchase.items.forEach(item => {
                const newRow = document.createElement('tr');
                newRow.className = 'purchase-item-row';
                newRow.innerHTML = `
                    <td class="px-4 py-3">
                        <select class="form-input product-select" onchange="SupplierModule.onProductSelect(this)">
                            <option value="">--- 选择产品 ---</option>
                        </select>
                    </td>
                    <td class="px-4 py-3"><input type="number" class="form-input text-center qty-input" value="${item.quantity || 1}" min="1" oninput="SupplierModule.calculatePurchaseTotal()"></td>
                    <td class="px-4 py-3"><input type="number" class="form-input text-center price-input" value="${item.unitPrice || 0}" step="0.01" min="0" oninput="SupplierModule.calculatePurchaseTotal()"></td>
                    <td class="px-4 py-3"><select class="form-input text-center unit-select"><option value="">--- 单位 ---</option></select></td>
                    <td class="px-4 py-3"><input type="text" class="form-input text-center batch-input" placeholder="批次号" value="${item.batchNo || ''}"></td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-slate-400 row-total">¥0.00</td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="SupplierModule.removePurchaseItem(this)" class="text-red-400 hover:text-red-600">
                            <i class="ph-bold ph-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(newRow);
            });
        } else {
            this.addPurchaseItem();
        }
        
        this.populateProductsSelects();
        
        if (purchase.items && purchase.items.length > 0) {
            const rows = tbody.querySelectorAll('.purchase-item-row');
            purchase.items.forEach((item, idx) => {
                if (rows[idx]) {
                    rows[idx].querySelector('.product-select').value = item.productId || '';
                    const unitSelect = rows[idx].querySelector('.unit-select');
                    if (item.unitName) {
                        const option = document.createElement('option');
                        option.value = item.unitName;
                        option.textContent = item.unitName;
                        option.selected = true;
                        unitSelect.appendChild(option);
                    }
                }
            });
        }
        
        this.calculatePurchaseTotal();
        document.getElementById('purchase-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    savePurchase: async function() {
        const supplierId = document.getElementById('purchase-supplier').value;
        const status = document.getElementById('purchase-status').value;
        const purchaseDate = document.getElementById('purchase-date').value;

        if (!supplierId) {alert('请选择供应商');return;}

        try {
            const rows = document.querySelectorAll('.purchase-item-row');
            const items = [];
            let totalAmount = 0;
            
            rows.forEach(row => {
                const productId = row.querySelector('.product-select').value;
                const qty = parseInt(row.querySelector('.qty-input').value) || 0;
                const price = parseFloat(row.querySelector('.price-input').value) || 0;
                const unitName = row.querySelector('.unit-select').value;
                const batchNo = row.querySelector('.batch-input').value;
                
                if (productId) {
                    items.push({
                        productId: parseInt(productId),
                        quantity: qty,
                        unitPrice: price,
                        unitName,
                        batchNo,
                        purchaseStatus: status || 'DRAFT',
                        purchaseDate: purchaseDate
                    });
                    totalAmount += qty * price;
                }
            });

            if (items.length === 0) {alert('请至少添加一项商品');return;}

            const purchaseData = {
                supplierId: parseInt(supplierId),
                purchaseStatus: status || 'DRAFT',
                purchaseDate: purchaseDate,
                totalAmount: totalAmount,
                paidAmount: 0,
                items: items
            };

            const requestData = {
                purchase: this.currentPurchase ? {
                    ...purchaseData,
                    purchaseId: this.currentPurchase.purchaseId
                } : purchaseData,
                items: items
            };

            const response = await window.wrappedFetch('/api/v1/supp/purchases/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.closePurchaseModal();
                    await this.loadPurchases(this.purchaseCurrentPage);
                    this.renderPurchases();
                    alert('保存成功');
                } else {
                    alert('保存失败: ' + (result.message || '未知错误'));
                }
            } else {
                alert('保存失败');
            }
        } catch (error) {
            console.error('Error saving purchase:', error);
            alert('保存失败: ' + error.message);
        }
    },

    deletePurchase: async function(purchaseId) {
        if (!confirm('确定要删除这个进货单吗？')) return;

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
                    alert('删除成功');
                } else {
                    alert('删除失败: ' + (result.message || '未知错误'));
                }
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('Error deleting purchase:', error);
            alert('删除失败: ' + error.message);
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
window.calculatePurchaseTotal = function() { window.SupplierModule.calculatePurchaseTotal(); };
window.editSupplier = function(supplierId) { window.SupplierModule.editSupplier(supplierId); };
window.deleteSupplier = function(supplierId) { window.SupplierModule.deleteSupplier(supplierId); };
window.editPurchase = function(purchaseId) { window.SupplierModule.editPurchase(purchaseId); };
window.deletePurchase = function(purchaseId) { window.SupplierModule.deletePurchase(purchaseId); };
