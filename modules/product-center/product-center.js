/* ========================================================
 * TradeMind - 产品中心模块（新架构）
 * ========================================================
 * 产品中心业务逻辑
 * ======================================================== */

(function() {
    'use strict';

    console.log('[Product-Center] 产品中心模块加载中...');

    // ================ 全局变量 ================
    let allProducts = [];
    let currentProductId = null;
    let currentProductUnits = [];
    let currentDeleteProductId = null;
    let currentDeleteWarehouseId = null;
    let isEditMode = false;

    // ================ 业务函数 ================

    /**
     * 加载产品列表
     */
    async function loadProducts() {
        console.log('[Product-Center] 加载产品列表...');
        
        // 检查容器是否存在
        if (!window.TM_UI.checkContainer('product-list-container')) {
            return;
        }
        
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            // 调用后端接口
            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });
            
            // 检查响应状态码
            if (response.status === 401) {
                if (window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('登录过期，请重新登录', 'error');
                }
                window.location.href = '../../login.html';
                return;
            } else if (response.status === 500) {
                if (window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('服务器配置错误', 'error');
                }
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[Product-Center] 产品列表数据:', data);
            
            // 渲染产品列表
            renderProductList(data.data || []);
            
        } catch (error) {
            console.error('[Product-Center] 获取产品列表异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取产品列表失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 渲染产品列表
     * @param {Array} products - 产品数组
     */
    function renderProductList(products) {
        console.log('[Product-Center] 渲染产品列表:', products.length, '个产品');
        allProducts = products;
        
        const container = document.getElementById('product-list-container');
        if (!container) {
            console.error('[Product-Center] 产品列表容器不存在');
            return;
        }
        
        // 渲染逻辑...
        // 这里是示例，实际渲染逻辑根据需要实现
        container.innerHTML = `
            <div class="p-4 text-center text-slate-500">
                共 ${products.length} 个产品
            </div>
        `;
    }

    /**
     * 加载仓库列表
     */
    async function loadWarehouses() {
        console.log('[Product-Center] 加载仓库列表...');
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch('/api/v1/warehouses', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            console.log('[Product-Center] 仓库列表数据:', data);
            // 渲染仓库列表...

        } catch (error) {
            console.error('[Product-Center] 获取仓库列表异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取仓库列表失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 打开仓库管理抽屉
     */
    function openWarehouseDrawer() {
        console.log('[Product-Center] 打开仓库管理抽屉');
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            drawer.classList.remove('hidden');
            loadWarehouses();
        }
    }

    /**
     * 关闭仓库管理抽屉
     */
    function closeWarehouseDrawer() {
        console.log('[Product-Center] 关闭仓库管理抽屉');
        const drawer = document.getElementById('warehouse-drawer');
        if (drawer) {
            drawer.classList.add('hidden');
        }
    }

    /**
     * 打开进货建议弹窗
     */
    async function openPurchaseSuggestionModal() {
        console.log('[Product-Center] 打开进货建议弹窗');
        try {
            // 检查认证状态
            if (!window.checkAuth()) {
                return;
            }

            const response = await window.wrappedFetch('/api/v1/rd/products', {
                method: 'GET'
            });

            const data = await window.handleApiResponse(response);
            if (!data) return;

            const allProducts = data.data;
            // 筛选出库存低于预警值的产品
            const suggestions = allProducts.filter(p => p.stock <= (p.warning_stock || 0));
            
            console.log('[Product-Center] 进货建议:', suggestions);
            // 渲染进货建议...

        } catch (error) {
            console.error('[Product-Center] 获取产品列表异常:', error);
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification('获取产品列表失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 打开产品详情
     * @param {HTMLElement} element - 触发元素
     */
    function openProductDetail(element) {
        const productId = element.dataset.id;
        console.log('[Product-Center] 打开产品详情:', productId);
        currentProductId = productId;
        // 打开产品详情弹窗...
    }

    // ================ 注册到 TM_Actions ================
    window.TM_Actions.switchTab = function(element) {
        const tab = element.dataset.tab;
        window.TM_UI.switchTab(tab);
    };

    window.TM_Actions.openWarehouseDrawer = function() {
        openWarehouseDrawer();
    };

    window.TM_Actions.closeWarehouseDrawer = function() {
        closeWarehouseDrawer();
    };

    window.TM_Actions.openPurchaseSuggestionModal = function() {
        openPurchaseSuggestionModal();
    };

    window.TM_Actions.openProductDetail = function(element) {
        openProductDetail(element);
    };

    // ================ 注册到 TradeMindApp ================
    window.TradeMindApp.register('products', function(options) {
        console.log('[Product-Center] 初始化产品中心模块...');
        
        // 加载产品列表
        loadProducts();
        
        // 注入公共 UI
        if (window.TM_UI && window.TM_UI.injectCommonUI) {
            window.TM_UI.injectCommonUI();
        }
    });

    console.log('[Product-Center] 产品中心模块加载完成！');
})();
