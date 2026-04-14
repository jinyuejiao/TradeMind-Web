/* ========================================================
 * TradeMind - 供应链管理模块（新架构）
 * ========================================================
 * 供应链管理业务逻辑
 * ======================================================== */

(function() {
    'use strict';

    console.log('[SupplyChain] 供应链管理模块加载中...');

    // ================ 全局变量 ================
    let supplyChainData = null;
    let currentSupplierId = null;

    // ================ 业务函数 ================

    /**
     * 加载供应链数据
     */
    async function loadSupplyChainData() {
        console.log('[SupplyChain] 加载供应链数据...');
        
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            // 调用后端接口获取供应链数据
            const response = await window.wrappedFetch('/api/v1/supply-chain', {
                method: 'GET'
            });
            
            const data = await window.handleApiResponse(response);
            if (!data) return;
            
            console.log('[SupplyChain] 供应链数据:', data);
            supplyChainData = data.data;
            renderSupplyChain(supplyChainData);
            
        } catch (error) {
            console.error('[SupplyChain] 获取供应链数据异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取供应链数据失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 渲染供应链
     * @param {Object} data - 供应链数据
     */
    function renderSupplyChain(data) {
        console.log('[SupplyChain] 渲染供应链');
        
        // 检查容器是否存在
        if (!window.TM_UI.checkContainer('supplychain-container')) {
            return;
        }
        
        // 渲染逻辑...
        const container = document.getElementById('supplychain-container');
        if (container) {
            container.innerHTML = `
                <div class="p-6">
                    <h2 class="text-xl font-bold text-slate-800 mb-4">供应链管理</h2>
                    <p class="text-slate-500">数据加载完成</p>
                </div>
            `;
        }
    }

    /**
     * 加载供应商列表
     */
    async function loadSuppliers() {
        console.log('[SupplyChain] 加载供应商列表...');
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch('/api/v1/suppliers', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[SupplyChain] 供应商列表数据:', data);
            renderSupplierList(data.data || []);

        } catch (error) {
            console.error('[SupplyChain] 获取供应商列表异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取供应商列表失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 渲染供应商列表
     * @param {Array} suppliers - 供应商数组
     */
    function renderSupplierList(suppliers) {
        console.log('[SupplyChain] 渲染供应商列表:', suppliers.length, '个供应商');
        // 渲染逻辑...
    }

    /**
     * 打开添加供应商弹窗
     */
    function openAddSupplierModal() {
        console.log('[SupplyChain] 打开添加供应商弹窗');
        const modal = document.getElementById('add-supplier-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 关闭添加供应商弹窗
     */
    function closeAddSupplierModal() {
        console.log('[SupplyChain] 关闭添加供应商弹窗');
        const modal = document.getElementById('add-supplier-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 编辑供应商
     */
    function editSupplier() {
        console.log('[SupplyChain] 编辑供应商:', currentSupplierId);
        const modal = document.getElementById('edit-supplier-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 关闭编辑供应商弹窗
     */
    function closeEditSupplierModal() {
        console.log('[SupplyChain] 关闭编辑供应商弹窗');
        const modal = document.getElementById('edit-supplier-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 确认删除供应商
     */
    function deleteSupplierConfirm() {
        console.log('[SupplyChain] 确认删除供应商:', currentSupplierId);
        const modal = document.getElementById('delete-confirm-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 关闭删除确认弹窗
     */
    function closeDeleteConfirmModal() {
        console.log('[SupplyChain] 关闭删除确认弹窗');
        const modal = document.getElementById('delete-confirm-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 刷新数据
     */
    function refreshData() {
        console.log('[SupplyChain] 刷新数据');
        if (window.TM_UI.showNotification) {
            window.TM_UI.showNotification('正在刷新数据...', 'info');
        }
        loadSupplyChainData();
    }

    // ================ 注册到 TM_Actions ================
    window.TM_Actions.switchTab = function(element) {
        const tab = element.dataset.tab;
        window.TM_UI.switchTab(tab);
    };

    window.TM_Actions.openSubscriptionModal = function() {
        if (window.openSubscriptionModal) {
            window.openSubscriptionModal();
        }
    };

    window.TM_Actions.loadSuppliers = function() {
        loadSuppliers();
    };

    window.TM_Actions.openAddSupplierModal = function() {
        openAddSupplierModal();
    };

    window.TM_Actions.closeAddSupplierModal = function() {
        closeAddSupplierModal();
    };

    window.TM_Actions.editSupplier = function(element) {
        currentSupplierId = element.dataset.id;
        editSupplier();
    };

    window.TM_Actions.closeEditSupplierModal = function() {
        closeEditSupplierModal();
    };

    window.TM_Actions.deleteSupplierConfirm = function(element) {
        currentSupplierId = element.dataset.id;
        deleteSupplierConfirm();
    };

    window.TM_Actions.closeDeleteConfirmModal = function() {
        closeDeleteConfirmModal();
    };

    window.TM_Actions.refreshData = function() {
        refreshData();
    };

    // ================ 注册到 TradeMindApp ================
    window.TradeMindApp.register('supplychain', function(options) {
        console.log('[SupplyChain] 初始化供应链管理模块...');
        
        // 加载供应链数据
        loadSupplyChainData();
        
        // 注入公共 UI
        if (window.TM_UI && window.TM_UI.injectCommonUI) {
            window.TM_UI.injectCommonUI();
        }
    });

    console.log('[SupplyChain] 供应链管理模块加载完成！');
})();
