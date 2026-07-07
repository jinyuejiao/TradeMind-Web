/**
 * TradeMind - 移动端适配统一模块（与 UI 工程 Tailwind md=768px 对齐）
 * @version 1.1.0
 */
(function () {
    'use strict';

    var BP = 768;

    var api = {
        MOBILE_MAX_WIDTH: BP,

        isMobile: function () {
            return window.matchMedia('(max-width: ' + (BP - 1) + 'px)').matches;
        },

        isDesktop: function () {
            return !this.isMobile();
        },

        isMobileView: function () {
            return this.isMobile();
        },

        syncBodyLayoutMode: function () {
            var m = this.isMobileView();
            document.body.classList.toggle('tm-layout-mobile', m);
            document.body.classList.toggle('tm-layout-desktop', !m);
        },

        init: function () {
            var self = this;
            this.syncBodyLayoutMode();
            window.addEventListener('resize', function () {
                self.syncBodyLayoutMode();
            });
        },

        shouldShow: function (id, mobileOnly) {
            if (mobileOnly) {
                return this.isMobile();
            }
            return true;
        },

        render: function (data, containerId, mobileRenderer, desktopRenderer) {
            var container = document.getElementById(containerId);
            if (!container) {
                console.error('[TM_Responsive] 容器未找到:', containerId);
                return;
            }
            if (this.isMobile()) {
                if (typeof mobileRenderer === 'function') {
                    mobileRenderer(data, container);
                }
            } else if (typeof desktopRenderer === 'function') {
                desktopRenderer(data, container);
            }
        },

        onResize: function (callback) {
            var lastWidth = window.innerWidth;
            var handler = function () {
                if (window.innerWidth !== lastWidth) {
                    lastWidth = window.innerWidth;
                    if (typeof callback === 'function') {
                        callback(api.isMobile());
                    }
                }
            };
            window.addEventListener('resize', handler);
            return handler;
        },

        crmViewToggle: function (showDetail) {
            var listPane = document.getElementById('crm-list-pane');
            var detailPane = document.getElementById('crm-detail-pane');
            var viewCrm = document.getElementById('view-crm');
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

        showCrmDetail: function () {
            if (this.isMobile()) {
                this.crmViewToggle(true);
            }
        },

        hideCrmDetail: function () {
            if (this.isMobile()) {
                this.crmViewToggle(false);
            }
        },

        syncMobileNav: function (tabId) {
            document.querySelectorAll('#tm-app-tabbar .mobile-nav-btn').forEach(function (btn) {
                btn.classList.remove('text-brand-600', 'active-nav');
                btn.classList.add('text-slate-400');
                var dataTab = btn.getAttribute('data-tab');
                var oc = btn.getAttribute('onclick') || '';
                var on =
                    dataTab === tabId ||
                    new RegExp('switchTab\\(\\s*[\'"]' + String(tabId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]\\s*\\)').test(oc);
                if (on) {
                    btn.classList.remove('text-slate-400');
                    btn.classList.add('text-brand-600', 'active-nav');
                }
            });
        }
    };

    window.TM_Responsive = api;
    Object.freeze(window.TM_Responsive);

    function bootLayoutMode() {
        if (window.TM_Responsive && typeof window.TM_Responsive.init === 'function') {
            window.TM_Responsive.init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootLayoutMode);
    } else {
        bootLayoutMode();
    }

    })();
