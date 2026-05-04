/* ========================================================
 * TradeMind - UI 组件化系统
 * ========================================================
 * 统一的弹窗外壳与手机端导航栏
 * ======================================================== */

(function() {
    'use strict';

    console.log('[UI-Components] 初始化 UI 组件化系统...');

    // ================ 组件模板库 ================
    window.TradeMindApp.components = {
        /**
         * Logo 组件模板
         */
        logo: `
            <div class="h-16 flex items-center px-6 border-b border-slate-800">
                <div class="w-10 h-10 bg-[#14B8A6] rounded-xl flex items-center justify-center mr-3 text-white shadow-lg shadow-[#14B8A6]/20">
                    <i class="ph ph-brain text-xl"></i>
                </div>
                <span class="text-white text-lg font-bold tracking-wider">TradeMind</span>
            </div>
        `,

        /**
         * 用户信息组件模板
         * @param {object} options - 选项
         */
        userSection: function(options) {
            const userName = options.userName || '用户';
            const userRole = options.userRole || '角色';
            const userInitials = options.userInitials || 'AD';
            const planType = options.planType || '试用版本';
            
            return `
                <div class="p-4 border-t border-slate-800 bg-slate-900 mt-auto flex items-center cursor-pointer transition-all hover:bg-slate-800" data-action="openSubscriptionModal">
                    <div class="w-10 h-10 rounded-full bg-slate-800 text-[#14B8A6] border-2 border-[#14B8A6] flex items-center justify-center text-xs font-bold font-mono" id="sidebar-user-avatar">
                        ${userInitials}
                    </div>
                    <div class="ml-3 text-left">
                        <p class="text-xs font-bold text-slate-200" id="sidebar-user-name">${userName} (${userRole})</p>
                        <div class="flex items-center gap-1.5 mt-1">
                            <i class="ph ph-crown text-[#14B8A6] text-[10px]"></i>
                            <span class="text-[#14B8A6] text-[10px] font-bold">${planType}</span>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * 手机底部导航栏组件模板
         * @param {object} options - 选项
         */
        mobileNav: function(options) {
            const currentPath = options.currentPath || window.location.pathname;
            const resolveEntry = typeof window.TM_resolveStaticPageUrl === 'function'
                ? window.TM_resolveStaticPageUrl
                : function (rel) { return '/' + String(rel).replace(/^\//, ''); };
            let activeDashboard = '';
            let activeBiz = '';
            let activeCrm = '';
            let activeSupply = '';
            let activeSupplier = '';
            
            if (currentPath.includes('/dashboard/')) {
                activeDashboard = 'active';
            } else if (currentPath.includes('/SmartOps/')) {
                activeBiz = 'active';
            } else if (currentPath.includes('/crm/')) {
                activeCrm = 'active';
            } else if (currentPath.includes('/product-center/')) {
                activeSupply = 'active';
            } else if (currentPath.includes('/supply-chain/')) {
                activeSupplier = 'active';
            }
            
            return `
                <div class="tm-mobile-nav">
                    <a href="${resolveEntry('index-app.html#tab=dashboard')}" class="tm-nav-item ${activeDashboard}">
                        <i class="ph ph-squares-four"></i>
                        <span>工作台</span>
                    </a>
                    <a href="${resolveEntry('index-app.html#tab=biz')}" class="tm-nav-item ${activeBiz}">
                        <i class="ph ph-chart-line-up"></i>
                        <span>智能经营</span>
                    </a>
                    <a href="${resolveEntry('index-app.html#tab=crm')}" class="tm-nav-item ${activeCrm}">
                        <i class="ph ph-users"></i>
                        <span>客户CRM</span>
                    </a>
                    <a href="${resolveEntry('index-app.html#tab=supply')}" class="tm-nav-item ${activeSupply}">
                        <i class="ph ph-package"></i>
                        <span>产品中心</span>
                    </a>
                    <a href="${resolveEntry('index-app.html#tab=supplier')}" class="tm-nav-item ${activeSupplier}">
                        <i class="ph ph-truck"></i>
                        <span>供应链</span>
                    </a>
                </div>
            `;
        },

        /**
         * 手机顶部导航栏组件模板
         * @param {object} options - 选项
         */
        mobileHeader: function(options) {
            const pageTitle = options.pageTitle || '商贸智脑';
            
            return `
                <div class="tm-mobile-header">
                    <div class="w-10 h-10 bg-[#14B8A6] rounded-xl flex items-center justify-center text-white shadow-lg">
                        <i class="ph ph-brain text-xl"></i>
                    </div>
                    <h1 class="text-lg font-bold text-slate-800">${pageTitle}</h1>
                    <div class="w-10 h-10 rounded-full bg-[#14B8A6] text-white flex items-center justify-center cursor-pointer" data-action="openSubscriptionModal" id="mobile-user-avatar">
                        <i class="ph ph-user text-lg"></i>
                    </div>
                </div>
            `;
        }
    };

    // ================ 响应式布局管理 ================
    window.TradeMindApp.layout = {
        currentMode: 'desktop',
        
        /**
         * 初始化响应式布局
         */
        init: function() {
            console.log('[UI-Components] 初始化响应式布局...');
            
            // 检测当前布局模式
            this.checkLayoutMode();
            
            // 监听窗口大小变化
            window.addEventListener('resize', function() {
                window.TradeMindApp.layout.checkLayoutMode();
            });
        },
        
        /**
         * 检查并切换布局模式
         */
        checkLayoutMode: function() {
            const isMobile = window.TM_Responsive && typeof window.TM_Responsive.isMobile === 'function'
                ? window.TM_Responsive.isMobile()
                : window.innerWidth < 768;
            const newMode = isMobile ? 'mobile' : 'desktop';
            
            if (newMode !== this.currentMode) {
                console.log('[UI-Components] 切换布局模式:', newMode);
                this.currentMode = newMode;
                this.applyLayoutMode();
            }
        },
        
        /**
         * 应用布局模式
         */
        applyLayoutMode: function() {
            if (this.currentMode === 'mobile') {
                document.body.classList.add('tm-mobile-active');
                document.body.setAttribute('layout-mode', 'mobile');
                
                // 隐藏侧边栏
                const sidebar = document.querySelector('aside');
                if (sidebar) {
                    sidebar.classList.add('hidden');
                    sidebar.classList.add('md:hidden');
                }
                
                // 注入移动端组件
                this.injectMobileComponents();
            } else {
                document.body.classList.remove('tm-mobile-active');
                document.body.setAttribute('layout-mode', 'desktop');
                
                // 显示侧边栏
                const sidebar = document.querySelector('aside');
                if (sidebar) {
                    sidebar.classList.remove('hidden');
                    sidebar.classList.remove('md:hidden');
                }
            }
        },
        
        /**
         * 注入移动端组件
         */
        injectMobileComponents: function() {
            const currentPath = window.location.pathname || '';
            const pathLower = currentPath.toLowerCase();
            const isPublicAuthPage = pathLower.endsWith('login.html') || pathLower.endsWith('register.html');
            /** 与 auth.injectCommonUI 一致：主壳页已含 #tm-app-tabbar，禁止再叠一层 .tm-mobile-nav（否则会挡住底栏点击） */
            const isAppShellPage = !!document.getElementById('tm-app-tabbar');

            if (isAppShellPage || isPublicAuthPage) {
                return;
            }

            let pageTitle = '商贸智脑';
            
            if (currentPath.includes('/dashboard/')) {
                pageTitle = '工作台';
            } else if (currentPath.includes('/SmartOps/')) {
                pageTitle = '智能经营';
            } else if (currentPath.includes('/crm/')) {
                pageTitle = '客户CRM';
            } else if (currentPath.includes('/product-center/')) {
                pageTitle = '产品中心';
            } else if (currentPath.includes('/supply-chain/')) {
                pageTitle = '供应商管理';
            }
            
            // 注入移动端顶部导航
            if (!document.querySelector('.tm-mobile-header')) {
                console.log('[UI-Components] 注入移动端顶部导航');
                document.body.insertAdjacentHTML(
                    'afterbegin',
                    window.TradeMindApp.components.mobileHeader({ pageTitle: pageTitle })
                );
            }
            
            // 注入移动端底部导航
            if (!document.querySelector('.tm-mobile-nav')) {
                console.log('[UI-Components] 注入移动端底部导航');
                document.body.insertAdjacentHTML(
                    'beforeend',
                    window.TradeMindApp.components.mobileNav({ currentPath: currentPath })
                );
            }
            
        }
    };

    // ================ TM_UI 增强：标准化弹窗 ================
    if (window.TM_UI) {
        /**
         * 显示模态框（增强版）
         * @param {string} templateId - 模板 ID
         * @param {object} data - 数据对象
         */
        window.TM_UI.showModal = function(templateId, data) {
            console.log('[UI-Components] 显示模态框:', templateId, data);
            
            // 确保容器存在
            let container = document.getElementById('common-modal-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'common-modal-container';
                container.className = 'hidden fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-8 modal-blur';
                document.body.appendChild(container);
                console.log('[UI-Components] 创建公共模态框容器');
            }
            
            // 查找模板
            const template = document.getElementById(templateId);
            if (template) {
                container.innerHTML = template.innerHTML;
                container.classList.remove('hidden');
                console.log('[UI-Components] 模态框已显示');
            } else {
                console.error('[UI-Components] 未找到模板:', templateId);
                if (window.TM_UI.showNotification) {
                    window.TM_UI.showNotification('模板未找到', 'error');
                }
            }
        };

        /**
         * 关闭模态框（增强版）
         */
        window.TM_UI.closeModal = function() {
            console.log('[UI-Components] 关闭模态框');
            const container = document.getElementById('common-modal-container');
            if (container) {
                container.classList.add('hidden');
            }
        };

        /**
         * 注入公共 UI 组件
         */
        window.TM_UI.injectCommonUI = function() {
            console.log('[UI-Components] 注入公共 UI 组件');
            
            // 设置页面标题
            document.title = '杭州巨猿科技有限公司 - TradeMind商贸智脑';
            
            // 注入订阅弹窗模板（如果不存在）
            if (!document.getElementById('subscription-modal')) {
                const modalTemplate = window.TradeMindApp.components.subscriptionModal || '';
                if (modalTemplate) {
                    document.body.insertAdjacentHTML('beforeend', modalTemplate);
                }
            }
            
            // 初始化响应式布局
            window.TradeMindApp.layout.init();
        };
    }

    // 初始化响应式布局
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.TradeMindApp.layout.init();
        });
    } else {
        window.TradeMindApp.layout.init();
    }

    console.log('[UI-Components] UI 组件化系统初始化完成！');
})();
