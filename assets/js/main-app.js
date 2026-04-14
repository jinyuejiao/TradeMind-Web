/* ========================================================
 * TradeMind - 全局控制中心
 * ========================================================
 * 统一管理组件注册、初始化和全局状态
 * ======================================================== */

(function() {
    'use strict';

    console.log('[TradeMindApp] 初始化全局控制中心...');

    // ================ 全局状态管理 ================
    const state = {
        modules: {},
        initialized: {},
        currentModule: null
    };

    // ================ window.TM_Actions 命名空间 ================
    window.TM_Actions = {};

    // ================ window.TM_UI 命名空间 ================
    window.TM_UI = {};

    // ================ 全局事件监听 - 事件委派中心 ================
    document.addEventListener('click', function(e) {
        const actionElement = e.target.closest('[data-action]');
        if (actionElement) {
            const action = actionElement.dataset.action;
            if (action && window.TM_Actions[action]) {
                console.log('[TradeMindApp] 执行 action:', action);
                try {
                    window.TM_Actions[action](actionElement, e);
                } catch (error) {
                    console.error('[TradeMindApp] Action 执行失败:', action, error);
                    if (window.TM_UI.showNotification) {
                        window.TM_UI.showNotification('操作失败: ' + error.message, 'error');
                    }
                }
            } else {
                console.warn('[TradeMindApp] 未找到对应的 action:', action);
            }
        }
    });

    // ================ window.TradeMindApp 对象 ================
    window.TradeMindApp = {
        /**
         * 注册模块
         * @param {string} name - 模块名称
         * @param {function} initFn - 模块初始化函数
         */
        register: function(name, initFn) {
            console.log('[TradeMindApp] 注册模块:', name);
            state.modules[name] = initFn;
        },

        /**
         * 初始化模块
         * @param {string} name - 模块名称
         * @param {*} options - 初始化选项
         */
        init: function(name, options) {
            console.log('[TradeMindApp] 初始化模块:', name);
            
            if (!state.modules[name]) {
                console.error('[TradeMindApp] 模块未注册:', name);
                return false;
            }

            if (state.initialized[name]) {
                console.warn('[TradeMindApp] 模块已初始化:', name);
                return true;
            }

            try {
                state.modules[name](options);
                state.initialized[name] = true;
                state.currentModule = name;
                console.log('[TradeMindApp] 模块初始化成功:', name);
                return true;
            } catch (error) {
                console.error('[TradeMindApp] 模块初始化失败:', name, error);
                return false;
            }
        },

        /**
         * 检查模块是否已初始化
         * @param {string} name - 模块名称
         * @returns {boolean}
         */
        isInitialized: function(name) {
            return !!state.initialized[name];
        },

        /**
         * 获取当前模块
         * @returns {string|null}
         */
        getCurrentModule: function() {
            return state.currentModule;
        },

        /**
         * 登出
         */
        logout: function() {
            console.log('[TradeMindApp] 执行登出');
            localStorage.clear();
            window.location.href = '../../login.html';
        },

        /**
         * 显示通知（快捷方法）
         * @param {string} message - 消息内容
         * @param {string} type - 消息类型
         */
        notify: function(message, type) {
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification(message, type);
            } else {
                console.log('[Notification]', type || 'info', ':', message);
            }
        }
    };

    // ================ TM_UI 基础工具函数 ================
    window.TM_UI = {
        /**
         * 显示通知
         * @param {string} message - 消息内容
         * @param {string} type - 消息类型 (success|error|info|warning)
         */
        showNotification: function(message, type = 'success') {
            console.log('[TM_UI] 显示通知:', message, type);
            
            const notification = document.createElement('div');
            const bgColor = type === 'error' ? 'bg-risk-high' : 
                          type === 'warning' ? 'bg-amber-500' : 
                          type === 'info' ? 'bg-brand-600' : 'bg-brand-600';
            
            notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // 3秒后自动移除
            setTimeout(function() {
                notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                setTimeout(function() {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 500);
            }, 3000);
        },

        /**
         * 显示模态框
         * @param {string} templateId - 模板 ID
         * @param {object} data - 数据对象
         */
        showModal: function(templateId, data) {
            console.log('[TM_UI] 显示模态框:', templateId, data);
            
            let container = document.getElementById('common-modal-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'common-modal-container';
                document.body.appendChild(container);
            }
            
            const template = document.getElementById(templateId);
            if (template) {
                container.innerHTML = template.innerHTML;
                container.classList.remove('hidden');
            } else {
                console.error('[TM_UI] 未找到模板:', templateId);
            }
        },

        /**
         * 关闭模态框
         */
        closeModal: function() {
            console.log('[TM_UI] 关闭模态框');
            const container = document.getElementById('common-modal-container');
            if (container) {
                container.classList.add('hidden');
            }
        },

        /**
         * 切换标签
         * @param {string} tab - 标签名称
         */
        switchTab: function(tab) {
            console.log('[TM_UI] 切换标签:', tab);
            
            const tabs = {
                dashboard: '../dashboard/dashboard.html',
                biz: '../SmartOps/SmartOps.html',
                crm: '../crm/crm.html',
                supply: 'product-center.html',
                supplier: '../supply-chain/supply-chain.html'
            };

            if (tabs[tab]) {
                window.location.href = tabs[tab];
            }
        },

        /**
         * 检查容器是否存在
         * @param {string} containerId - 容器 ID
         * @returns {boolean}
         */
        checkContainer: function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error('[TM_UI] 容器不存在:', containerId);
                return false;
            }
            return true;
        }
    };

    console.log('[TradeMindApp] 全局控制中心初始化完成！');
})();
