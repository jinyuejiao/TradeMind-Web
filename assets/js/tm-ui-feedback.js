/**
 * TradeMind — 统一 confirm / alert（封装 TmConfirm + toast）
 */
(function () {
    'use strict';

    function toast(msg, type) {
        if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
            window.TM_UI.showNotification(msg, type || 'info');
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
            return;
        }
        var el = document.getElementById('toast-text');
        var box = document.getElementById('toast');
        if (el && box) {
            el.textContent = msg;
            box.classList.remove('hidden');
            setTimeout(function () { box.classList.add('hidden'); }, 2800);
            return;
        }
        console.warn('[TM_UI]', msg);
    }

    function alert(msg, type) {
        toast(msg, type || 'info');
    }

    function confirm(opts) {
        opts = opts || {};
        if (typeof opts === 'string') {
            opts = { message: opts };
        }
        return new Promise(function (resolve) {
            var done = false;
            function finish(ok) {
                if (done) return;
                done = true;
                resolve(!!ok);
            }
            if (window.TmConfirm && typeof window.TmConfirm.open === 'function') {
                window.TmConfirm.open({
                    title: opts.title || '确认操作',
                    message: opts.message || '确定要继续吗？',
                    confirmLabel: opts.confirmLabel || '确定',
                    danger: opts.danger === true,
                    onConfirm: function () { finish(true); }
                });
                var modal = document.getElementById('tm-confirm-modal');
                var cancelBtn = modal && modal.querySelector('[data-tm-confirm-cancel]');
                var backdrop = modal && modal.querySelector('[data-tm-confirm-backdrop]');
                function onCancel() {
                    finish(false);
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', onCancel, { once: true });
                }
                if (backdrop) {
                    backdrop.addEventListener('click', onCancel, { once: true });
                }
                return;
            }
            finish(window.confirm(opts.message || '确定？'));
        });
    }

    window.TM_UI = window.TM_UI || {};
    window.TM_UI.toast = toast;
    window.TM_UI.alert = alert;
    window.TM_UI.confirm = confirm;
})();
