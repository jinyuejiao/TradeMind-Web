/**
 * Legacy 新手导览注册表已下线（2026-07-16）。
 */
(function (global) {
    'use strict';
    global.TM_ONBOARDING_REGISTRY = {
        disabled: true,
        isMobileLayout: function () { return false; },
        getRoleCode: function () { return ''; },
        getMandatorySteps: function () { return []; },
        getChecklistItems: function () { return []; },
        getMandatoryProfile: function () { return null; }
    };
})(window);
