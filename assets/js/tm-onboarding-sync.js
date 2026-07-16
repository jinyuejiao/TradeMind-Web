/**
 * Legacy 新手导览同步已下线（2026-07-16）。
 */
(function (global) {
    'use strict';
    global.TM_ONBOARDING_SYNC = {
        disabled: true,
        stashLoginBootstrap: function () { /* no-op */ },
        schedulePut: function () { /* no-op */ },
        hydrate: function () { return Promise.resolve(null); },
        clear: function () { /* no-op */ }
    };
})(window);
