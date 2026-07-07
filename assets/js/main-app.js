/* ========================================================
 * TradeMind - 全局控制中心
 * ========================================================
 * 统一管理组件注册、初始化和全局状态
 * ======================================================== */

(function() {
    'use strict';

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
            state.modules[name] = initFn;
        },

        /**
         * 初始化模块
         * @param {string} name - 模块名称
         * @param {*} options - 初始化选项
         */
        init: function(name, options) {
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
            localStorage.clear();
            window.location.href = '/login.html';
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
        toast: function(message, type) {
            window.TM_UI.showNotification(message, type || 'warning');
        },

        showNotification: function(message, type = 'success') {
            var host = document.getElementById('tm-global-toast-host');
            if (!host) {
                host = document.createElement('div');
                host.id = 'tm-global-toast-host';
                host.className = 'fixed inset-x-0 top-0 z-[99999] pointer-events-none flex flex-col items-center gap-2 px-3';
                host.style.paddingTop = 'max(0.75rem, env(safe-area-inset-top, 0px))';
                document.body.appendChild(host);
            }

            const notification = document.createElement('div');
            const bgColor = type === 'error' ? 'bg-risk-high' :
                          type === 'warning' ? 'bg-amber-500' :
                          type === 'info' ? 'bg-brand-600' : 'bg-brand-600';

            notification.className = 'pointer-events-auto ' + bgColor + ' text-white px-4 py-2.5 rounded-lg shadow-lg max-w-[92vw] text-sm text-center fade-in';
            notification.textContent = message;

            host.appendChild(notification);

            setTimeout(function() {
                notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                setTimeout(function() {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }, 3500);
        },

        /**
         * 显示模态框
         * @param {string} templateId - 模板 ID
         * @param {object} data - 数据对象
         */
        showModal: function(templateId, data) {
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
            if (typeof window.switchTab === 'function') {
                window.switchTab(tab);
                return;
            }

            var fallback = '/index-app.html#tab=' + encodeURIComponent(tab || 'dashboard');
            if (typeof window.TM_resolveStaticPageUrl === 'function') {
                fallback = window.TM_resolveStaticPageUrl('index-app.html#tab=' + encodeURIComponent(tab || 'dashboard'));
            }
            window.location.href = fallback;
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

    })();
