/**
 * TradeMind — 备案信息统一挂载（PC 全局底栏 / 手机各 Tab 内容流尾部，与工作台一致）
 */
(function (window, document) {
    'use strict';

    var FOOTER_INNER_HTML =
        '<div class="tm-compliance-footer-inner">' +
        '<span>© 2026 杭州巨猿科技有限公司</span>' +
        '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备2026010267号-1</a>' +
        '<a href="https://beian.mps.gov.cn/#/query/webSearch?code=33010802014468" rel="noreferrer" target="_blank" class="tm-beian-link">' +
        '<img src="/assets/img/ghs.png" alt="公安备案图标" width="16" height="16">' +
        '<span>浙公网安备33010802014468号</span>' +
        '</a>' +
        '</div>';

    var iframeBindings = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var iframeBindingFallback = [];

    function isMobile() {
        return window.innerWidth < 768 || document.body.classList.contains('tm-layout-mobile');
    }

    function globalFooter() {
        return document.querySelector('#content-area > footer.tm-compliance-footer');
    }

    function createFooter() {
        var foot = document.createElement('footer');
        foot.className = 'tm-compliance-footer pb-safe md:pb-4';
        foot.setAttribute('data-tm-compliance-slot', 'true');
        foot.innerHTML = FOOTER_INNER_HTML;
        return foot;
    }

    function ensureFooterIn(host) {
        if (!host) return null;
        var foot = host.querySelector('footer.tm-compliance-footer[data-tm-compliance-slot]');
        if (!foot) {
            foot = createFooter();
            host.appendChild(foot);
        }
        return foot;
    }

    function parseLengthToPx(value, fallback) {
        if (!value) return fallback;
        var n = parseFloat(String(value).trim());
        if (isNaN(n)) return fallback;
        if (String(value).indexOf('rem') >= 0) return n * 16;
        if (String(value).indexOf('px') >= 0) return n;
        return n;
    }

    function minIframeViewportHeight() {
        var root = document.documentElement;
        var styles = window.getComputedStyle(root);
        var headerH = parseLengthToPx(styles.getPropertyValue('--tm-header-h'), 56);
        var tabH = parseLengthToPx(styles.getPropertyValue('--tm-tabbar-h'), 68);
        return Math.max(280, window.innerHeight - headerH - tabH - 120);
    }

    /** 工作台 / iframe 模块：主壳 #content-area 滚动，备案在 Tab 内容最下方 */
    function prepareFlowView(host) {
        if (!host) return;
        host.classList.remove('tm-view-with-compliance--embed');
        host.classList.add('tm-view-with-compliance', 'tm-view-with-compliance--flow');
        ensureFooterIn(host);
    }

    /**
     * 嵌入子页改为文档流高度，由父级 content-area 统一滚动（与工作台一致）
     */
    function applyEmbedDocumentForFlow(doc, frame) {
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
            body.style.setProperty('min-height', '0', 'important');
            body.style.setProperty('overflow', 'visible', 'important');
            body.style.setProperty('display', 'block', 'important');
        }

        var main = doc.querySelector('main');
        if (main) {
            main.style.setProperty('height', 'auto', 'important');
            main.style.setProperty('overflow', 'visible', 'important');
            main.style.setProperty('display', 'block', 'important');
            main.style.setProperty('width', '100%', 'important');
            main.style.setProperty('max-width', '100%', 'important');
        }

        var content = doc.getElementById('content-area');
        if (content) {
            content.style.setProperty('overflow', 'visible', 'important');
            content.style.setProperty('height', 'auto', 'important');
            content.style.setProperty('flex', 'none', 'important');
            content.style.setProperty('padding-top', '0.5rem', 'important');
            content.style.setProperty('padding-bottom', '0', 'important');
        }

        doc.querySelectorAll('#view-crm, #crm-list-pane, #customer-list-container').forEach(function (el) {
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
            iframe.style.setProperty('display', 'block', 'important');
            iframe.style.setProperty('width', '100%', 'important');
            iframe.style.setProperty('height', h + 'px', 'important');
            iframe.style.setProperty('min-height', minH + 'px', 'important');
            iframe.style.setProperty('border', '0', 'important');
        } catch (e) {
            /* cross-origin guard */
        }
    }

    function unbindIframeFlow(iframe) {
        if (!iframe) return;
        if (iframeBindings) {
            var binding = iframeBindings.get(iframe);
            if (binding) {
                if (binding.ro) binding.ro.disconnect();
                if (binding.timer) clearInterval(binding.timer);
                iframeBindings.delete(iframe);
            }
            return;
        }
        iframeBindingFallback = iframeBindingFallback.filter(function (item) {
            if (item.iframe === iframe) {
                if (item.ro) item.ro.disconnect();
                if (item.timer) clearInterval(item.timer);
                return false;
            }
            return true;
        });
    }

    function storeBinding(iframe, binding) {
        if (iframeBindings) {
            iframeBindings.set(iframe, binding);
        } else {
            iframeBindingFallback.push({ iframe: iframe, ro: binding.ro, timer: binding.timer });
        }
    }

    function scheduleIframeMeasures(iframe) {
        syncIframeHeight(iframe);
        [80, 300, 800, 1500].forEach(function (ms) {
            setTimeout(function () {
                syncIframeHeight(iframe);
            }, ms);
        });
    }

    function bindIframeFlow(iframe) {
        if (!iframe || !isMobile()) return;
        unbindIframeFlow(iframe);

        function remeasure() {
            syncIframeHeight(iframe);
        }

        function onIframeLoad() {
            try {
                var doc = iframe.contentDocument;
                applyEmbedDocumentForFlow(doc, iframe);
            } catch (e) { /* ignore */ }
            scheduleIframeMeasures(iframe);

            try {
                var doc = iframe.contentDocument;
                if (!doc || !doc.body) return;
                var binding = {};
                if (typeof ResizeObserver !== 'undefined') {
                    binding.ro = new ResizeObserver(function () {
                        remeasure();
                    });
                    binding.ro.observe(doc.body);
                    if (doc.documentElement) binding.ro.observe(doc.documentElement);
                } else {
                    binding.timer = setInterval(remeasure, 1200);
                }
                storeBinding(iframe, binding);
            } catch (e2) {
                storeBinding(iframe, { timer: setInterval(remeasure, 1200) });
            }
        }

        iframe.addEventListener('load', onIframeLoad);
        try {
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                onIframeLoad();
            }
        } catch (e3) { /* ignore */ }
    }

    /** 智能经营 / CRM / 供应商：与工作台相同的流式布局 + iframe 高度随内容 */
    function prepareEmbeddedFrameView(host) {
        if (!host) return;
        prepareFlowView(host);

        var bodyWrap = host.querySelector('.tm-view-compliance-body');
        if (!bodyWrap) {
            var iframeOnly = host.querySelector('iframe.tm-module-frame');
            if (iframeOnly) {
                bodyWrap = document.createElement('div');
                bodyWrap.className = 'tm-view-compliance-body tm-view-compliance-body--flow';
                host.insertBefore(bodyWrap, iframeOnly);
                bodyWrap.appendChild(iframeOnly);
            }
        }
        if (bodyWrap) {
            bodyWrap.classList.add('tm-view-compliance-body--flow');
        }

        var iframe = host.querySelector('iframe.tm-module-frame');
        if (iframe) bindIframeFlow(iframe);
    }

    /** 产品中心：备案在内部滚动区末尾 */
    function prepareSupplyView(host) {
        if (!host) return;
        host.classList.remove('tm-view-with-compliance--embed');
        host.classList.add('tm-view-with-compliance', 'tm-view-with-compliance--supply');
        var scroll = host.querySelector('#supply-inner-scroll');
        ensureFooterIn(scroll || host);
    }

    function syncGlobalFooterVisibility() {
        var global = globalFooter();
        if (!global) return;
        if (isMobile()) {
            global.classList.add('tm-compliance-footer--shell-global');
            global.setAttribute('aria-hidden', 'true');
        } else {
            global.classList.remove('tm-compliance-footer--shell-global');
            global.removeAttribute('aria-hidden');
        }
    }

    function prepareAllViews() {
        prepareFlowView(document.getElementById('view-dashboard'));
        prepareEmbeddedFrameView(document.getElementById('view-biz'));
        prepareEmbeddedFrameView(document.getElementById('view-crm'));
        prepareEmbeddedFrameView(document.getElementById('view-supplier'));
        prepareSupplyView(document.getElementById('view-supply'));
    }

    function onTabChange(tabId) {
        syncGlobalFooterVisibility();
        if (!isMobile()) return;
        var map = {
            dashboard: 'view-dashboard',
            biz: 'view-biz',
            crm: 'view-crm',
            supply: 'view-supply',
            supplier: 'view-supplier'
        };
        var viewId = map[tabId];
        if (!viewId) return;
        var host = document.getElementById(viewId);
        if (!host) return;
        if (tabId === 'dashboard') prepareFlowView(host);
        else if (tabId === 'supply') prepareSupplyView(host);
        else prepareEmbeddedFrameView(host);
    }

    function init() {
        syncGlobalFooterVisibility();
        if (isMobile()) prepareAllViews();
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            syncGlobalFooterVisibility();
            if (!isMobile()) return;
            prepareAllViews();
            document.querySelectorAll('iframe.tm-module-frame').forEach(function (frame) {
                syncIframeHeight(frame);
            });
        }, 120);
    });

    window.TM_Compliance = {
        isMobile: isMobile,
        createFooter: createFooter,
        ensureFooterIn: ensureFooterIn,
        prepareFlowView: prepareFlowView,
        prepareEmbeddedFrameView: prepareEmbeddedFrameView,
        prepareSupplyView: prepareSupplyView,
        applyEmbedDocumentForFlow: applyEmbedDocumentForFlow,
        syncIframeHeight: syncIframeHeight,
        bindIframeFlow: bindIframeFlow,
        prepareAllViews: prepareAllViews,
        onTabChange: onTabChange,
        init: init
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
