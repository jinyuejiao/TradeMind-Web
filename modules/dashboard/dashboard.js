/* ========================================================
 * TradeMind - Dashboard 工作台模块（新架构）
 * ========================================================
 * 工作台业务逻辑
 * ======================================================== */

(function() {
    'use strict';

    console.log('[Dashboard] 工作台模块加载中...');

    // ================ 全局变量 ================
    let dashboardData = null;
    let currentView = 'overview';

    // ================ 业务函数 ================

    /**
     * 加载工作台数据
     */
    async function loadDashboardData() {
        console.log('[Dashboard] 加载工作台数据...');
        
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            // 调用后端接口获取工作台数据
            const response = await window.wrappedFetch('/api/v1/dashboard', {
                method: 'GET'
            });
            
            const data = await window.handleApiResponse(response);
            if (!data) return;
            
            console.log('[Dashboard] 工作台数据:', data);
            dashboardData = data.data;
            renderDashboard(dashboardData);
            
        } catch (error) {
            console.error('[Dashboard] 获取工作台数据异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取工作台数据失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 渲染工作台
     * @param {Object} data - 工作台数据
     */
    function renderDashboard(data) {
        console.log('[Dashboard] 渲染工作台');
        
        // 检查容器是否存在
        if (!window.TM_UI.checkContainer('dashboard-container')) {
            return;
        }
        
        // 渲染逻辑...
        const container = document.getElementById('dashboard-container');
        if (container) {
            container.innerHTML = `
                <div class="p-6">
                    <h2 class="text-xl font-bold text-slate-800 mb-4">工作台</h2>
                    <p class="text-slate-500">数据加载完成</p>
                </div>
            `;
        }
    }

    /**
     * 切换视图
     * @param {string} view - 视图名称
     */
    function switchView(view) {
        console.log('[Dashboard] 切换视图:', view);
        currentView = view;
        
        // 更新按钮状态
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });
        
        // 渲染对应视图
        renderCurrentView();
    }

    /**
     * 渲染当前视图
     */
    function renderCurrentView() {
        console.log('[Dashboard] 渲染当前视图:', currentView);
        // 根据 currentView 渲染不同内容
    }

    /**
     * 刷新数据
     */
    function refreshData() {
        console.log('[Dashboard] 刷新数据');
        if (window.TM_UI.showNotification) {
            window.TM_UI.showNotification('正在刷新数据...', 'info');
        }
        loadDashboardData();
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

    window.TM_Actions.switchView = function(element) {
        const view = element.dataset.view;
        switchView(view);
    };

    window.TM_Actions.refreshData = function() {
        refreshData();
    };

    // ================ 注册到 TradeMindApp ================
    window.TradeMindApp.register('dashboard', function(options) {
        console.log('[Dashboard] 初始化工作台模块...');
        
        // 加载工作台数据
        loadDashboardData();
        
        // 注入公共 UI
        if (window.TM_UI && window.TM_UI.injectCommonUI) {
            window.TM_UI.injectCommonUI();
        }
    });

    console.log('[Dashboard] 工作台模块加载完成！');
})();
