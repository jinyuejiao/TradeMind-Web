/**
 * TradeMind — 手机端备案展示（与工作台一致）
 *
 * 方案：#content-area 纵向 flex + 滚动 + 全局 footer（mt-auto）
 * footer 紧跟当前 Tab 内容节点之后（避免被中间弹窗层与 flex 布局挤没）
 * 导览为悬浮层，不参与备案布局。
 */
(function (window, document) {
    'use strict';

    var TAB_VIEW_IDS = {
        dashboard: 'view-dashboard',
        biz: 'view-biz',
        crm: 'view-crm',
        supply: 'view-supply',
        supplier: 'view-supplier'
    };

    var iframeBindings = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

    function isMobile() {
        return window.innerWidth < 768 || document.body.classList.contains('tm-layout-mobile');
    }

    function contentArea() {
        return document.getElementById('content-area');
    }

    function globalFooter() {
        return document.querySelector('#content-area > footer.tm-compliance-footer');
    }

    function removePerTabFooters() {
        document.querySelectorAll('footer.tm-compliance-footer[data-tm-compliance-slot]').forEach(function (el) {
            el.remove();
        });
        document.querySelectorAll('.view-section').forEach(function (view) {
            view.classList.remove(
                'tm-view-with-compliance',
                'tm-view-with-compliance--flow',
                'tm-view-with-compliance--embed',
                'tm-view-with-compliance--supply'
            );
        });
        document.querySelectorAll('.tm-view-compliance-body').forEach(function (wrap) {
            var iframe = wrap.querySelector('iframe.tm-module-frame');
            if (iframe && wrap.parentNode) {
                wrap.parentNode.insertBefore(iframe, wrap);
                wrap.remove();
            }
        });
    }

    /** 桌面端：footer 回到 content-area 末尾 */
    function restoreFooterToShellEnd() {
        var foot = globalFooter();
        var content = contentArea();
        if (!foot || !content) return;
        content.appendChild(foot);
    }

    /**
     * 手机端：footer 紧跟当前 Tab，与工作台同一文档流位置关系
     */
    function relocateGlobalFooter(tabId) {
        if (!isMobile()) {
            restoreFooterToShellEnd();
            return;
        }
        var foot = globalFooter();
        var content = contentArea();
        var viewId = TAB_VIEW_IDS[tabId] || TAB_VIEW_IDS.dashboard;
        var view = document.getElementById(viewId);
        if (!foot || !content || !view) return;

        if (view.nextElementSibling !== foot) {
            content.insertBefore(foot, view.nextSibling);
        }
    }

    function syncGlobalFooterForMobile() {
        var foot = globalFooter();
        if (!foot) return;
        foot.classList.remove('tm-compliance-footer--shell-global');
        foot.removeAttribute('aria-hidden');
        if (!foot.classList.contains('mt-auto')) {
            foot.classList.add('mt-auto');
        }
    }

    function parseLengthToPx(value, fallback) {
        if (!value) return fallback;
        var n = parseFloat(String(value).trim());
        if (isNaN(n)) return fallback;
        if (String(value).indexOf('rem') >= 0) return n * 16;
        return n;
    }

    /** 为 iframe 内容预留备案 + 底栏空间 */
    function minIframeViewportHeight() {
        var styles = window.getComputedStyle(document.documentElement);
        var headerH = parseLengthToPx(styles.getPropertyValue('--tm-header-h'), 56);
        var tabH = parseLengthToPx(styles.getPropertyValue('--tm-tabbar-h'), 68);
        var footerReserve = 88;
        return Math.max(200, window.innerHeight - headerH - tabH - footerReserve);
    }

    function applyEmbedDocumentForFlow(doc) {
        if (!doc || !isMobile()) return;
        var html = doc.documentElement;
        var body = doc.body;
        if (html) html.classList.add('tm-embed-parent-flow');
        if (body) body.classList.add('tm-embed-parent-flow');

        if (html) {
            html.style.setProperty('height', 'auto', 'important');
            html.style.setProperty('overflow', 'visible', 'important');
        }
        if (body) {
            body.style.setProperty('height', 'auto', 'important');
            body.style.setProperty('overflow', 'visible', 'important');
            body.style.setProperty('display', 'block', 'important');
        }

        var main = doc.querySelector('main');
        if (main) {
            main.style.setProperty('height', 'auto', 'important');
            main.style.setProperty('overflow', 'visible', 'important');
            main.style.setProperty('display', 'block', 'important');
        }

        var content = doc.getElementById('content-area');
        if (content) {
            content.style.setProperty('overflow', 'visible', 'important');
            content.style.setProperty('height', 'auto', 'important');
            content.style.setProperty('flex', 'none', 'important');
            content.style.setProperty('padding-bottom', '0', 'important');
        }

        doc.querySelectorAll(
            '#view-crm, #crm-list-pane, #customer-list-container, ' +
            '#orders-list-view, #suppliers-list-view, #sup-list-view, #sup-supplier-view'
        ).forEach(function (el) {
            el.style.setProperty('height', 'auto', 'important');
            el.style.setProperty('max-height', 'none', 'important');
            el.style.setProperty('overflow', 'visible', 'important');
        });
    }

    function syncIframeHeight(iframe) {
        if (!iframe || !isMobile()) return;
        try {
            var doc = iframe.contentDocument;
            if (!doc || !doc.body) return;
            var contentH = Math.max(
                doc.body.scrollHeight || 0,
                doc.documentElement.scrollHeight || 0,
                doc.body.offsetHeight || 0
            );
            var minH = minIframeViewportHeight();
            var h = Math.max(contentH, minH);
            iframe.style.display = 'block';
            iframe.style.width = '100%';
            iframe.style.height = h + 'px';
            iframe.style.minHeight = '0';
            iframe.style.border = '0';
        } catch (e) { /* ignore */ }
    }

    function unbindIframe(iframe) {
        if (!iframe || !iframeBindings) return;
        var binding = iframeBindings.get(iframe);
        if (!binding) return;
        if (binding.ro) binding.ro.disconnect();
        if (binding.timer) clearInterval(binding.timer);
        iframeBindings.delete(iframe);
    }

    function bindIframeAutoHeight(iframe) {
        if (!iframe || !isMobile()) return;
        unbindIframe(iframe);

        function remeasure() {
            syncIframeHeight(iframe);
        }

        function onLoad() {
            try {
                applyEmbedDocumentForFlow(iframe.contentDocument);
            } catch (e) { /* ignore */ }
            remeasure();
            [120, 400, 1000, 2000].forEach(function (ms) {
                setTimeout(remeasure, ms);
            });

            try {
                var doc = iframe.contentDocument;
                if (!doc || !doc.body || typeof ResizeObserver === 'undefined') return;
                var ro = new ResizeObserver(remeasure);
                ro.observe(doc.body);
                if (doc.documentElement) ro.observe(doc.documentElement);
                iframeBindings.set(iframe, { ro: ro });
            } catch (e2) { /* ignore */ }
        }

        iframe.addEventListener('load', onLoad);
        try {
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                onLoad();
            }
        } catch (e3) { /* ignore */ }
    }

    function getActiveTabId() {
        try {
            var m = (window.location.hash || '').match(/tab=([^&]+)/);
            if (m && m[1]) return decodeURIComponent(m[1]);
        } catch (e) { /* ignore */ }
        var active = document.querySelector(
            '#tm-app-tabbar .mobile-nav-btn.active-nav, #tm-app-tabbar .mobile-nav-btn.text-brand-600'
        );
        if (active && active.getAttribute('data-tab')) {
            return active.getAttribute('data-tab');
        }
        return 'dashboard';
    }

    function syncTabIframe(tabId) {
        if (!isMobile()) return;
        var viewId = TAB_VIEW_IDS[tabId];
        if (!viewId) return;
        var iframe = document.querySelector('#' + viewId + ' iframe.tm-module-frame');
        if (iframe) bindIframeAutoHeight(iframe);
    }

    function applyMobileScheme(tabId) {
        tabId = tabId || getActiveTabId();
        removePerTabFooters();
        syncGlobalFooterForMobile();
        if (!isMobile()) return;
        relocateGlobalFooter(tabId);
        ['view-biz', 'view-crm', 'view-supplier'].forEach(function (id) {
            var frame = document.querySelector('#' + id + ' iframe.tm-module-frame');
            if (frame) bindIframeAutoHeight(frame);
        });
    }

    function onTabChange(tabId) {
        applyMobileScheme(tabId);
        syncTabIframe(tabId);
    }

    function init() {
        applyMobileScheme('dashboard');
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            applyMobileScheme();
        }, 120);
    });

    window.TM_Compliance = {
        isMobile: isMobile,
        getActiveTabId: getActiveTabId,
        applyMobileScheme: applyMobileScheme,
        relocateGlobalFooter: relocateGlobalFooter,
        applyEmbedDocumentForFlow: applyEmbedDocumentForFlow,
        syncIframeHeight: syncIframeHeight,
        bindIframeAutoHeight: bindIframeAutoHeight,
        onTabChange: onTabChange,
        init: init
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
