/**
 * TradeMind — 主壳/嵌入页/弹窗 Safe Area 统一计算
 */
(function () {
    'use strict';

    function isMobile() {
        return window.innerWidth < 768;
    }

    function sync() {
        var root = document.documentElement;
        var tabbar = document.getElementById('tm-app-tabbar');
        var header = document.getElementById('tm-app-header') || document.getElementById('tm-ops-app-header');
        if (!isMobile()) {
            root.style.setProperty('--tm-tabbar-h', '0px');
            root.style.setProperty('--tm-shell-bottom-reserve', '0px');
            return;
        }

        if (tabbar) {
            var tabH = Math.ceil(tabbar.getBoundingClientRect().height);
            if (tabH > 0) {
                root.style.setProperty('--tm-tabbar-h', tabH + 'px');
            }
        }

        if (header) {
            /*
             * --tm-mobile-header-h：仅内容高度（默认 3.5rem），CSS 另加 padding-top:safe-area。
             * 禁止把 getBoundingClientRect（含 padding）写回该变量，否则每次 sync 会累加变高。
             * --tm-header-h：整栏占位（内容+safe），供内容区高度计算。
             */
            var cs = window.getComputedStyle(header);
            var padTop = parseFloat(cs.paddingTop) || 0;
            var contentOnly = 56; // 3.5rem
            root.style.setProperty('--tm-mobile-header-h', contentOnly + 'px');
            var totalH = contentOnly + Math.round(padTop);
            root.style.setProperty('--tm-header-h', totalH + 'px');
        }

        if (document.body.classList.contains('tm-ops-portal')) {
            root.style.setProperty(
                '--tm-content-pad-b',
                'calc(var(--tm-tabbar-h, 4.25rem) + env(safe-area-inset-bottom, 0px) + 0.75rem)'
            );
        }

        /* 导览 FAB 为悬浮层，不占用主内容区底部留白（备案与布局与工作台一致） */
        root.style.setProperty('--tm-shell-bottom-reserve', '0px');
    }

    function applyContentArea(el, mode) {
        if (!el) return;
        mode = mode || 'app';
        var safeT = 'env(safe-area-inset-top, 0px)';
        var safeB = 'env(safe-area-inset-bottom, 0px)';
        var headerH = 'var(--tm-mobile-header-h, 3.5rem)';
        var tabH = 'var(--tm-tabbar-h, 4.25rem)';

        if (mode === 'embed') {
            el.style.setProperty('padding-top', '0.75rem', 'important');
            el.style.setProperty(
                'padding-bottom',
                'calc(' + tabH + ' + ' + safeB + ' + 0.5rem)',
                'important'
            );
            return;
        }
        if (mode === 'standalone') {
            if (isMobile()) {
                el.style.setProperty('padding-top', 'calc(var(--tm-header-h, 3.5rem) + 0.5rem)');
                el.style.setProperty(
                    'padding-bottom',
                    'calc(var(--tm-tabbar-h, 4.25rem) + var(--tm-shell-bottom-reserve, 0px) + ' + safeB + ' + 0.75rem)'
                );
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
            modalEl.classList.add('tm-mobile-sheet-modal', 'tm-unified-mobile-modal');
        }
        var backdrop = modalEl.querySelector(':scope > .tm-modal-backdrop, :scope > .absolute.inset-0');
        if (backdrop) {
            backdrop.classList.add('tm-modal-backdrop');
            if (!backdrop.classList.contains('backdrop-blur-md') && !backdrop.classList.contains('backdrop-blur-sm')) {
                backdrop.classList.add('backdrop-blur-md');
            }
            if (!/\bbg-slate-900/.test(backdrop.className)) {
                backdrop.classList.add('bg-slate-900/55');
            }
        }
        var panel = modalEl.querySelector('.tm-dialog-panel, .tm-mobile-sheet-panel, .modal-content-box, .modal-content');
        if (panel) {
            if (!panel.classList.contains('tm-dialog-panel')) {
                panel.classList.add('tm-dialog-panel');
            }
            if (!panel.classList.contains('modal-content-box')) {
                panel.classList.add('modal-content-box');
            }
            panel.classList.add('flex', 'flex-col', 'min-h-0', 'overflow-hidden');
        }
        modalEl.querySelectorAll('.tm-mobile-modal-body, .tm-mobile-modal-body.flex-1').forEach(function (body) {
            body.classList.add('min-h-0');
        });
        modalEl.querySelectorAll('.tm-dialog-footer, .tm-mobile-modal-footer, .tm-product-edit-footer, footer[class*="border-t"], .modal-content-box > div[class*="border-t"]:last-child').forEach(function (foot) {
            if (foot.closest('.tm-mobile-modal-body')) return;
            if (!foot.classList.contains('tm-mobile-modal-footer') && !foot.classList.contains('tm-product-edit-footer')) {
                foot.classList.add('tm-mobile-modal-footer');
            }
        });
    }

    function applyShellOverlayHidden(hidden) {
        var on = !!hidden;
        var tabbar = document.getElementById('tm-app-tabbar');
        if (tabbar) {
            tabbar.classList.toggle('tm-shell-chrome-hidden', on);
            if (!on) {
                tabbar.classList.remove('tm-shell-chrome-hidden');
                tabbar.style.removeProperty('visibility');
                tabbar.style.removeProperty('pointer-events');
            }
        }
        document.documentElement.classList.toggle('tm-embed-modal-open', on);
        document.body.classList.toggle('tm-embed-modal-open', on);
        if (!on) {
            document.documentElement.classList.remove('tm-embed-modal-open');
            document.body.classList.remove('tm-embed-modal-open');
        }
        var complianceFoot = document.querySelector('#content-area > footer.tm-compliance-footer');
        if (complianceFoot) {
            complianceFoot.style.display = on ? 'none' : '';
        }
        if (on) {
            document.documentElement.style.setProperty('--tm-tabbar-h', '0px');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            if (typeof window.TM_syncAppShellMetrics === 'function') {
                window.TM_syncAppShellMetrics();
            }
            /* 弹窗关闭后重定位备案 footer，避免 DOM 回流把滚动顶到顶部 */
            requestAnimationFrame(function () {
                try {
                    if (window.TM_Compliance && typeof window.TM_Compliance.relocateGlobalFooter === 'function') {
                        var tabId = window.TM_Compliance.getActiveTabId
                            ? window.TM_Compliance.getActiveTabId()
                            : undefined;
                        window.TM_Compliance.relocateGlobalFooter(tabId);
                    }
                } catch (eRel) { /* ignore */ }
            });
        }
    }

    function hideChromeForOverlay(hidden) {
        applyShellOverlayHidden(hidden);
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
        applyShellOverlayHidden: applyShellOverlayHidden,
        hideChromeForOverlay: hideChromeForOverlay,
        initEmbeddedDocument: initEmbeddedDocument,
        isMobile: isMobile
    };

    bindResize();

    window.TM_syncAppShellMetrics = function () {
        sync();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else {
        sync();
    }
    window.addEventListener('load', sync);
})();
