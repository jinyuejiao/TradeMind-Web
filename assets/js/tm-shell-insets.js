/**
 * TradeMind — 主壳/嵌入页/弹窗 Safe Area 统一计算
 */
(function () {
    'use strict';

    function isMobile() {
        return window.innerWidth < 768;
    }

    function sync() {
        var tabbar = document.getElementById('tm-app-tabbar');
        var root = document.documentElement;
        if (!tabbar || !isMobile()) {
            root.style.setProperty('--tm-tabbar-h', '0px');
            return;
        }
        var h = Math.ceil(tabbar.getBoundingClientRect().height);
        if (h > 0) {
            root.style.setProperty('--tm-tabbar-h', h + 'px');
        }
    }

    function applyContentArea(el, mode) {
        if (!el) return;
        mode = mode || 'app';
        var safeT = 'env(safe-area-inset-top, 0px)';
        var safeB = 'env(safe-area-inset-bottom, 0px)';
        var headerH = 'var(--tm-mobile-header-h, 3.5rem)';
        var tabH = 'var(--tm-tabbar-h, 4.25rem)';

        if (mode === 'embed') {
            el.style.setProperty('padding-top', '0.5rem', 'important');
            el.style.setProperty(
                'padding-bottom',
                'calc(' + tabH + ' + ' + safeB + ' + 0.25rem)',
                'important'
            );
            return;
        }
        if (mode === 'standalone') {
            if (isMobile()) {
                el.style.setProperty('padding-top', 'calc(' + headerH + ' + ' + safeT + ' + 0.5rem)');
                el.style.setProperty('padding-bottom', 'calc(var(--tm-mobile-nav-h, 4.25rem) + ' + safeB + ' + 0.75rem)');
            } else {
                el.style.setProperty('padding-top', '');
                el.style.setProperty('padding-bottom', '');
            }
            return;
        }
        /* app: 主壳 #content-area 由 mobile.css + tm-layout-mobile 处理，仅清除 embed 强写 */
        if (el.classList && el.classList.contains('tm-app-content-area')) {
            el.style.removeProperty('padding-top');
            el.style.removeProperty('padding-bottom');
        }
    }

    function applyModalRoot(modalEl, opts) {
        if (!modalEl) return;
        opts = opts || {};
        var variant = opts.variant || 'sheet';
        modalEl.classList.add('tm-dialog-root');
        modalEl.setAttribute('data-tm-dialog-variant', variant);
        if (variant === 'sheet') {
            modalEl.classList.add('tm-mobile-sheet-modal');
        }
        var panel = modalEl.querySelector('.tm-dialog-panel, .tm-mobile-sheet-panel, .modal-content-box');
        if (panel && !panel.classList.contains('tm-dialog-panel')) {
            panel.classList.add('tm-dialog-panel');
        }
        modalEl.querySelectorAll('.tm-dialog-footer, footer[class*="border-t"]').forEach(function (foot) {
            if (!foot.classList.contains('tm-modal-footer-safe')) {
                foot.classList.add('tm-modal-footer-safe');
            }
        });
    }

    function hideChromeForOverlay(hidden) {
        if (typeof window.TM_setShellChromeHidden === 'function' && window.TM_setShellChromeHidden !== hideChromeForOverlay) {
            window.TM_setShellChromeHidden(hidden);
            return;
        }
        var tabbar = document.getElementById('tm-app-tabbar');
        var compliance = document.getElementById('tm-compliance-sticky');
        if (tabbar) tabbar.classList.toggle('tm-shell-chrome-hidden', !!hidden);
        if (compliance) compliance.classList.toggle('tm-shell-chrome-hidden', !!hidden);
        document.body.classList.toggle('tm-embed-modal-open', !!hidden);
    }

    function bindResize() {
        if (window.__tmShellInsetsBound) return;
        window.__tmShellInsetsBound = true;
        window.addEventListener('resize', function () {
            clearTimeout(window.__tmShellInsetsResizeTimer);
            window.__tmShellInsetsResizeTimer = setTimeout(sync, 100);
        });
    }

    function initEmbeddedDocument(doc) {
        if (!doc) return;
        var content = doc.getElementById('content-area');
        if (content) applyContentArea(content, 'embed');
    }

    window.TM_ShellInsets = {
        sync: sync,
        applyContentArea: applyContentArea,
        applyModalRoot: applyModalRoot,
        hideChromeForOverlay: hideChromeForOverlay,
        initEmbeddedDocument: initEmbeddedDocument,
        isMobile: isMobile
    };

    bindResize();

    window.TM_syncAppShellMetrics = function () {
        sync();
    };
})();
