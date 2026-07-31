/**
 * 嵌入模块与主壳协同：统一弹窗打开/关闭（Bottom Sheet 贴底 + 隐藏底栏）
 * 主壳 index-app 由 ui-main.js 提供同名 API；iframe 模块加载本文件即可获得一致行为。
 */
(function () {
    'use strict';

    var overlayDepth = 0;

    function isEmbedded() {
        try {
            return window.self !== window.top || new URLSearchParams(location.search).get('embed') === '1';
        } catch (e) {
            return true;
        }
    }

    function applyLocalOverlay(open) {
        var on = !!open;
        document.documentElement.classList.toggle('tm-embed-modal-open', on);
        document.body.classList.toggle('tm-embed-modal-open', on);
        if (on) {
            document.documentElement.style.setProperty('--tm-tabbar-h', '0px');
            document.body.style.overflow = 'hidden';
        } else if (overlayDepth <= 0) {
            document.body.style.overflow = '';
            document.documentElement.style.removeProperty('--tm-tabbar-h');
        }
    }

    function pushLocalOverlay() {
        overlayDepth += 1;
        if (overlayDepth === 1) {
            applyLocalOverlay(true);
            window.TM_notifyEmbedModal(true);
        }
    }

    function popLocalOverlay() {
        overlayDepth = Math.max(0, overlayDepth - 1);
        if (overlayDepth === 0) {
            applyLocalOverlay(false);
            window.TM_notifyEmbedModal(false);
        }
    }

    /** 非 TM_openUnifiedModal 的浮层（如 TmConfirm）与 overlayDepth 共用计数 */
    function pushEmbedOverlayRef() {
        overlayDepth += 1;
        if (overlayDepth === 1) {
            applyLocalOverlay(true);
            window.TM_notifyEmbedModal(true);
        }
    }

    function popEmbedOverlayRef() {
        overlayDepth = Math.max(0, overlayDepth - 1);
        if (overlayDepth === 0) {
            applyLocalOverlay(false);
            window.TM_notifyEmbedModal(false);
            var anyOpen = document.querySelector(
                '.tm-unified-mobile-modal:not(.hidden), .tm-product-edit-modal:not(.hidden), .tm-mobile-sheet-modal:not(.hidden), #tm-confirm-modal:not(.hidden)'
            );
            if (!anyOpen) {
                document.body.style.overflow = '';
            }
        }
    }

    window.TM_pushEmbedOverlayRef = pushEmbedOverlayRef;
    window.TM_popEmbedOverlayRef = popEmbedOverlayRef;

    window.TM_notifyEmbedModal = function (open) {
        if (!isEmbedded()) return;
        try {
            window.parent.postMessage({ type: 'TM_EMBED_MODAL', open: !!open }, '*');
        } catch (e) { /* ignore */ }
    };

    function applyDialogShell(modalEl, opts) {
        if (!modalEl) return;
        opts = opts || {};
        if (window.TM_ShellInsets && typeof window.TM_ShellInsets.applyModalRoot === 'function') {
            window.TM_ShellInsets.applyModalRoot(modalEl, { variant: opts.variant || 'sheet' });
            return;
        }
        var variant = opts.variant || modalEl.getAttribute('data-tm-dialog-variant') || 'sheet';
        modalEl.classList.add('tm-dialog-root');
        modalEl.setAttribute('data-tm-dialog-variant', variant);
        if (variant === 'sheet') {
            modalEl.classList.add('tm-mobile-sheet-modal', 'tm-unified-mobile-modal');
        }
        var panel = modalEl.querySelector('.tm-dialog-panel, .tm-mobile-sheet-panel, .modal-content-box, .modal-content');
        if (panel) {
            panel.classList.add('tm-dialog-panel', 'modal-content-box', 'flex', 'flex-col', 'min-h-0', 'overflow-hidden');
        }
        modalEl.querySelectorAll('.tm-mobile-modal-body, .tm-mobile-modal-body.flex-1, form.flex-1').forEach(function (body) {
            body.classList.add('min-h-0');
        });
        modalEl.querySelectorAll('.tm-dialog-footer, .tm-mobile-modal-footer, .tm-product-edit-footer').forEach(function (foot) {
            if (foot.closest('.tm-mobile-modal-body')) return;
            foot.classList.add('tm-mobile-modal-footer');
        });
    }

    function openUnifiedModal(modalEl, opts) {
        if (!modalEl) return;
        applyDialogShell(modalEl, opts || {});
        modalEl.classList.remove('hidden');
        modalEl.setAttribute('aria-hidden', 'false');
        pushLocalOverlay();
    }

    function closeUnifiedModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('hidden');
        modalEl.setAttribute('aria-hidden', 'true');
        popLocalOverlay();
        if (overlayDepth === 0) {
            var anyOpen = document.querySelector(
                '.tm-unified-mobile-modal:not(.hidden), .tm-product-edit-modal:not(.hidden), .tm-mobile-sheet-modal:not(.hidden)'
            );
            if (!anyOpen) {
                document.body.style.overflow = '';
            }
        }
    }

    /** 统一弹窗 API：嵌入页优先使用本地实现，勿调用 parent.TM_openUnifiedModal */
    window.TM_applyDialogShell = window.TM_applyDialogShell || applyDialogShell;
    window.TM_openUnifiedModal = window.TM_openUnifiedModal || openUnifiedModal;
    window.TM_closeUnifiedModal = window.TM_closeUnifiedModal || closeUnifiedModal;

    window.TM_EmbedShell = {
        isEmbedded: isEmbedded,
        openModal: openUnifiedModal,
        closeModal: closeUnifiedModal,
        applyDialogShell: applyDialogShell,
        reconcileOverlay: function () {
            var anyOpen = document.querySelector(
                '.tm-unified-mobile-modal:not(.hidden), .tm-product-edit-modal:not(.hidden), .tm-mobile-sheet-modal:not(.hidden), #tm-confirm-modal:not(.hidden), #tm-po-variant-sheet:not(.hidden), #tm-transfer-variant-sheet:not(.hidden)'
            );
            if (!anyOpen && overlayDepth > 0) {
                while (overlayDepth > 0) {
                    popLocalOverlay();
                }
            }
            if (!anyOpen) {
                document.documentElement.classList.remove('tm-embed-modal-open');
                document.body.classList.remove('tm-embed-modal-open');
                document.body.style.overflow = '';
                document.documentElement.style.removeProperty('--tm-tabbar-h');
            }
            if (isEmbedded()) {
                try {
                    window.parent.postMessage({ type: 'TM_EMBED_MODAL_RECONCILE' }, '*');
                } catch (e) { /* ignore */ }
            }
        }
    };

    window.TM_reconcileEmbedShellOverlay = function () {
        if (window.TM_EmbedShell && typeof window.TM_EmbedShell.reconcileOverlay === 'function') {
            window.TM_EmbedShell.reconcileOverlay();
        }
    };
})();
