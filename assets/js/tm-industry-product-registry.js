/**
 * 行业产品扩展注册表：按 industryVertical 挂载能力、默认模板、UI 扩展点。
 * 后续新增行业时在此 register，无需改动产品中心/极速开单主流程。
 */
(function () {
    'use strict';

    var strategies = {};

    function baseStrategy() {
        return {
            capabilities: { allowVariants: true, allowExpiry: false, allowSerial: false },
            enrichCatalogRow: null,
            enrichRegistryForm: null,
            enrichRapidOrderLine: null
        };
    }

    window.TM_IndustryProductRegistry = {
        register: function (vertical, strategy) {
            if (!vertical) return;
            strategies[String(vertical).toUpperCase()] = Object.assign(baseStrategy(), strategy || {});
        },

        get: function (vertical) {
            var key = String(vertical || 'GENERAL').toUpperCase();
            return strategies[key] || strategies.GENERAL || baseStrategy();
        },

        applyRegistryFormExtension: function (root, vertical) {
            var s = window.TM_IndustryProductRegistry.get(vertical);
            if (s && typeof s.enrichRegistryForm === 'function') {
                s.enrichRegistryForm(root);
            }
        },

        applyCatalogEnrichment: function (row, vertical) {
            var s = window.TM_IndustryProductRegistry.get(vertical);
            if (s && typeof s.enrichCatalogRow === 'function') {
                return s.enrichCatalogRow(row) || row;
            }
            return row;
        }
    };

    window.TM_IndustryProductRegistry.register('GENERAL', baseStrategy());

    window.TM_IndustryProductRegistry.register('CLOTHING', {
        capabilities: { allowVariants: true, allowExpiry: false, allowSerial: false }
    });

    window.TM_IndustryProductRegistry.register('FOOD', {
        capabilities: { allowVariants: true, allowExpiry: true, allowSerial: false }
    });

    window.TM_IndustryProductRegistry.register('DIGITAL_3C', {
        capabilities: { allowVariants: true, allowExpiry: false, allowSerial: true }
    });
})();
