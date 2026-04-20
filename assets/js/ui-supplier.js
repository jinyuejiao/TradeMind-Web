// Tab 切换函数
function switchSupplierMainView(viewType) {
    // 隐藏所有 Tab 内容
    document.querySelectorAll('.supplier-tab-content').forEach(el => el.classList.add('hidden'));
    // 显示选中的 Tab 内容
    document.getElementById('supplier-tab-' + viewType).classList.remove('hidden');
    
    // 更新按钮样式
    document.querySelectorAll('[id^="supplier-tab-btn-"]').forEach(btn => {
        btn.classList.remove('bg-[#14B8A6]', 'text-white');
        btn.classList.add('text-slate-600');
    });
    const activeBtn = document.getElementById('supplier-tab-btn-' + viewType);
    if (activeBtn) {
        activeBtn.classList.add('bg-[#14B8A6]', 'text-white');
        activeBtn.classList.remove('text-slate-600');
    }
}

window.SupplierModule = {
    states: [],
    suppliers: [],
    purchases: [],
    products: [],
    currentSupplier: null,
    currentPurchase: null,

    init: async function() {
        console.log('SupplierModule initialized');
        await Promise.all([
            this.loadStatuses(),
            this.loadSuppliers(),
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

    loadSuppliers: async function() {
        try {
            const response = await window.wrappedFetch('/api/v1/supp/suppliers', {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.suppliers = result.data;
                }
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    },

    loadPurchases: async function() {
        try {
            const response = await window.wrappedFetch('/api/v1/supp/purchases', {
                method: 'GET'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.purchases = result.data;
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

    renderSuppliers: function() {
        const container = document.getElementById('suppliers-list');
        if (!container) return;

        if (this.suppliers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="ph ph-truck text-4xl text-slate-300 mb-4"></i>
                    <p class="text-slate-400">暂无供应商</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.suppliers.map(supplier => `
            <div class="border border-slate-200 rounded-[2.5rem] p-5 hover:border-[#14B8A6] transition-all cursor-pointer bg-white" onclick="editSupplier(${supplier.supplierId})">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-slate-800 text-lg">${supplier.name || '未命名'}</h4>
                        <p class="text-sm text-slate-500 mt-1">${supplier.contact || '-'} · ${supplier.phone || '-'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); deleteSupplier(${supplier.supplierId})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all">
                            <i class="ph-bold ph-trash text-lg"></i>
                        </button>
                    </div>
                </div>
                ${supplier.address ? `<p class="text-sm text-slate-400"><i class="ph ph-map-pin mr-1"></i>${supplier.address}</p>` : ''}
            </div>
        `).join('');
    },

    renderPurchases: function() {
        const container = document.getElementById('orders-list');
        if (!container) return;

        if (this.purchases.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="ph ph-file-text text-4xl text-slate-300 mb-4"></i>
                    <p class="text-slate-400">暂无进货单</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.purchases.map(purchase => {
            const supplier = this.suppliers.find(s => s.supplierId === purchase.supplierId);
            const supplierName = supplier ? supplier.name : '未知供应商';
            
            return `
                <div class="border border-slate-200 rounded-[2.5rem] p-5 hover:border-[#14B8A6] transition-all cursor-pointer bg-white" onclick="editPurchase(${purchase.purchaseId})">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-bold text-slate-800 text-lg">${purchase.purchaseCode || 'PO-' + purchase.purchaseId}</h4>
                            <p class="text-sm text-slate-500 mt-1">${supplierName} · ${purchase.purchaseDate || '-'}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-mono font-bold text-slate-800 text-lg">¥${(purchase.totalAmount || 0).toFixed(2)}</p>
                            <div class="mt-2">${this.getStatusBadge(purchase.purchaseStatus)}</div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-400">${purchase.items ? purchase.items.length + ' 项商品' : ''}</span>
                        <button onclick="event.stopPropagation(); deletePurchase(${purchase.purchaseId})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all">
                            <i class="ph-bold ph-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    openSupplierModal: function() {
        this.currentSupplier = null;
        document.getElementById('supplier-modal-title').textContent = '新增供应商';
        document.getElementById('supplier-name').value = '';
        document.getElementById('supplier-contact').value = '';
        document.getElementById('supplier-phone').value = '';
        document.getElementById('supplier-address').value = '';
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
        document.getElementById('supplier-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    saveSupplier: async function() {
        const name = document.getElementById('supplier-name').value.trim();
        const contact = document.getElementById('supplier-contact').value.trim();
        const phone = document.getElementById('supplier-phone').value.trim();
        const address = document.getElementById('supplier-address').value.trim();

        if (!name) {
            alert('请输入供应商名称');
            return;
        }

        try {
            const supplierData = {
                name,
                contact,
                phone,
                address
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
                    await this.loadSuppliers();
                    this.renderSuppliers();
                    alert('保存成功');
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
                    await this.loadSuppliers();
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
        this.suppliers.forEach(supplier => {
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
                    await this.loadPurchases();
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
                    await this.loadPurchases();
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
window.deleteSupplier = function(supplierId) { 
    if (confirm('确定要删除这个供应商吗？')) { 
        window.SupplierModule.deleteSupplier(supplierId); 
    } 
};
window.editPurchase = function(purchaseId) { window.SupplierModule.editPurchase(purchaseId); };
window.deletePurchase = function(purchaseId) { 
    if (confirm('确定要删除这个进货单吗？')) { 
        window.SupplierModule.deletePurchase(purchaseId); 
    } 
};
