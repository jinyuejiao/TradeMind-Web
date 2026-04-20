/**
 * TradeMind - 移动端适配统一模块
 * 
 * 功能说明：
 * - 统一判断设备类型
 * - 统一管理移动端和桌面端的视图切换
 * - 提供公共的响应式辅助函数
 * 
 * @version 1.0.0
 */

console.log('[TM_Responsive] 移动端适配模块已加载');

window.TM_Responsive = {
    /**
     * 判断当前是否为移动设备
     * @returns {boolean}
     */
    isMobile: function() {
        return window.innerWidth < 768;
    },

    /**
     * 判断当前是否为桌面设备
     * @returns {boolean}
     */
    isDesktop: function() {
        return !this.isMobile();
    },

    /**
     * 安全判断是否显示某元素
     * @param {string} id - 元素ID
     * @param {boolean} mobileOnly - 是否仅移动端显示
     */
    shouldShow: function(id, mobileOnly = false) {
        if (mobileOnly) {
            return this.isMobile();
        }
        return true;
    },

    /**
     * 统一的移动端/桌面端视图渲染
     * @param {any} data - 要渲染的数据
     * @param {string} containerId - 容器ID
     * @param {function} mobileRenderer - 移动端渲染函数
     * @param {function} desktopRenderer - 桌面端渲染函数
     */
    render: function(data, containerId, mobileRenderer, desktopRenderer) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[TM_Responsive] 容器未找到:', containerId);
            return;
        }

        if (this.isMobile()) {
            if (typeof mobileRenderer === 'function') {
                mobileRenderer(data, container);
            }
        } else {
            if (typeof desktopRenderer === 'function') {
                desktopRenderer(data, container);
            }
        }
    },

    /**
     * 窗口大小变化监听
     * @param {function} callback - 回调函数
     */
    onResize: function(callback) {
        let lastWidth = window.innerWidth;
        const handler = () => {
            if (window.innerWidth !== lastWidth) {
                lastWidth = window.innerWidth;
                if (typeof callback === 'function') {
                    callback(this.isMobile());
                }
            }
        };

        window.addEventListener('resize', handler);
        return handler;
    },

    /**
     * 移动端CRM详情视图切换
     * @param {boolean} showDetail - 是否显示详情页
     */
    crmViewToggle: function(showDetail) {
        const listPane = document.getElementById('crm-list-pane');
        const detailPane = document.getElementById('crm-detail-pane');
        const viewCrm = document.getElementById('view-crm');

        if (listPane && detailPane && viewCrm) {
            if (showDetail) {
                listPane.classList.add('hidden');
                detailPane.classList.remove('hidden');
                viewCrm.classList.add('crm-detail-active');
            } else {
                listPane.classList.remove('hidden');
                detailPane.classList.add('hidden');
                viewCrm.classList.remove('crm-detail-active');
            }
        }
    },

    /**
     * 显示客户详情页（仅移动端）
     * @param {string} customerName - 客户名称
     */
    showCrmDetail: function(customerName) {
        if (this.isMobile()) {
            this.crmViewToggle(true);
        }
    },

    /**
     * 隐藏客户详情页，返回列表（仅移动端）
     */
    hideCrmDetail: function() {
        if (this.isMobile()) {
            this.crmViewToggle(false);
        }
    },

    /**
     * 同步手机端导航激活状态
     * @param {string} tabId - 当前激活的 tab
     */
    syncMobileNav: function(tabId) {
        document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
            btn.classList.remove('text-brand-600', 'active-nav');
            btn.classList.add('text-slate-400');
            const onclick = btn.getAttribute('onclick') || '';
            if (onclick.includes(`'${tabId}'`) || onclick.includes(`"${tabId}"`)) {
                btn.classList.remove('text-slate-400');
                btn.classList.add('text-brand-600', 'active-nav');
            }
        });
    }
};

// 导出到全局，方便其他模块调用
Object.freeze(window.TM_Responsive);
