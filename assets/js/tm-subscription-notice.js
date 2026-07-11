/**
 * 租户订阅状态提示：顶栏横幅 + 操作拦截引导（宽限期 / 已过期）
 */
(function () {
    'use strict';

    var BANNER_ID = 'tm-subscription-notice-bar';
    var MODAL_ID = 'tm-subscription-expired-modal';
    var DISMISS_KEY = 'tm_sub_notice_dismissed';
    var MODAL_SHOWN_KEY = 'tm_sub_expired_modal_shown';

    var ACTION_COPY = {
        save_product: {
            READ_ONLY: '宽限期内暂不支持保存产品。续费后，您即可继续维护商品档案与规格。',
            BILLING_ONLY: '订阅已过期，产品编辑已暂停。续费后无需重新配置，数据都已为您安全保留。'
        },
        create_order: {
            READ_ONLY: '宽限期内暂不支持新建订单。续费后即可恢复极速开单与 AI 审核下单。',
            BILLING_ONLY: '订阅已过期，开单功能已暂停。续费后可立即恢复日常接单与发货流程。'
        },
        default: {
            READ_ONLY: '当前处于宽限期，部分编辑功能暂不可用。续费后即可恢复全部能力。',
            BILLING_ONLY: '订阅已过期，部分功能已暂停。续费后即可继续使用 TradeMind 全部功能。'
        }
    };

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return String(iso).slice(0, 10);
            return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
        } catch (e) {
            return String(iso).slice(0, 10);
        }
    }

    function currentAccessMode() {
        var profile = window.TM_WorkbenchProfile || {};
        var me = window._tmMemberMe || {};
        return String(profile.accessMode || me.accessMode || 'FULL').toUpperCase();
    }

    function isLimitedMode(mode) {
        var m = (mode || currentAccessMode()).toUpperCase();
        return m === 'READ_ONLY' || m === 'BILLING_ONLY';
    }

    function dismissToken(mode, me) {
        me = me || window._tmMemberMe || {};
        return String(mode || currentAccessMode()) + '|' + String(me.subEndTime || '') + '|' + String(me.graceUntil || '');
    }

    function isBannerDismissed(mode, me) {
        try {
            return sessionStorage.getItem(DISMISS_KEY) === dismissToken(mode, me);
        } catch (e) {
            return false;
        }
    }

    function setBannerDismissed(mode, me) {
        try {
            sessionStorage.setItem(DISMISS_KEY, dismissToken(mode, me));
        } catch (e) { /* ignore */ }
    }

    function buildBannerState(mode, me) {
        me = me || window._tmMemberMe || {};
        var subEnd = fmtDate(me.subEndTime);
        var graceEnd = fmtDate(me.graceUntil);
        var planName = me.displayName || me.subscriptionType || '当前套餐';

        if (mode === 'READ_ONLY') {
            return {
                tone: 'grace',
                icon: 'ph-hourglass-medium',
                title: '您的订阅已到期，数据仍在为您保留',
                desc: '目前已进入宽限期，您仍可查看报表与历史档案。'
                    + (subEnd ? '套餐已于 ' + subEnd + ' 到期' : '')
                    + (graceEnd ? '，宽限期至 ' + graceEnd : '')
                    + '。续费后即可恢复开单、编辑产品等全部功能，经营不中断。',
                cta: '了解续费方案',
                secondary: '稍后再说'
            };
        }
        return {
            tone: 'expired',
            icon: 'ph-crown-simple',
            title: '订阅已过期，部分功能已暂停',
            desc: '别担心，' + esc(planName) + ' 的数据仍然安全保存。'
                + (subEnd ? '服务已于 ' + subEnd + ' 到期。' : '')
                + '续费后无需重新配置，即可恢复极速开单、产品管理与 AI 助手等完整能力。',
            cta: '立即续费恢复使用',
            secondary: '我先看看'
        };
    }

    function findMountPoint() {
        var header = document.getElementById('tm-app-header');
        if (header && header.parentNode) {
            return { parent: header.parentNode, before: header.nextSibling };
        }
        var content = document.getElementById('content-area');
        if (content) return { parent: content, before: content.firstChild };
        var main = document.querySelector('main');
        if (main) return { parent: main, before: main.firstChild };
        return { parent: document.body, before: document.body.firstChild };
    }

    function removeBanner() {
        var el = document.getElementById(BANNER_ID);
        if (el) el.remove();
    }

    function openRenew() {
        if (typeof window.openMemberModal === 'function') {
            window.openMemberModal();
            return;
        }
        if (typeof window.tmOpenMemberCenterAfterPay === 'function') {
            window.tmOpenMemberCenterAfterPay();
        }
    }

    function renderBanner(state) {
        removeBanner();
        var bar = document.createElement('div');
        bar.id = BANNER_ID;
        bar.className = 'tm-subscription-notice tm-subscription-notice--' + state.tone;
        bar.setAttribute('role', 'status');
        bar.innerHTML =
            '<div class="tm-subscription-notice__inner">' +
            '<div class="tm-subscription-notice__icon" aria-hidden="true"><i class="ph ' + esc(state.icon) + '"></i></div>' +
            '<div class="tm-subscription-notice__text">' +
            '<p class="tm-subscription-notice__title">' + esc(state.title) + '</p>' +
            '<p class="tm-subscription-notice__desc">' + state.desc + '</p>' +
            '</div>' +
            '<div class="tm-subscription-notice__actions">' +
            '<button type="button" class="tm-subscription-notice__cta" data-tm-sub-renew>' + esc(state.cta) + '</button>' +
            '<button type="button" class="tm-subscription-notice__dismiss" data-tm-sub-dismiss>' + esc(state.secondary) + '</button>' +
            '</div></div>';

        var mount = findMountPoint();
        mount.parent.insertBefore(bar, mount.before);

        bar.querySelector('[data-tm-sub-renew]').addEventListener('click', openRenew);
        bar.querySelector('[data-tm-sub-dismiss]').addEventListener('click', function () {
            setBannerDismissed(currentAccessMode(), window._tmMemberMe);
            removeBanner();
        });
    }

    function ensureExpiredModal() {
        var modal = document.getElementById(MODAL_ID);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'hidden fixed inset-0 z-[120] flex items-center justify-center p-4 modal-blur';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML =
            '<div class="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" data-tm-sub-modal-backdrop></div>' +
            '<div class="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 fade-in">' +
            '<div class="px-6 pt-6 pb-4 text-center">' +
            '<div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#14B8A6] text-white flex items-center justify-center shadow-lg shadow-[#14B8A6]/30">' +
            '<i class="ph ph-crown-simple text-2xl"></i></div>' +
            '<h3 class="text-base font-black text-slate-800 mb-2" data-tm-sub-modal-title></h3>' +
            '<p class="text-sm text-slate-500 leading-relaxed text-left" data-tm-sub-modal-body></p>' +
            '</div>' +
            '<div class="px-6 pb-6 flex flex-col gap-2">' +
            '<button type="button" class="w-full py-3 rounded-2xl bg-[#14B8A6] hover:bg-[#0D9488] text-white text-sm font-black shadow-lg shadow-[#14B8A6]/25 transition-colors" data-tm-sub-modal-renew>查看续费方案</button>' +
            '<button type="button" class="w-full py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors" data-tm-sub-modal-later>稍后再说</button>' +
            '</div></div>';
        document.body.appendChild(modal);
        modal.querySelector('[data-tm-sub-modal-backdrop]').addEventListener('click', closeExpiredModal);
        modal.querySelector('[data-tm-sub-modal-later]').addEventListener('click', closeExpiredModal);
        modal.querySelector('[data-tm-sub-modal-renew]').addEventListener('click', function () {
            closeExpiredModal();
            openRenew();
        });
        return modal;
    }

    function closeExpiredModal() {
        var modal = document.getElementById(MODAL_ID);
        if (modal) modal.classList.add('hidden');
        if (typeof window.TM_popEmbedOverlayRef === 'function') {
            try { window.TM_popEmbedOverlayRef(); } catch (e) { /* ignore */ }
        }
    }

    function maybeShowFirstVisitModal(mode, me) {
        if (mode !== 'BILLING_ONLY') return;
        try {
            if (sessionStorage.getItem(MODAL_SHOWN_KEY) === dismissToken(mode, me)) return;
            sessionStorage.setItem(MODAL_SHOWN_KEY, dismissToken(mode, me));
        } catch (e) { /* ignore */ }

        var state = buildBannerState(mode, me);
        var modal = ensureExpiredModal();
        modal.querySelector('[data-tm-sub-modal-title]').textContent = state.title;
        modal.querySelector('[data-tm-sub-modal-body]').textContent = state.desc;
        modal.classList.remove('hidden');
        if (typeof window.TM_pushEmbedOverlayRef === 'function') {
            try { window.TM_pushEmbedOverlayRef(); } catch (e) { /* ignore */ }
        }
    }

    function getBlockedMessage(actionKey, mode) {
        var m = (mode || currentAccessMode()).toUpperCase();
        var bucket = ACTION_COPY[actionKey] || ACTION_COPY.default;
        return bucket[m] || bucket.BILLING_ONLY || bucket.READ_ONLY;
    }

    function notify(msg, level) {
        if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
            window.TM_UI.showNotification(msg, level || 'warning');
        }
    }

    function refresh(opts) {
        opts = opts || {};
        var mode = currentAccessMode();
        if (!isLimitedMode(mode)) {
            removeBanner();
            return;
        }
        var me = window._tmMemberMe || {};
        if (!opts.force && isBannerDismissed(mode, me)) {
            removeBanner();
            if (opts.showModal) maybeShowFirstVisitModal(mode, me);
            return;
        }
        renderBanner(buildBannerState(mode, me));
        if (opts.showModal !== false) {
            maybeShowFirstVisitModal(mode, me);
        }
    }

    function promptBlocked(actionKey, options) {
        options = options || {};
        var mode = currentAccessMode();
        if (!isLimitedMode(mode)) return false;
        var msg = options.message || getBlockedMessage(actionKey || 'default', mode);
        notify(msg, options.level || 'warning');
        refresh({ showModal: false });
        if (options.openRenew !== false) {
            if (options.delayModalMs) {
                setTimeout(openRenew, options.delayModalMs);
            } else {
                openRenew();
            }
        }
        return true;
    }

    function isSubscriptionErrorMessage(msg) {
        return /订阅|只读|READ_ONLY|BILLING_ONLY|accessMode|续费/i.test(String(msg || ''));
    }

    window.TM_SubscriptionNotice = {
        refresh: refresh,
        promptBlocked: promptBlocked,
        openRenew: openRenew,
        isLimited: function () { return isLimitedMode(); },
        getAccessMode: currentAccessMode,
        isSubscriptionErrorMessage: isSubscriptionErrorMessage,
        getBlockedMessage: getBlockedMessage
    };

    window.TM_promptSubscriptionRenew = function (actionKey, options) {
        return promptBlocked(actionKey, options);
    };
})();
