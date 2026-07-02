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

    function industryAllowsCapability(key, vertical) {
        vertical = String(vertical || 'GENERAL').toUpperCase();
        if (vertical === 'GENERAL' || vertical === 'PENDING') {
            return false;
        }
        if (key === 'allowVariants') {
            return vertical === 'CLOTHING' || vertical === 'FOOD' || vertical === 'DIGITAL_3C';
        }
        if (key === 'allowExpiry') {
            return vertical === 'FOOD';
        }
        if (key === 'allowSerial') {
            return vertical === 'DIGITAL_3C';
        }
        return false;
    }

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
        industryAllowsCapability: industryAllowsCapability,

        apply: function (root, profile) {
            root = root || document.body;
            var caps = capsFromProfile(profile);
            var vertical = caps.industryVertical;
            Object.keys(CAP_RULES).forEach(function (key) {
                var tenantOn = caps[key];
                var industryOn = industryAllowsCapability(key, vertical);
                var on = tenantOn && industryOn;
                root.querySelectorAll(CAP_RULES[key]).forEach(function (el) {
                    el.classList.toggle('hidden', !on);
                    el.setAttribute('aria-hidden', on ? 'false' : 'true');
                });
            });
            root.querySelectorAll('[data-tm-industry]').forEach(function (el) {
                var need = el.getAttribute('data-tm-industry');
                var iv = vertical;
                var show = !need || need === iv || need === 'ANY';
                el.classList.toggle('hidden', !show);
            });
            document.documentElement.setAttribute('data-industry-vertical', vertical);
        }
    };
})();
