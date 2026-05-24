/**
 * TradeMind — 手机端备案展示（与工作台一致）
 *
 * 方案：#content-area 纵向 flex + overflow 滚动 + 底部唯一全局 footer（mt-auto）
 * 导览为悬浮层，不参与备案布局计算。
 */
(function (window, document) {
    'use strict';

    var iframeBindings = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

    function isMobile() {
        return window.innerWidth < 768 || document.body.classList.contains('tm-layout-mobile');
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

    function syncGlobalFooterForMobile() {
        var foot = globalFooter();
        if (!foot) return;
        if (isMobile()) {
            foot.classList.remove('tm-compliance-footer--shell-global');
            foot.removeAttribute('aria-hidden');
            if (!foot.classList.contains('mt-auto')) {
                foot.classList.add('mt-auto');
            }
        } else {
            foot.classList.remove('tm-compliance-footer--shell-global');
            foot.removeAttribute('aria-hidden');
        }
    }

    function parseLengthToPx(value, fallback) {
        if (!value) return fallback;
        var n = parseFloat(String(value).trim());
        if (isNaN(n)) return fallback;
        if (String(value).indexOf('rem') >= 0) return n * 16;
        return n;
    }

    function minIframeViewportHeight() {
        var styles = window.getComputedStyle(document.documentElement);
        var headerH = parseLengthToPx(styles.getPropertyValue('--tm-header-h'), 56);
        var tabH = parseLengthToPx(styles.getPropertyValue('--tm-tabbar-h'), 68);
        return Math.max(240, window.innerHeight - headerH - tabH - 100);
    }

    /** 子页展开为文档流，供主壳 content-area 统一滚动 */
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
            iframe.style.minHeight = minH + 'px';
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
            [100, 400, 1000].forEach(function (ms) {
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

    function syncTabIframe(tabId) {
        if (!isMobile()) return;
        var map = { biz: 'view-biz', crm: 'view-crm', supplier: 'view-supplier' };
        var viewId = map[tabId];
        if (!viewId) return;
        var host = document.getElementById(viewId);
        if (!host) return;
        var iframe = host.querySelector('iframe.tm-module-frame');
        if (iframe) bindIframeAutoHeight(iframe);
    }

    function applyMobileScheme() {
        removePerTabFooters();
        syncGlobalFooterForMobile();
        if (!isMobile()) return;
        ['view-biz', 'view-crm', 'view-supplier'].forEach(function (id) {
            var iframe = document.querySelector('#' + id + ' iframe.tm-module-frame');
            if (iframe) bindIframeAutoHeight(iframe);
        });
    }

    function onTabChange(tabId) {
        applyMobileScheme();
        syncTabIframe(tabId);
    }

    function init() {
        applyMobileScheme();
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyMobileScheme, 120);
    });

    window.TM_Compliance = {
        isMobile: isMobile,
        applyMobileScheme: applyMobileScheme,
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
