/* ========================================================
 * TradeMind - CRM 客户管理模块（新架构）
 * ========================================================
 * 客户管理业务逻辑
 * ======================================================== */

(function() {
    'use strict';

    console.log('[CRM] 客户管理模块加载中...');

    // ================ 全局变量 ================
    let allCustomers = [];
    let currentCustomerId = null;
    let isEditMode = false;

    // ================ 业务函数 ================

    /**
     * 加载客户列表
     */
    async function loadCustomers() {
        console.log('[CRM] 加载客户列表...');
        
        // 检查容器是否存在
        if (!window.TM_UI.checkContainer('customer-list-container')) {
            return;
        }
        
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            // 调用后端接口
            const response = await window.wrappedFetch('/api/v1/customers', {
                method: 'GET'
            });
            
            const data = await window.handleApiResponse(response);
            if (!data) return;
            
            console.log('[CRM] 客户列表数据:', data);
            renderCustomerList(data.data || []);
            
        } catch (error) {
            console.error('[CRM] 获取客户列表异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取客户列表失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 渲染客户列表
     * @param {Array} customers - 客户数组
     */
    function renderCustomerList(customers) {
        console.log('[CRM] 渲染客户列表:', customers.length, '个客户');
        allCustomers = customers;
        
        const container = document.getElementById('customer-list-container');
        if (!container) {
            console.error('[CRM] 客户列表容器不存在');
            return;
        }
        
        // 渲染逻辑...
        container.innerHTML = `
            <div class="p-4 text-center text-slate-500">
                共 ${customers.length} 个客户
            </div>
        `;
    }

    /**
     * 打开添加客户弹窗
     */
    function openAddCustomerModal() {
        console.log('[CRM] 打开添加客户弹窗');
        isEditMode = false;
        currentCustomerId = null;
        
        const modal = document.getElementById('add-customer-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 关闭添加客户弹窗
     */
    function closeAddCustomerModal() {
        console.log('[CRM] 关闭添加客户弹窗');
        const modal = document.getElementById('add-customer-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 编辑客户
     */
    function editCustomer() {
        console.log('[CRM] 编辑客户:', currentCustomerId);
        isEditMode = true;
        
        const modal = document.getElementById('edit-customer-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 关闭编辑客户弹窗
     */
    function closeEditCustomerModal() {
        console.log('[CRM] 关闭编辑客户弹窗');
        const modal = document.getElementById('edit-customer-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 确认删除客户
     */
    function deleteCustomerConfirm() {
        console.log('[CRM] 确认删除客户:', currentCustomerId);
        const modal = document.getElementById('delete-confirm-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 关闭删除确认弹窗
     */
    function closeDeleteConfirmModal() {
        console.log('[CRM] 关闭删除确认弹窗');
        const modal = document.getElementById('delete-confirm-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 隐藏客户详情（移动端）
     */
    function hideCrmDetail() {
        console.log('[CRM] 隐藏客户详情');
        document.body.classList.remove('crm-detail-active');
    }

    /**
     * 切换高级选项
     */
    function toggleAdvanced(mode, event) {
        console.log('[CRM] 切换高级选项:', mode);
        event.preventDefault();
        
        const advancedSection = document.getElementById(`advanced-${mode}`);
        if (advancedSection) {
            advancedSection.classList.toggle('hidden');
        }
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

    window.TM_Actions.openAddCustomerModal = function() {
        openAddCustomerModal();
    };

    window.TM_Actions.closeAddCustomerModal = function() {
        closeAddCustomerModal();
    };

    window.TM_Actions.hideCrmDetail = function() {
        hideCrmDetail();
    };

    window.TM_Actions.editCustomer = function() {
        editCustomer();
    };

    window.TM_Actions.deleteCustomerConfirm = function() {
        deleteCustomerConfirm();
    };

    window.TM_Actions.closeEditCustomerModal = function() {
        closeEditCustomerModal();
    };

    window.TM_Actions.toggleAdvanced = function(element, event) {
        const mode = element.dataset.mode;
        toggleAdvanced(mode, event);
    };

    window.TM_Actions.closeDeleteConfirmModal = function() {
        closeDeleteConfirmModal();
    };

    // ================ 注册到 TradeMindApp ================
    window.TradeMindApp.register('crm', function(options) {
        console.log('[CRM] 初始化客户管理模块...');
        
        // 加载客户列表
        loadCustomers();
        
        // 注入公共 UI
        if (window.TM_UI && window.TM_UI.injectCommonUI) {
            window.TM_UI.injectCommonUI();
        }
    });

    console.log('[CRM] 客户管理模块加载完成！');
})();
