/**
 * Legacy 新手导览已下线（2026-07-16）。
 * 保留空壳，避免历史缓存脚本或旧入口引用时报错。
 */
(function (global) {
    'use strict';

    function purgeDom() {
        [
            'tm-onboarding-root',
            'tm-onboarding-block-banner',
            'tm-onboarding-fab',
            'tm-onboarding-checklist-panel'
        ].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        document.querySelectorAll(
            '.tm-onboarding-welcome, .tm-onboarding-celebrate, .tm-onboarding-block-banner'
        ).forEach(function (el) {
            try { el.remove(); } catch (e) { /* ignore */ }
        });
        try {
            document.body.classList.remove('tm-onboarding--active', 'tm-onboarding--mobile');
            document.documentElement.classList.remove('tm-onboarding--active');
        } catch (e2) { /* ignore */ }
    }

    var noopApi = {
        disabled: true,
        shouldRun: function () { return false; },
        tryStart: function () { purgeDom(); },
        start: function () { purgeDom(); },
        dismiss: function () { purgeDom(); },
        reset: function () { purgeDom(); }
    };

    global.TM_ONBOARDING = noopApi;
    global.TM_Onboarding = noopApi;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', purgeDom);
    } else {
        purgeDom();
    }
    setTimeout(purgeDom, 0);
    setTimeout(purgeDom, 800);
})(window);
