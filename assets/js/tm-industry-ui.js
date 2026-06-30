/**
 * 行业能力驱动的字段显隐
 */
(function () {
    'use strict';

    var CAP_RULES = {
        allowVariants: '[data-tm-cap="allowVariants"],[data-tm-cap-variants]',
        allowExpiry: '[data-tm-cap="allowExpiry"],[data-tm-cap-expiry]',
        allowSerial: '[data-tm-cap="allowSerial"],[data-tm-cap-serial]'
    };

    function capsFromProfile(profile) {
        profile = profile || window.TM_WorkbenchProfile || {};
        var c = profile.capabilities || {};
        return {
            allowVariants: !!c.allowVariants,
            allowExpiry: !!c.allowExpiry,
            allowSerial: !!c.allowSerial,
            industryVertical: profile.industryVertical || 'GENERAL'
        };
    }

    window.TM_IndustryUI = {
        apply: function (root, profile) {
            root = root || document.body;
            var caps = capsFromProfile(profile);
            Object.keys(CAP_RULES).forEach(function (key) {
                var on = caps[key];
                root.querySelectorAll(CAP_RULES[key]).forEach(function (el) {
                    el.classList.toggle('hidden', !on);
                    el.setAttribute('aria-hidden', on ? 'false' : 'true');
                });
            });
            root.querySelectorAll('[data-tm-industry]').forEach(function (el) {
                var need = el.getAttribute('data-tm-industry');
                var iv = caps.industryVertical;
                var show = !need || need === iv || need === 'ANY';
                el.classList.toggle('hidden', !show);
            });
            document.documentElement.setAttribute('data-industry-vertical', caps.industryVertical);
        }
    };
})();
