/**
 * TradeMind — 统一确认对话框（替代浏览器 confirm）
 */
(function () {
    'use strict';

    var pendingOnConfirm = null;

    function ensureModal() {
        var modal = document.getElementById('tm-confirm-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'tm-confirm-modal';
        modal.className = 'hidden fixed inset-0 z-[160] flex items-center justify-center p-4 modal-blur';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML =
            '<div class="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" data-tm-confirm-backdrop></div>' +
            '<div class="relative bg-white w-full max-w-sm rounded-[1.75rem] shadow-2xl overflow-hidden p-6 md:p-8 text-center fade-in border border-slate-100">' +
            '<div id="tm-confirm-icon" class="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">' +
            '<i class="ph ph-warning-circle text-3xl"></i></div>' +
            '<h3 id="tm-confirm-title" class="text-base md:text-lg font-black text-slate-800 mb-2">确认操作</h3>' +
            '<p id="tm-confirm-message" class="text-sm text-slate-500 leading-relaxed mb-6 md:mb-8"></p>' +
            '<div class="flex gap-3">' +
            '<button type="button" data-tm-confirm-cancel class="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">取消</button>' +
            '<button type="button" data-tm-confirm-ok class="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors shadow-lg">确定</button>' +
            '</div></div>';
        document.body.appendChild(modal);
        modal.querySelector('[data-tm-confirm-backdrop]').addEventListener('click', close);
        modal.querySelector('[data-tm-confirm-cancel]').addEventListener('click', close);
        modal.querySelector('[data-tm-confirm-ok]').addEventListener('click', function () {
            var fn = pendingOnConfirm;
            close();
            if (typeof fn === 'function') fn();
        });
        return modal;
    }

    function close() {
        var modal = document.getElementById('tm-confirm-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
        pendingOnConfirm = null;
    }

    function open(opts) {
        opts = opts || {};
        var modal = ensureModal();
        var titleEl = document.getElementById('tm-confirm-title');
        var msgEl = document.getElementById('tm-confirm-message');
        var iconWrap = document.getElementById('tm-confirm-icon');
        var okBtn = modal.querySelector('[data-tm-confirm-ok]');

        if (titleEl) titleEl.textContent = opts.title || '确认操作';
        if (msgEl) msgEl.textContent = opts.message || '确定要继续吗？';

        var danger = opts.danger === true || opts.confirmLabel === '确认删除';
        if (iconWrap) {
            iconWrap.className = 'w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ' +
                (danger ? 'bg-rose-100 text-rose-500' : 'bg-amber-100 text-amber-600');
            var icon = iconWrap.querySelector('i');
            if (icon) {
                icon.className = danger ? 'ph ph-trash text-3xl' : 'ph ph-warning-circle text-3xl';
            }
        }
        if (okBtn) {
            okBtn.textContent = opts.confirmLabel || '确定';
            okBtn.className = 'flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors shadow-lg ' +
                (danger ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20');
        }

        pendingOnConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (okBtn) okBtn.focus();
    }

    window.TmConfirm = {
        open: open,
        close: close
    };
})();
